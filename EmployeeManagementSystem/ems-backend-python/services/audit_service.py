"""Audit service — mirrors AuditServiceImpl.java."""

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def log(db: Session, user: str, action: str, target: str) -> None:
    db.add(AuditLog(user=user, action=action, target=target))
    db.commit()


def get_all_logs(db: Session, page: int, size: int):
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return items, total


def search_logs(db: Session, user: str | None, action: str | None,
                target: str | None, page: int, size: int):
    query = db.query(AuditLog)
    if user and user.strip():
        query = query.filter(AuditLog.user == user.strip())
    if action and action.strip():
        query = query.filter(sa_func.lower(AuditLog.action).like(f"%{action.strip().lower()}%"))
    if target and target.strip():
        query = query.filter(sa_func.lower(AuditLog.target).like(f"%{target.strip().lower()}%"))
    query = query.order_by(AuditLog.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return items, total


def get_logs_by_user(db: Session, emp_id: str, page: int, size: int):
    query = db.query(AuditLog).filter(AuditLog.user == emp_id).order_by(AuditLog.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    return items, total


def to_dto(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "user": a.user,
        "action": a.action,
        "target": a.target,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }
