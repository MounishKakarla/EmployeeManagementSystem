"""Role router — mirrors RoleController.java."""

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import require_role
from services import role_service

router = APIRouter(prefix="/ems", tags=["Role"])


@router.post("/assign/{empId}")
def assign(empId: str, role: str = Body(..., embed=True),
           user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    role_service.assign_role(db, empId, role, user["emp_id"])
    return {"message": f"Role {role} assigned to {empId}"}


@router.post("/remove/{empId}")
def remove(empId: str, role: str = Body(..., embed=True),
           user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    role_service.remove_role(db, empId, role, user["emp_id"])
    return {"message": f"Role {role} removed from {empId}"}


@router.get("/roles/{empId}")
def get_roles(empId: str, user: dict = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    return role_service.get_roles(db, empId)
