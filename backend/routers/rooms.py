from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def sync_beds(room: models.Room, db: Session):
    """Ensure the room has exactly `bed_count` beds, preserving existing occupied beds."""
    existing = sorted(room.beds, key=lambda b: b.id)
    if len(existing) < room.bed_count:
        for i in range(len(existing) + 1, room.bed_count + 1):
            db.add(models.Bed(room_id=room.id, label=f"Bed {i}", status="Vacant"))
    elif len(existing) > room.bed_count:
        removable = [b for b in existing if b.status == "Vacant"]
        to_remove = existing[room.bed_count:]
        for b in to_remove:
            if b in removable:
                db.delete(b)


@router.get("", response_model=List[schemas.RoomOut])
def list_rooms(floor_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Room)
    if floor_id:
        q = q.filter(models.Room.floor_id == floor_id)
    if status:
        q = q.filter(models.Room.status == status)
    return q.order_by(models.Room.number).all()


@router.post("", response_model=schemas.RoomOut)
def create_room(payload: schemas.RoomCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Room).filter(models.Room.number == payload.number,
                                             models.Room.floor_id == payload.floor_id).first()
    if existing:
        raise HTTPException(400, "A room with this number already exists on this floor")
    room = models.Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    sync_beds(room, db)
    db.commit()
    db.refresh(room)
    return room


@router.post("/bulk", response_model=List[schemas.RoomOut])
def bulk_create_rooms(payload: schemas.RoomBulkCreate, db: Session = Depends(get_db)):
    if payload.end < payload.start:
        raise HTTPException(400, "End must be greater than or equal to start")
    created = []
    for n in range(payload.start, payload.end + 1):
        number = str(n)
        existing = db.query(models.Room).filter(models.Room.number == number,
                                                  models.Room.floor_id == payload.floor_id).first()
        if existing:
            continue
        room = models.Room(
            number=number, floor_id=payload.floor_id, bed_count=payload.bed_count,
            attached_bathroom=payload.attached_bathroom, ac=payload.ac, balcony=payload.balcony,
            monthly_rent=payload.monthly_rent, deposit_amount=payload.deposit_amount,
        )
        db.add(room)
        created.append(room)
    db.commit()
    for r in created:
        db.refresh(r)
        sync_beds(r, db)
    db.commit()
    for r in created:
        db.refresh(r)
    return created


@router.put("/{room_id}", response_model=schemas.RoomOut)
def update_room(room_id: int, payload: schemas.RoomUpdate, db: Session = Depends(get_db)):
    room = db.query(models.Room).get(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    sync_beds(room, db)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(models.Room).get(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    db.delete(room)
    db.commit()
    return {"ok": True}


@router.get("/{room_id}/beds", response_model=List[schemas.BedOut])
def room_beds(room_id: int, db: Session = Depends(get_db)):
    return db.query(models.Bed).filter(models.Bed.room_id == room_id).all()


@router.get("/beds/all", response_model=List[schemas.BedOut])
def all_beds(db: Session = Depends(get_db)):
    return db.query(models.Bed).all()
