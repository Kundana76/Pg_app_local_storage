from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULTS = {
    "pg_name": "My PG",
    "owner_name": "",
    "phone": "",
    "address": "",
    "gst": "",
    "receipt_prefix": "RCPT",
    "currency": "\u20b9",
    "theme": "light",
}


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    rows = {r.key: r.value for r in db.query(models.Setting).all()}
    out = dict(DEFAULTS)
    out.update(rows)
    return out


@router.put("")
def update_settings(payload: dict, db: Session = Depends(get_db)):
    for key, value in payload.items():
        row = db.query(models.Setting).get(key)
        if row:
            row.value = str(value)
        else:
            db.add(models.Setting(key=key, value=str(value)))
    db.commit()
    return get_settings(db)
