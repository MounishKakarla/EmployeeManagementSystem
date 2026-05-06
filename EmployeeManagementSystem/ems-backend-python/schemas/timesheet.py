"""Timesheet schema — matches TimesheetDTO.java."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

from models.enums import TimesheetStatus


class TimesheetDTO(BaseModel):
    id: Optional[int] = None
    empId: Optional[str] = None
    employeeName: Optional[str] = None
    department: Optional[str] = None
    profileImage: Optional[str] = None
    weekStartDate: date
    project: Optional[str] = None
    taskDescription: Optional[str] = None
    startTime: Optional[time] = None
    endTime: Optional[time] = None
    mondayHours: Optional[Decimal] = Decimal("0")
    tuesdayHours: Optional[Decimal] = Decimal("0")
    wednesdayHours: Optional[Decimal] = Decimal("0")
    thursdayHours: Optional[Decimal] = Decimal("0")
    fridayHours: Optional[Decimal] = Decimal("0")
    saturdayHours: Optional[Decimal] = Decimal("0")
    sundayHours: Optional[Decimal] = Decimal("0")
    totalHours: Optional[Decimal] = Decimal("0")
    status: Optional[TimesheetStatus] = None
    submittedAt: Optional[datetime] = None
    approvedBy: Optional[str] = None
    approvedAt: Optional[datetime] = None
    reviewNotes: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimesheetReviewRequest(BaseModel):
    action: TimesheetStatus
    reviewNotes: Optional[str] = None


class TimesheetSubmitRequest(BaseModel):
    weekStartDate: date
