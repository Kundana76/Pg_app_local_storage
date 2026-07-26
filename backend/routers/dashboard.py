import datetime as dt
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    today = dt.date.today()
    this_month = today.strftime("%Y-%m")

    floors = db.query(models.Floor).count()
    rooms = db.query(models.Room).all()
    beds = db.query(models.Bed).all()
    tenants_active = db.query(models.Tenant).filter(models.Tenant.status == "Active").all()

    vacant_rooms = sum(1 for r in rooms if r.status == "Vacant")
    occupied_rooms = sum(1 for r in rooms if r.status == "Occupied")
    beds_available = sum(1 for b in beds if b.status == "Vacant")

    # today's rent collection (actual installments recorded today, cash basis)
    todays_collection = sum(
        txn.amount for txn in db.query(models.RentPaymentTxn).filter(models.RentPaymentTxn.payment_date == today).all()
    )

    # monthly income = rent actually collected this month (cash basis) + other income this month
    all_rent_txns = db.query(models.RentPaymentTxn).all()
    rent_income = sum(txn.amount for txn in all_rent_txns if txn.payment_date.strftime("%Y-%m") == this_month)
    other_income_rows = db.query(models.Income).all()
    other_income = sum(i.amount for i in other_income_rows if i.date.strftime("%Y-%m") == this_month)
    monthly_income = rent_income + other_income

    expense_rows = db.query(models.Expense).all()
    monthly_expense = sum(e.amount for e in expense_rows if e.date.strftime("%Y-%m") == this_month)

    # pending rent (accrual basis: what's due for this month's generated records, including late fees)
    rent_this_month = db.query(models.RentPayment).filter(models.RentPayment.month == this_month).all()
    pending_rent = sum(rp.amount_due + rp.late_fee - rp.amount_paid for rp in rent_this_month if rp.status != "Paid")
    active_tenants = db.query(models.Tenant).filter(models.Tenant.status == "Active").all()
    due_amount = sum(t.due_amount or 0 for t in active_tenants)
    advance_amount = sum(t.advance_paid or 0 for t in active_tenants)
    security_deposits = sum(t.deposit or 0 for t in db.query(models.Tenant).all())
    utility_expenses = sum(
        e.amount for e in expense_rows
        if e.category in ("Electricity", "Water", "Internet", "Gas") and e.date.strftime("%Y-%m") == this_month
    )

    return {
        "total_floors": floors,
        "total_rooms": len(rooms),
        "vacant_rooms": vacant_rooms,
        "occupied_rooms": occupied_rooms,
        "total_tenants": len(tenants_active),
        "beds_available": beds_available,
        "todays_collection": round(todays_collection, 2),
        "monthly_income": round(monthly_income, 2),
        "monthly_expense": round(monthly_expense, 2),
        "profit": round(monthly_income - monthly_expense, 2),
        "pending_rent": round(pending_rent, 2),
        "due_amount": round(due_amount, 2),
        "advance_amount": round(advance_amount, 2),
        "security_deposits": round(security_deposits, 2),
        "utility_expenses": round(utility_expenses, 2),
    }


@router.get("/charts")
def charts(db: Session = Depends(get_db)):
    today = dt.date.today()
    months = []
    for i in range(5, -1, -1):
        m = (today.replace(day=1) - dt.timedelta(days=30 * i))
        months.append(m.strftime("%Y-%m"))
    months = sorted(set(months))

    expense_rows = db.query(models.Expense).all()
    income_rows = db.query(models.Income).all()
    rent_txns = db.query(models.RentPaymentTxn).all()

    monthly_income_series = []
    monthly_expense_series = []
    for m in months:
        rent_amt = sum(t.amount for t in rent_txns if t.payment_date.strftime("%Y-%m") == m)
        inc_amt = sum(i.amount for i in income_rows if i.date.strftime("%Y-%m") == m)
        exp_amt = sum(e.amount for e in expense_rows if e.date.strftime("%Y-%m") == m)
        monthly_income_series.append(round(rent_amt + inc_amt, 2))
        monthly_expense_series.append(round(exp_amt, 2))

    rooms = db.query(models.Room).all()
    occupancy_rate = 0
    if rooms:
        occupancy_rate = round(100 * sum(1 for r in rooms if r.status == "Occupied") / len(rooms), 1)

    expense_by_category = defaultdict(float)
    for e in expense_rows:
        if e.date.strftime("%Y-%m") in months:
            expense_by_category[e.category] += e.amount

    return {
        "months": months,
        "monthly_income": monthly_income_series,
        "monthly_expense": monthly_expense_series,
        "occupancy_rate": occupancy_rate,
        "expense_by_category": [{"category": k, "amount": round(v, 2)} for k, v in expense_by_category.items()],
    }


@router.get("/ledger")
def ledger(db: Session = Depends(get_db)):
    """Combined running ledger of all income & expenses, most recent first."""
    entries = []
    for e in db.query(models.Expense).all():
        entries.append({"date": str(e.date), "type": "Debit", "category": e.category,
                         "description": e.description or "", "amount": e.amount})
    for i in db.query(models.Income).all():
        entries.append({"date": str(i.date), "type": "Credit", "category": i.category,
                         "description": i.description or "", "amount": i.amount})
    for txn in db.query(models.RentPaymentTxn).all():
        rp = txn.rent_payment
        entries.append({"date": str(txn.payment_date), "type": "Credit", "category": "Rent Collection",
                         "description": f"Tenant #{rp.tenant_id} - {rp.month}", "amount": txn.amount})

    entries.sort(key=lambda x: x["date"])
    running = 0
    for entry in entries:
        running += entry["amount"] if entry["type"] == "Credit" else -entry["amount"]
        entry["running_balance"] = round(running, 2)
    entries.reverse()
    return entries
