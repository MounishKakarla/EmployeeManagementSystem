"""Auth schemas — LoginRequest, LoginResponse, ChangePasswordDTO, etc."""

from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    refreshToken: str


class RefreshTokenRequest(BaseModel):
    refreshToken: str


class ChangePasswordDTO(BaseModel):
    oldPassword: str
    newPassword: str


class PushTokenRequest(BaseModel):
    pushToken: str
