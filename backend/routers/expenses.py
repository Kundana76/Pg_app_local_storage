from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime as dt
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("", response_model=List[schemas.ExpenseOut])
def list_expenses(category: Optional[str] = None, month: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Expense)
    if category:
        q = q.filter(models.Expense.category == category)
    items = q.order_by(models.Expense.date.desc()).all()
    if month:
        items = [i for i in items if i.date.strftime("%Y-%m") == month]
    return items


@router.post("", response_model=schemas.ExpenseOut)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    e = models.Expense(**payload.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).get(expense_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
