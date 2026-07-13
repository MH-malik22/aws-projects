from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import auth as auth_svc
from ..database import get_db
from ..models import RefreshToken, User
from ..schemas import LoginIn, RefreshIn, RegisterIn, TokenOut, UserOut, UserPatch
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email.lower(),
        password_hash=auth_svc.hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _issue_tokens(db: AsyncSession, user: User) -> TokenOut:
    token, token_hash, expires = auth_svc.new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return TokenOut(
        access_token=auth_svc.create_access_token(user.id, user.role),
        refresh_token=token,
        expires_in=settings.access_token_minutes * 60,
    )


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not auth_svc.verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    token_hash = auth_svc.hash_refresh_token(body.refresh_token)
    row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    now = datetime.now(timezone.utc)
    if row is None or row.revoked_at is not None or row.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    row.revoked_at = now  # rotation: old token single-use
    user = await db.scalar(select(User).where(User.id == row.user_id))
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=204)
async def logout(
    body: RefreshIn,
    user: User = Depends(auth_svc.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = auth_svc.hash_refresh_token(body.refresh_token)
    row = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash, RefreshToken.user_id == user.id
        )
    )
    if row:
        row.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(auth_svc.get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserPatch,
    user: User = Depends(auth_svc.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.theme_pref is not None:
        user.theme_pref = body.theme_pref
    await db.commit()
    await db.refresh(user)
    return user
