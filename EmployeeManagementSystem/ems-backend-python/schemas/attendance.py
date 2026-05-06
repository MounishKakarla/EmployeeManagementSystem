"""Attendance schemas — matches AttendanceDTO and AttendanceSummaryDTO."""

from datetime import date, time
from typing import Optional
from pydantic import BaseModel

from models.enums import AttendanceStatus


class AttendanceDTO(BaseModel):
    id: Optional[int] = None
    empId: str
    employeeName: Optional[str] = None
    department: Optional[str] = None
    profileImage: Optional[str] = None
    attendanceDate: date
    checkInTime: Optional[time] = None
    checkOutTime: Optional[time] = None
    totalHours: Optional[float] = None
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None
    recordedBy: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceSummaryDTO(BaseModel):
    empId: str
    employeeName: str
    month: int
    year: int
    totalWorkingDays: int = 0
    presentDays: int = 0
    absentDays: int = 0
    halfDays: int = 0
    lateDays: int = 0
    onLeaveDays: int = 0
    workFromHomeDays: int = 0
    holidayDays: int = 0
    weekendDays: int = 0
    totalHoursWorked: Optional[float] = 0.0
    averageHoursPerDay: Optional[float] = 0.0
    attendancePercentage: Optional[float] = 0.0


class CheckInRequest(BaseModel):
    notes: Optional[str] = None
