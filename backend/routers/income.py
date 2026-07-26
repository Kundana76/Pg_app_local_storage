from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/income", tags=["income"])


@router.get("", response_model=List[schemas.IncomeOut])
def list_income(category: Optional[str] = None, month: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Income)
    if category:
        q = q.filter(models.Income.category == category)
    items = q.order_by(models.Income.date.desc()).all()
    if month:
        items = [i for i in items if i.date.strftime("%Y-%m") == month]
    return items


@router.post("", response_model=schemas.IncomeOut)
def create_income(payload: schemas.IncomeCreate, db: Session = Depends(get_db)):
    i = models.Income(**payload.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return i


@router.delete("/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    i = db.query(models.Income).get(income_id)
    if not i:
        raise HTTPException(404, "Income record not found")
    db.delete(i)
    db.commit()
    return {"ok": True}
