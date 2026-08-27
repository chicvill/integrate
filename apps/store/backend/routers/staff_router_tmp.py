import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from shared.core.base_database import get_db
from apps.store.backend.models import Order, KitchenTicket, StoreUser, Product

router = APIRouter()

ROLE_HIERARCHY = {'OWNER': 3, 'MANAGER': 2, 'STAFF': 1, 'CUSTOMER': 0}

def require_role(min_role: str, x_store_role: str = Header(default='STAFF')):
    role = x_store_role.upper()
    if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get(min_role, 99):
        raise HTTPException(status_code=403, detail=f'이 기능은 {min_role} 이상의 권한이 필요합니다. (현재: {role})')
    return role
