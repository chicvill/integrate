"""apps/store/backend/routers/table_router.py - 매장 테이블 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid

from shared.core.base_database import get_db
from apps.store.backend.models import StoreTable
from shared.utils.security import generate_short_code

router = APIRouter()


def _ensure_seed_tables(db: Session, tenant_id: str):
    """기본 매장 테이블 10개 시드 생성"""
    count = db.query(StoreTable).filter(StoreTable.tenant_id == tenant_id).count()
    if count == 0:
        for i in range(1, 11):
            short_code = f"T{i:02d}{generate_short_code(3)}"
            table = StoreTable(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                table_number=f"Table {i:02d}",
                capacity=4 if i <= 8 else 6,
                qr_code=f"https://order.mqnet.io/{tenant_id}/{short_code}",
                qr_short_code=short_code,
                is_occupied=(i in [2, 5]),
                is_available=True,
            )
            db.add(table)
        db.commit()


@router.get("/", summary="전체 테이블 목록 조회")
async def list_tables(
    tenant_id: str = "store-main",
    db: Session = Depends(get_db),
):
    _ensure_seed_tables(db, tenant_id)
    tables = db.query(StoreTable).filter(StoreTable.tenant_id == tenant_id).order_by(StoreTable.table_number).all()
    return {
        "tenant_id": tenant_id,
        "total": len(tables),
        "occupied": sum(1 for t in tables if t.is_occupied),
        "available": sum(1 for t in tables if not t.is_occupied and t.is_available),
        "tables": [
            {
                "id": t.id,
                "table_number": t.table_number,
                "capacity": t.capacity,
                "qr_code": t.qr_code,
                "qr_short_code": t.qr_short_code,
                "is_occupied": t.is_occupied,
                "is_available": t.is_available,
            }
            for t in tables
        ]
    }


class CreateTableRequest(BaseModel):
    table_number: str
    capacity: Optional[int] = 4
    tenant_id: Optional[str] = "store-main"


@router.post("/", summary="새 테이블 등록")
async def create_table(
    body: CreateTableRequest,
    db: Session = Depends(get_db),
):
    short_code = f"T{generate_short_code(5)}"
    table = StoreTable(
        id=str(uuid.uuid4()),
        tenant_id=body.tenant_id,
        table_number=body.table_number,
        capacity=body.capacity,
        qr_code=f"https://order.mqnet.io/{body.tenant_id}/{short_code}",
        qr_short_code=short_code,
        is_occupied=False,
        is_available=True,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return {"message": "테이블이 등록되었습니다.", "table_id": table.id, "qr_short_code": short_code}


@router.get("/{short_code}/verify", summary="QR 코드 유효성 검증")
async def verify_table_qr(
    short_code: str,
    tenant_id: str = "store-main",
    db: Session = Depends(get_db),
):
    table = db.query(StoreTable).filter(
        StoreTable.qr_short_code == short_code,
        StoreTable.tenant_id == tenant_id,
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="존재하지 않는 테이블 QR 코드입니다.")
    return {
        "valid": True,
        "table_id": table.id,
        "table_number": table.table_number,
        "tenant_id": table.tenant_id,
    }
