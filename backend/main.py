import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, Base
import models  # noqa: F401  (registers models on Base)
from routers import floors, rooms, tenants, staff, expenses, income, rent, dashboard, settings, backup

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PG Management System")

app.include_router(floors.router)
app.include_router(rooms.router)
app.include_router(tenants.router)
app.include_router(staff.router)
app.include_router(expenses.router)
app.include_router(income.router)
app.include_router(rent.router)
app.include_router(dashboard.router)
app.include_router(settings.router)
app.include_router(backup.router)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

app.mount("/vendor", StaticFiles(directory=os.path.join(FRONTEND_DIR, "vendor")), name="vendor")
app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets") \
    if os.path.isdir(os.path.join(FRONTEND_DIR, "assets")) else None


@app.get("/app.js")
def app_js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"), media_type="application/javascript")


@app.get("/style.css")
def style_css():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"), media_type="text/css")


@app.get("/")
def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8642)
