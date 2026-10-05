"""
apps/studycafe/backend/routers/auth.py
Auth and User registration router for StudyCafe.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from apps.studycafe.backend.db.database import get_db
import apps.studycafe.backend.models as models
from apps.studycafe.backend.schemas import UserCreate, UserResponse

router = APIRouter(prefix="", tags=["StudyCafe Auth & Users"])


@router.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.phone == user.phone).first()
    if db_user:
        if user.user_type:
            db_user.user_type = user.user_type
        if user.name:
            db_user.name = user.name
        db.commit()
        db.refresh(db_user)
        return {
            "id": db_user.id,
            "name": db_user.name,
            "phone": db_user.phone,
            "user_type": db_user.user_type
        }
    
    new_user = models.StudyCafeUser(
        name=user.name,
        phone=user.phone,
        pin_code=user.pin or user.phone[-4:],
        user_type=user.user_type or "GENERAL"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id": new_user.id,
        "name": new_user.name,
        "phone": new_user.phone,
        "user_type": new_user.user_type
    }


@router.post("/login-pin")
def login_with_pin(phone: str, pin: str, db: Session = Depends(get_db)):
    user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.phone == phone).first()
    if not user or user.pin_code != pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="전화번호 또는 PIN 번호가 일치하지 않습니다."
        )
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "user_type": user.user_type
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.StudyCafeUser).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "phone": u.phone,
            "user_type": u.user_type
        }
        for u in users
    ]
