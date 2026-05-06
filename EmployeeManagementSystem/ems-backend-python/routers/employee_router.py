"""Employee router — mirrors EmployeeController.java."""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from core.pagination import spring_page_response
from schemas.employee import EmployeeCreate, EmployeeUpdate, ProfileImageUpdate
from services import employee_service

router = APIRouter(prefix="/ems", tags=["Employee"])


@router.post("/employee")
def create(dto: EmployeeCreate, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    return employee_service.create_employee(db, dto.model_dump(), user["emp_id"])


@router.get("/profile")
def my_profile(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return employee_service.get_employee_by_id(db, user["emp_id"])


@router.get("/employee/{empId}")
def get_by_id(empId: str, user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    return employee_service.get_employee_by_id(db, empId)


@router.get("/employees")
def search(name: Optional[str] = None, department: Optional[str] = None,
           date: Optional[str] = None, skill: Optional[str] = None,
           page: int = Query(0, ge=0), size: int = Query(10, ge=1),
           user: dict = Depends(require_role("ADMIN", "MANAGER")),
           db: Session = Depends(get_db)):
    from datetime import date as d
    date_param = d.fromisoformat(date) if date else None
    items, total = employee_service.get_employees(db, name, department, date_param, skill, page, size)
    return spring_page_response(items, total, page, size)


@router.get("/employees/inactive")
def inactive(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
             user: dict = Depends(require_role("ADMIN", "MANAGER")),
             db: Session = Depends(get_db)):
    items, total = employee_service.get_inactive_employees(db, page, size)
    return spring_page_response(items, total, page, size)


@router.get("/employee/inactive/{empId}")
def inactive_by_id(empId: str, user: dict = Depends(require_role("ADMIN", "MANAGER")),
                   db: Session = Depends(get_db)):
    return employee_service.get_inactive_employee_by_id(db, empId)


@router.delete("/employee/{empId}")
def deactivate(empId: str, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    employee_service.delete_employee(db, empId, user["emp_id"])
    return {"message": f"Employee {empId} deactivated"}


@router.patch("/update/{empId}")
def update(empId: str, dto: EmployeeUpdate, user: dict = Depends(get_current_user),
           db: Session = Depends(get_db)):
    return employee_service.update_fields(db, empId, dto.model_dump(exclude_none=True), user["emp_id"])


@router.put("/profile/image")
def update_image(dto: ProfileImageUpdate, user: dict = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    return employee_service.update_profile_image(db, user["emp_id"], dto.profileImage)
