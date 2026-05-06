"""HolidayCalendar ORM model — maps to the 'holiday_calendar' table."""

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, String, Text, func

from core.database import Base


class HolidayCalendar(Base):
    __tablename__ = "holiday_calendar"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    holiday_date = Column(Date, unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    is_mandatory = Column(Boolean, default=True)
    created_by = Column(String(20))
    created_at = Column(DateTime, server_default=func.now())
