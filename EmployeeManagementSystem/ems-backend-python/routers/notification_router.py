"""Notification router — mirrors NotificationController.java."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from core.pagination import spring_page_response
from services import notification_service

router = APIRouter(prefix="/ems/notifications", tags=["Notification"])


@router.get("/my")
def my_notifications(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                     user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    items, total = notification_service.get_my_notifications(db, user["emp_id"], page, size)
    return spring_page_response(items, total, page, size)


@router.get("/unread-count")
def unread_count(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"count": notification_service.get_unread_count(db, user["emp_id"])}


@router.put("/{id}/read")
def mark_read(id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_service.mark_notification_read(db, id, user["emp_id"])
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_service.mark_all_read(db, user["emp_id"])
    return {"message": "All marked as read"}
