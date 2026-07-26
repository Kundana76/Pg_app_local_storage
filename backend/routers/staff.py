from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("", response_model=List[schemas.StaffOut])
def list_staff(role: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Staff)
    if role:
        q = q.filter(models.Staff.role == role)
    if status:
        q = q.filter(models.Staff.status == status)
    return q.order_by(models.Staff.id.desc()).all()


@router.post("", response_model=schemas.StaffOut)
def create_staff(payload: schemas.StaffCreate, db: Session = Depends(get_db)):
    staff = models.Staff(**payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{staff_id}", response_model=schemas.StaffOut)
def update_staff(staff_id: int, payload: schemas.StaffUpdate, db: Session = Depends(get_db)):
    staff = db.query(models.Staff).get(staff_id)
    if not staff:
        raise HTTPException(404, "Staff not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(staff, k, v)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(models.Staff).get(staff_id)
    if not staff:
        raise HTTPException(404, "Staff not found")
    db.delete(staff)
    db.commit()
    return {"ok": True}


@router.post("/attendance")
def mark_attendance(payload: schemas.AttendanceMark, db: Session = Depends(get_db)):
    existing = db.query(models.StaffAttendance).filter(
        models.StaffAttendance.staff_id == payload.staff_id,
        models.StaffAttendance.date == payload.date,
    ).first()
    if existing:
        existing.status = payload.status
    else:
        db.add(models.StaffAttendance(**payload.model_dump()))
    db.commit()
    return {"ok": True}


@router.get("/{staff_id}/attendance")
def get_attendance(staff_id: int, month: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.StaffAttendance).filter(models.StaffAttendance.staff_id == staff_id)
    records = q.all()
    if month:
        records = [r for r in records if r.date.strftime("%Y-%m") == month]
    return [{"date": str(r.date), "status": r.status} for r in records]
