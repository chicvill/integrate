"""apps/ai_gwansang/backend/routers/analysis_router.py - 관상 분석 라우터"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from shared.core.base_database import get_db
from shared.auth.router import get_current_user_dependency
from shared.auth.models import User
from apps.ai_gwansang.backend.models import GwansangAnalysis
from apps.ai_gwansang.backend.config import get_settings
from apps.ai_gwansang.backend.db.gwansang_ai_service import GwansangAIService
import datetime

router = APIRouter()

# 비로그인(게스트) 사용자 IP별 일일 사용량 (API 비용 보호용, 메모리 캐시)
_guest_usage: dict = {}


def _check_guest_limit(ip: str, limit: int):
    today = datetime.date.today().isoformat()
    for key in [k for k in _guest_usage if k[1] != today]:
        _guest_usage.pop(key, None)
    count = _guest_usage.get((ip, today), 0)
    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"오늘 무료 관상 횟수({limit}회)를 모두 사용했습니다. 내일 다시 이용해주세요!"
        )
    _guest_usage[(ip, today)] = count + 1


class AnalyzeRequest(BaseModel):
    image_data: str  # base64 인코딩된 이미지
    user_name: Optional[str] = "사용자"


@router.post("/analyze", summary="AI 관상 분석 (핵심 기능)")
async def analyze_face(
    request: Request,
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    """얼굴 이미지를 AI로 관상 분석합니다."""
    settings = get_settings()

    # 비로그인 사용자도 일일 무료 횟수까지 사용 가능
    current_user = None
    try:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            current_user = get_current_user_dependency(request, auth_header, db)
    except Exception:
        pass

    # 일일 사용량 체크 (로그인 사용자)
    if current_user:
        today = datetime.date.today()
        today_count = db.query(GwansangAnalysis).filter(
            GwansangAnalysis.user_id == current_user.id,
            GwansangAnalysis.created_at >= datetime.datetime.combine(today, datetime.time.min),
        ).count()

        if today_count >= settings.DAILY_FREE_COUNT and not current_user.plan_id in ["pro", "enterprise"]:
            raise HTTPException(
                status_code=429,
                detail=f"일일 무료 분석 한도({settings.DAILY_FREE_COUNT}회)를 초과했습니다. 프리미엄으로 업그레이드하세요."
            )

    # 게스트 IP별 일일 한도 체크
    if not current_user:
        fwd = request.headers.get("x-forwarded-for", "")
        client_ip = fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")
        _check_guest_limit(client_ip, max(int(settings.DAILY_FREE_COUNT), 5))

    # AI 분석 수행
    ai_service = GwansangAIService(api_key=settings.GEMINI_API_KEY)
    result = await ai_service.analyze_face(body.image_data, body.user_name)

    # DB에 결과 저장
    analysis = GwansangAnalysis(
        user_id=current_user.id if current_user else None,
        user_name=body.user_name,
        app_id=settings.APP_ID,
        animal_type=result.get("animalType"),
        overall_score=result.get("overallScore"),
        personality=result.get("personality"),
        wealth_luck=result.get("wealthLuck"),
        career_luck=result.get("careerLuck"),
        love_luck=result.get("loveLuck"),
        health_luck=result.get("healthLuck"),
        advice=result.get("advice"),
        raw_result=result,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {"analysis_id": analysis.id, "result": result}
