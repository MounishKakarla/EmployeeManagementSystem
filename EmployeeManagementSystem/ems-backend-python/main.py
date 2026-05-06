"""
main.py — FastAPI application entry point.
Unified EMS Backend + Chatbot on port 8000.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.exceptions import register_exception_handlers

# ── APScheduler setup ─────────────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from scheduler.jobs import mark_absent_employees, mark_holidays_and_weekends, leave_year_end_reset

scheduler = BackgroundScheduler()

# Mark absent — 10:00 AM IST Mon-Fri
scheduler.add_job(mark_absent_employees, CronTrigger(hour=10, minute=0, day_of_week="0-4", timezone="Asia/Kolkata"), id="mark_absent")
# Holiday/Weekend — 00:01 AM IST daily
scheduler.add_job(mark_holidays_and_weekends, CronTrigger(hour=0, minute=1, timezone="Asia/Kolkata"), id="mark_holidays")
# Year-end leave reset — 00:05 AM Jan 1
scheduler.add_job(leave_year_end_reset, CronTrigger(month=1, day=1, hour=0, minute=5, timezone="Asia/Kolkata"), id="leave_year_end")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    logging.info("APScheduler started")
    yield
    scheduler.shutdown()
    logging.info("APScheduler stopped")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="EMS Backend",
    description="Employee Management System — FastAPI + Chatbot (unified on port 8000)",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── EMS API routers ───────────────────────────────────────────────────────────
from routers.auth_router import router as auth_router
from routers.employee_router import router as employee_router
from routers.attendance_router import router as attendance_router
from routers.leave_router import router as leave_router
from routers.timesheet_router import router as timesheet_router
from routers.holiday_router import router as holiday_router
from routers.notification_router import router as notification_router
from routers.role_router import router as role_router
from routers.other_routers import audit_router, db_config_router, import_router

app.include_router(auth_router, prefix="/api")
app.include_router(employee_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(leave_router, prefix="/api")
app.include_router(timesheet_router, prefix="/api")
app.include_router(holiday_router, prefix="/api")
app.include_router(notification_router, prefix="/api")
app.include_router(role_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(db_config_router, prefix="/api")
app.include_router(import_router, prefix="/api")

# ── Chatbot routers (merged from ems-chatbot) ────────────────────────────────
from chatbot.router import router as chatbot_router
from chatbot.resume_router import router as resume_router

app.include_router(chatbot_router, prefix="/api/chatbot")
app.include_router(resume_router, prefix="/api/resume")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "UP", "service": "ems-backend-python"}


# ── Run with uvicorn ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
