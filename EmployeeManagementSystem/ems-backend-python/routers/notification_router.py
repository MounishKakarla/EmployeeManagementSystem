"""Notification router — mirrors NotificationController.java."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from core.pagination import spring_page_response
from models.notification import Notification

router = APIRouter(prefix="/ems/notifications", tags=["Notification"])


@router.get("/my")
def my_notifications(page: int = Query(0, ge=0), size: int = Query(10, ge=1),
                     user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    emp_id = user["emp_id"]
    query = db.query(Notification).filter(Notification.emp_id == emp_id).order_by(Notification.created_at.desc())
    total = query.count()
    items = query.offset(page * size).limit(size).all()
    dtos = [{
        "id": n.id, "empId": n.emp_id, "title": n.title, "body": n.body,
        "category": n.category, "relatedId": n.related_id,
        "read": n.read, "createdAt": n.created_at.isoformat() if n.created_at else None,
    } for n in items]
    return spring_page_response(dtos, total, page, size)


@router.get("/unread-count")
def unread_count(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(Notification).filter(
        Notification.emp_id == user["emp_id"], Notification.read == False
    ).count()
    return {"count": count}


@router.put("/{id}/read")
def mark_read(id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == id, Notification.emp_id == user["emp_id"]).first()
    if n:
        n.read = True
        db.commit()
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.emp_id == user["emp_id"], Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"message": "All marked as read"}
