"""
SQLAlchemy engine + session factory.
"""
 
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from typing import Generator
 
from core.config import settings
 
logger = logging.getLogger(__name__)
 
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
 
 
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
 
Base = declarative_base()
 
# Import all models so SQLAlchemy knows about them before create_all()
try:
    from models.employee import Employee
    from models.user import User
    from models.roles import UserRoles
    from models.attendance import Attendance
    from models.leave_request import LeaveRequest
    from models.leave_balance import LeaveBalance
    from models.timesheet import Timesheet
    from models.holiday_calendar import HolidayCalendar
    from models.notification import Notification
    from models.audit_log import AuditLog
    logger.info("✓ All models imported successfully")
except Exception as e:
    logger.error(f"✗ Error importing models: {e}")
 
# Auto-create tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Database tables created/verified successfully")
except Exception as e:
    logger.error(f"✗ Error creating database tables: {e}")
 
def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
 
 