import os
import shutil
import datetime as dt
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import DB_PATH, BACKUP_DIR

router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.post("/create")
def create_backup():
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"backup_{timestamp}.db")
    shutil.copy2(DB_PATH, dest)
    return {"file": os.path.basename(dest)}


@router.get("/download")
def download_backup():
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"backup_{timestamp}.db")
    shutil.copy2(DB_PATH, dest)
    return FileResponse(dest, filename=f"pg_backup_{timestamp}.db")


@router.get("/list")
def list_backups():
    files = sorted(os.listdir(BACKUP_DIR), reverse=True)
    return [{"name": f, "size_kb": round(os.path.getsize(os.path.join(BACKUP_DIR, f)) / 1024, 1)} for f in files]


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)):
    tmp_path = DB_PATH + ".incoming"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    # basic sanity check: sqlite files start with this header
    with open(tmp_path, "rb") as f:
        header = f.read(16)
    if not header.startswith(b"SQLite format 3"):
        os.remove(tmp_path)
        return {"ok": False, "error": "Not a valid SQLite database file"}
    safety_copy = DB_PATH + ".before_restore"
    shutil.copy2(DB_PATH, safety_copy)
    shutil.move(tmp_path, DB_PATH)
    return {"ok": True, "message": "Restored. Please restart the application."}
