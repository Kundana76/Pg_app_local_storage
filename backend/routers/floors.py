from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from typing import List
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/floors", tags=["floors"])

ORDINALS = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth",
            "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"]


def ordinal_name(n: int) -> str:
    if n == 0:
        return "Ground Floor"
    if n < len(ORDINALS):
        return f"{ORDINALS[n]} Floor"
    return f"Floor {n}"


@router.get("", response_model=List[schemas.FloorOut])
def list_floors(db: Session = Depends(get_db)):
    return db.query(models.Floor).order_by(models.Floor.id).all()


@router.post("", response_model=schemas.FloorOut)
def create_floor(payload: schemas.FloorCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Floor).filter(models.Floor.name == payload.name).first()
    if existing:
        raise HTTPException(400, "A floor with this name already exists")
    floor = models.Floor(name=payload.name)
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


@router.post("/bulk", response_model=List[schemas.FloorOut])
def bulk_create_floors(payload: schemas.FloorBulkCreate, db: Session = Depends(get_db)):
    created = []
    if payload.include_ground:
        name = "Ground Floor"
        if not db.query(models.Floor).filter(models.Floor.name == name).first():
            f = models.Floor(name=name)
            db.add(f)
            created.append(f)
    for i in range(payload.start_at, payload.start_at + payload.count):
        name = ordinal_name(i)
        if not db.query(models.Floor).filter(models.Floor.name == name).first():
            f = models.Floor(name=name)
            db.add(f)
            created.append(f)
    db.commit()
    for f in created:
        db.refresh(f)
    return created


@router.delete("/{floor_id}")
def delete_floor(floor_id: int, db: Session = Depends(get_db)):
    floor = db.query(models.Floor).get(floor_id)
    if not floor:
        raise HTTPException(404, "Floor not found")
    db.delete(floor)
    db.commit()
    return {"ok": True}
