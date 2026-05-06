"""Audit service — business logic only; all DB access via AuditRepository."""

from sqlalchemy.orm import Session

from models.audit_log import AuditLog
from repositories.audit_repository import AuditRepository


def log(db: Session, user: str, action: str, target: str) -> None:
    repo = AuditRepository(db)
    repo.save(AuditLog(user=user, action=action, target=target))
    repo.commit()


def get_all_logs(db: Session, page: int, size: int):
    return AuditRepository(db).find_all_paginated(page * size, size)


def search_logs(db: Session, user: str | None, action: str | None,
                target: str | None, page: int, size: int):
    return AuditRepository(db).search(user, action, target, page * size, size)


def get_logs_by_user(db: Session, emp_id: str, page: int, size: int):
    return AuditRepository(db).find_by_user(emp_id, page * size, size)


def to_dto(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "user": a.user,
        "action": a.action,
        "target": a.target,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }
