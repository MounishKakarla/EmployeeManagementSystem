"""HolidayCalendar schema."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class HolidayCalendarDTO(BaseModel):
    id: Optional[int] = None
    holidayDate: date
    name: str
    description: Optional[str] = None
    isMandatory: Optional[bool] = True
    createdBy: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True
