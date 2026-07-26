from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/rent", tags=["rent"])


def _sync_tenant_due(tenant_id: int, db: Session):
    """Recompute a tenant's outstanding due_amount from their current rent records."""
    tenant = db.query(models.Tenant).get(tenant_id)
    if not tenant:
        return
    outstanding = db.query(models.RentPayment).filter(models.RentPayment.tenant_id == tenant_id).all()
    tenant.due_amount = sum(max(o.amount_due + o.late_fee - o.amount_paid, 0) for o in outstanding)


def _resync_status(rp: models.RentPayment):
    if rp.amount_paid <= 0:
        rp.status = "Pending"
    elif rp.amount_paid < rp.amount_due + rp.late_fee:
        rp.status = "Partially Paid"
    else:
        rp.status = "Paid"


@router.post("/generate")
def generate_month(payload: schemas.RentGenerate, db: Session = Depends(get_db)):
    """Create a rent-due record for every active tenant for the given month (idempotent)."""
    tenants = db.query(models.Tenant).filter(models.Tenant.status == "Active").all()
    created = 0
    for t in tenants:
        existing = db.query(models.RentPayment).filter(
            models.RentPayment.tenant_id == t.id, models.RentPayment.month == payload.month
        ).first()
        if existing:
            continue
        db.add(models.RentPayment(
            tenant_id=t.id, month=payload.month, amount_due=t.rent_amount,
            amount_paid=0, status="Pending",
        ))
        created += 1
    db.flush()  # make new rows visible to the due_amount recompute below
    for t in tenants:
        _sync_tenant_due(t.id, db)
    db.commit()
    return {"created": created, "month": payload.month}


@router.get("", response_model=List[schemas.RentPaymentOut])
def list_rent(month: Optional[str] = None, status: Optional[str] = None,
              tenant_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.RentPayment)
    if month:
        q = q.filter(models.RentPayment.month == month)
    if status:
        q = q.filter(models.RentPayment.status == status)
    if tenant_id:
        q = q.filter(models.RentPayment.tenant_id == tenant_id)
    return q.order_by(models.RentPayment.month.desc()).all()


@router.put("/{payment_id}", response_model=schemas.RentPaymentOut)
def update_rent(payment_id: int, payload: schemas.RentPaymentUpdate, db: Session = Depends(get_db)):
    """Administrative edits (late fee, manual status override) — does not record a payment."""
    rp = db.query(models.RentPayment).get(payment_id)
    if not rp:
        raise HTTPException(404, "Rent record not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rp, k, v)

    if payload.status is None:
        _resync_status(rp)

    _sync_tenant_due(rp.tenant_id, db)
    db.commit()
    db.refresh(rp)
    return rp


@router.post("/{payment_id}/pay", response_model=schemas.RentPaymentOut)
def pay_rent(payment_id: int, payload: schemas.RentPaymentPay, db: Session = Depends(get_db)):
    """Record one dated installment against a rent record. Each call adds a
    transaction rather than overwriting the running total, so partial
    payments made on different days are tracked and reported accurately."""
    rp = db.query(models.RentPayment).get(payment_id)
    if not rp:
        raise HTTPException(404, "Rent record not found")
    if payload.amount <= 0:
        raise HTTPException(400, "Payment amount must be greater than zero")

    db.add(models.RentPaymentTxn(
        rent_payment_id=rp.id, amount=payload.amount,
        payment_mode=payload.payment_mode, payment_date=payload.payment_date,
    ))
    rp.amount_paid += payload.amount
    rp.payment_mode = payload.payment_mode
    rp.payment_date = payload.payment_date
    if payload.late_fee is not None:
        rp.late_fee = payload.late_fee
    _resync_status(rp)

    _sync_tenant_due(rp.tenant_id, db)
    db.commit()
    db.refresh(rp)
    return rp


@router.delete("/{payment_id}")
def delete_rent(payment_id: int, db: Session = Depends(get_db)):
    rp = db.query(models.RentPayment).get(payment_id)
    if not rp:
        raise HTTPException(404, "Rent record not found")
    tenant_id = rp.tenant_id
    db.delete(rp)
    db.flush()  # ensure the delete is visible to the due_amount recompute query below
    _sync_tenant_due(tenant_id, db)
    db.commit()
    return {"ok": True}
