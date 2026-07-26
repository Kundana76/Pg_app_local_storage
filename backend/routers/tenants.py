from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


def _apply_allocation(tenant: models.Tenant, db: Session, previous_bed_id: Optional[int] = None):
    """Update bed/room occupancy status when a tenant is allocated or moved."""
    if previous_bed_id and previous_bed_id != tenant.bed_id:
        old_bed = db.query(models.Bed).get(previous_bed_id)
        if old_bed:
            still_used = db.query(models.Tenant).filter(
                models.Tenant.bed_id == old_bed.id, models.Tenant.status == "Active"
            ).first()
            if not still_used:
                old_bed.status = "Vacant"

    if tenant.bed_id and tenant.status == "Active":
        bed = db.query(models.Bed).get(tenant.bed_id)
        if bed:
            other = db.query(models.Tenant).filter(
                models.Tenant.bed_id == bed.id, models.Tenant.id != tenant.id, models.Tenant.status == "Active"
            ).first()
            if other:
                raise HTTPException(400, f"Bed already occupied by {other.full_name}")
            bed.status = "Occupied"

    # recompute room status from its beds
    if tenant.room_id:
        room = db.query(models.Room).get(tenant.room_id)
        if room:
            occupied = sum(1 for b in room.beds if b.status == "Occupied")
            if room.status != "Maintenance" and room.status != "Reserved":
                room.status = "Occupied" if occupied > 0 else "Vacant"


@router.get("", response_model=List[schemas.TenantOut])
def list_tenants(status: Optional[str] = None, room_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Tenant)
    if status:
        q = q.filter(models.Tenant.status == status)
    if room_id:
        q = q.filter(models.Tenant.room_id == room_id)
    return q.order_by(models.Tenant.id.desc()).all()


@router.get("/{tenant_id}", response_model=schemas.TenantOut)
def get_tenant(tenant_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Tenant).get(tenant_id)
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.post("", response_model=schemas.TenantOut)
def create_tenant(payload: schemas.TenantCreate, db: Session = Depends(get_db)):
    tenant = models.Tenant(**payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    _apply_allocation(tenant, db)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.put("/{tenant_id}", response_model=schemas.TenantOut)
def update_tenant(tenant_id: int, payload: schemas.TenantUpdate, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).get(tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    previous_bed_id = tenant.bed_id
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, k, v)
    db.commit()
    _apply_allocation(tenant, db, previous_bed_id=previous_bed_id)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.post("/{tenant_id}/checkout", response_model=schemas.TenantOut)
def checkout_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).get(tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    previous_bed_id = tenant.bed_id
    tenant.status = "Vacated"
    import datetime as dt
    tenant.leaving_date = dt.date.today()
    db.commit()
    _apply_allocation(tenant, db, previous_bed_id=previous_bed_id)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).get(tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    db.delete(tenant)
    db.commit()
    return {"ok": True}
