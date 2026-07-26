import os
import shutil
import datetime as dt
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "pg_management.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _auto_backup_on_commit(session):
    """Snapshot the DB after every committed change: a rolling
    'latest' copy plus one dated copy per day."""
    try:
        shutil.copy2(DB_PATH, os.path.join(BACKUP_DIR, "autobackup_latest.db"))
        daily_name = f"autobackup_{dt.date.today().isoformat()}.db"
        shutil.copy2(DB_PATH, os.path.join(BACKUP_DIR, daily_name))
    except OSError:
        pass  # never let a backup hiccup break the request


event.listen(SessionLocal, "after_commit", _auto_backup_on_commit)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
