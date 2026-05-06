"""Employee schema — matches EmployeeDTO.java exactly."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class EmployeeCreate(BaseModel):
    name: str
    companyEmail: str
    personalEmail: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    skills: Optional[str] = None
    dateOfJoin: Optional[date] = None
    dateOfBirth: Optional[date] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    profileImage: Optional[str] = None
    roles: list[str] = ["EMPLOYEE"]


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    personalEmail: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    skills: Optional[str] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    profileImage: Optional[str] = None


class EmployeeDTO(BaseModel):
    empId: str
    name: str
    companyEmail: Optional[str] = None
    personalEmail: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    skills: Optional[str] = None
    dateOfJoin: Optional[date] = None
    dateOfBirth: Optional[date] = None
    dateOfExit: Optional[date] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    profileImage: Optional[str] = None
    isEmployeeActive: Optional[bool] = True
    roles: Optional[list[str]] = None

    class Config:
        from_attributes = True


class ProfileImageUpdate(BaseModel):
    profileImage: Optional[str] = None
