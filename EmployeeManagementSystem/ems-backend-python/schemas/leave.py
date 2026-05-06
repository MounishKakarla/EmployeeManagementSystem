"""Leave schemas — matches LeaveRequestDTO and LeaveBalanceDTO."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

from models.enums import LeaveStatus, LeaveType


class LeaveRequestCreate(BaseModel):
    leaveType: LeaveType
    startDate: date
    endDate: date
    reason: Optional[str] = None


class LeaveReviewRequest(BaseModel):
    action: LeaveStatus
    reviewNotes: Optional[str] = None


class LeaveRequestDTO(BaseModel):
    id: Optional[int] = None
    empId: str
    employeeName: Optional[str] = None
    department: Optional[str] = None
    profileImage: Optional[str] = None
    leaveType: LeaveType
    startDate: date
    endDate: date
    daysRequested: Optional[int] = None
    reason: Optional[str] = None
    status: LeaveStatus = LeaveStatus.PENDING
    reviewedBy: Optional[str] = None
    reviewedAt: Optional[datetime] = None
    reviewNotes: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaveBalanceDTO(BaseModel):
    empId: str
    employeeName: Optional[str] = None
    year: int
    annualTotal: int = 0
    annualUsed: int = 0
    annualRemaining: int = 0
    annualCarriedForward: int = 0
    annualAccruedThisYear: int = 0
    sickTotal: int = 0
    sickUsed: int = 0
    sickRemaining: int = 0
    casualTotal: int = 0
    casualUsed: int = 0
    casualRemaining: int = 0
    sickCasualTotal: int = 0
    sickCasualUsed: int = 0
    sickCasualRemaining: int = 0
    maternityTotal: Optional[int] = None
    maternityUsed: Optional[int] = None
    maternityRemaining: Optional[int] = None
    paternityTotal: Optional[int] = None
    paternityUsed: Optional[int] = None
    paternityRemaining: Optional[int] = None
    compOffEarned: int = 0
    compOffUsed: int = 0
    compOffRemaining: int = 0
    unpaidUsed: int = 0
    accrualNote: Optional[str] = None


class LeaveGrantRequest(BaseModel):
    leaveType: LeaveType
    startDate: date
    endDate: date
    reason: Optional[str] = None
