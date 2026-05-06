"""Notification service — business logic only; all DB access via repositories."""

import logging
import httpx
from sqlalchemy.orm import Session

from models.notification import Notification
from repositories.notification_repository import NotificationRepository
from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _persist(db: Session, emp_id: str, title: str, body: str,
             category: str, related_id: int | None) -> None:
    try:
        repo = NotificationRepository(db)
        repo.save(Notification(
            emp_id=emp_id, title=title, body=body,
            category=category, related_id=related_id, read=False,
        ))
        repo.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Failed to persist notification for %s: %s", emp_id, e)


def _push_to_device(db: Session, emp_id: str, title: str, body: str,
                    category: str, related_id: int | None) -> None:
    user = UserRepository(db).find_by_emp_id(emp_id)
    if not user or not user.push_token:
        return
    try:
        unread = NotificationRepository(db).count_unread(emp_id)
        payload = {
            "to": user.push_token,
            "title": title,
            "body": body,
            "sound": "default",
            "channelId": "default",
            "priority": "high",
            "badge": unread,
            "data": {"category": category, "relatedId": related_id or 0},
        }
        with httpx.Client(timeout=10.0) as client:
            client.post(EXPO_PUSH_URL, json=payload, headers={"Accept": "application/json"})
        logger.info("Push sent → %s | %s", emp_id, title)
    except Exception as e:
        logger.warning("Push failed → %s : %s", emp_id, e)


def _to_dto(n) -> dict:
    return {
        "id": n.id, "empId": n.emp_id, "title": n.title, "body": n.body,
        "category": n.category, "relatedId": n.related_id,
        "read": n.read, "createdAt": n.created_at.isoformat() if n.created_at else None,
    }


def get_my_notifications(db: Session, emp_id: str, page: int, size: int):
    items, total = NotificationRepository(db).find_by_emp_paginated(emp_id, page * size, size)
    return [_to_dto(n) for n in items], total


def get_unread_count(db: Session, emp_id: str) -> int:
    return NotificationRepository(db).count_unread(emp_id)


def mark_notification_read(db: Session, notification_id: int, emp_id: str) -> None:
    repo = NotificationRepository(db)
    n = repo.find_by_id(notification_id)
    if n and n.emp_id == emp_id:
        n.read = True
        repo.commit()


def mark_all_read(db: Session, emp_id: str) -> None:
    repo = NotificationRepository(db)
    repo.mark_all_read(emp_id)
    repo.commit()


def send_leave_status_notification(db: Session, emp_id: str, status: str,
                                   leave_type: str, review_notes: str | None,
                                   leave_id: int | None) -> None:
    approved = status == "APPROVED"
    title = "Leave Approved ✅" if approved else "Leave Rejected ❌"
    friendly = leave_type.replace("_", " ").lower()
    body = f"Your {friendly} leave request has been {'approved' if approved else 'rejected'}."
    if not approved and review_notes:
        body += f" Note: {review_notes}"
    _persist(db, emp_id, title, body, "LEAVE", leave_id)
    _push_to_device(db, emp_id, title, body, "LEAVE", leave_id)


def send_timesheet_status_notification(db: Session, emp_id: str, status: str,
                                       week_start: str, review_notes: str | None,
                                       timesheet_id: int | None) -> None:
    approved = status == "APPROVED"
    title = "Timesheet Approved ✅" if approved else "Timesheet Rejected ❌"
    body = f"Your timesheet for week of {week_start} has been {'approved' if approved else 'rejected'}."
    if not approved and review_notes:
        body += f" Note: {review_notes}"
    _persist(db, emp_id, title, body, "TIMESHEET", timesheet_id)
    _push_to_device(db, emp_id, title, body, "TIMESHEET", timesheet_id)
