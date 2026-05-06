"""Auth router — mirrors AuthController.java."""

from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user, require_role
from core.config import settings
from schemas.auth import LoginRequest, RefreshTokenRequest, ChangePasswordDTO, PushTokenRequest
from services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    result = auth_service.login(db, req.username, req.password)
    response.set_cookie("access_token", result["token"],
                        httponly=True, secure=settings.cookie_secure,
                        samesite=settings.cookie_same_site, max_age=settings.jwt_access_expiration_ms // 1000)
    response.set_cookie("refresh_token", result["refreshToken"],
                        httponly=True, secure=settings.cookie_secure,
                        samesite=settings.cookie_same_site, max_age=settings.jwt_refresh_expiration_ms // 1000)
    return result


@router.post("/refresh")
def refresh(req: RefreshTokenRequest, response: Response, db: Session = Depends(get_db)):
    # Also check cookie
    token = req.refreshToken
    result = auth_service.refresh_token_fn(db, token)
    response.set_cookie("access_token", result["token"],
                        httponly=True, secure=settings.cookie_secure,
                        samesite=settings.cookie_same_site, max_age=settings.jwt_access_expiration_ms // 1000)
    return result


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me")
def me(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return auth_service.get_current_user_info(db, user["emp_id"])


@router.put("/changePassword")
def change_pw(req: ChangePasswordDTO, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_service.change_password(db, user["emp_id"], req.oldPassword, req.newPassword)
    return {"message": "Password changed successfully"}


@router.put("/push-token")
def push_token(req: PushTokenRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_service.save_push_token(db, user["emp_id"], req.pushToken)
    return {"message": "Push token saved"}


@router.post("/reset-password/{empId}")
def reset_pw(empId: str, user: dict = Depends(require_role("ADMIN", "MANAGER")), db: Session = Depends(get_db)):
    auth_service.reset_password(db, empId)
    return {"message": f"Password reset for {empId}"}
