from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ExtensionLoginRequest,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)
from app.services.users import (
    authenticate_extension_user,
    authenticate_user,
    create_user,
    update_user_profile,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    return create_user(db=db, payload=payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login with email or login",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    return authenticate_user(db=db, payload=payload)


@router.post(
    "/extension-login",
    response_model=AuthResponse,
    summary="Login browser extension with extension code",
)
def extension_login(
    payload: ExtensionLoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    return authenticate_extension_user(db=db, payload=payload)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
)
def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return update_user_profile(db=db, user=current_user, payload=payload)
