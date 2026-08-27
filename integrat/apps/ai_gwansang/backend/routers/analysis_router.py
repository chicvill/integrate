"""
apps/ai_gwansang/backend/routers/analysis_router.py
AI 관상 분석 전용 API 라우터 (세션 관리, 요금제, 분석)
"""
import uuid
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from shared.core.base_database import get_db
from shared.auth.router import get_current_user_dependency
from shared.auth.models import User
from apps.ai_gwansang.backend.models import GwansangAnalysis
from apps.ai_gwansang.backend.config import get_settings
from apps.ai_gwansang.backend.db.gwansang_ai_service import GwansangAIService

router = APIRouter()

# ─── 요금제 정의 ──────────────────────────────────────────
PLANS = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price": 0,
        "dailyLimit": 3,
        "description": "기본 3회 무료 분석",
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price": 9900,
        "dailyLimit": 100,
        "description": "무제한 고화질 분석 및 심층 리포트",
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 49000,
        "dailyLimit": 9999,
        "description": "다중 지점 관리 및 전용 API 제공",
    },
}


class AnalyzeRequest(BaseModel):
    image_data: Optional[str] = None
    imageData: Optional[str] = None
    user_name: Optional[str] = "사용자"
    userName: Optional[str] = "사용자"
    tenant_id: Optional[str] = "demo-office"
    tenantId: Optional[str] = "demo-office"
    session_id: Optional[str] = None
    sessionId: Optional[str] = None


class SessionCreateRequest(BaseModel):
    tenantId: Optional[str] = "demo-office"
    userName: str


@router.get("/plans", summary="요금제 목록 조회")
async def get_plans():
    return {"plans": list(PLANS.values())}


@router.post("/sessions", summary="관상 분석 세션 생성")
async def create_session(body: SessionCreateRequest):
    session_id = str(uuid.uuid4())
    return {
        "sessionId": session_id,
        "tenantId": body.tenantId or "demo-office",
        "userName": body.userName,
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


@router.get("/tenants/{tenant_id}/sessions", summary="테넌트별 최근 분석 세션 목록")
async def get_tenant_sessions(tenant_id: str, db: Session = Depends(get_db)):
    analyses = db.query(GwansangAnalysis).filter(
        GwansangAnalysis.app_id == "ai_gwansang"
    ).order_by(GwansangAnalysis.created_at.desc()).limit(20).all()

    return {
        "tenantId": tenant_id,
        "sessions": [
            {
                "sessionId": a.id,
                "userName": a.user_name or "사용자",
                "animalType": a.animal_type,
                "score": a.overall_score,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
            }
            for a in analyses
        ]
    }


@router.post("/analyze", summary="AI 관상 분석 (핵심 기능)")
async def analyze_face(
    request: Request,
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    img_data = body.image_data or body.imageData or "sample"
    u_name = body.user_name or body.userName or "사용자"

    # AI 분석 수행 (Gemini 2.5 Flash)
    ai_service = GwansangAIService(api_key=settings.GEMINI_API_KEY)
    result = await ai_service.analyze_face(img_data, u_name)

    # 포맷 정규화 (기존 React 프론트엔드 호환용)
    personality_list = [result.get("personality", "온화하고 신중한 성품")] if isinstance(result.get("personality"), str) else result.get("personality", [])
    
    formatted_result = {
        "userName": u_name,
        "animalType": result.get("animalType", "지혜로운 백조상"),
        "animalDescription": result.get("animalDescription", "눈매가 맑고 총명하여 신뢰감을 줍니다."),
        "score": result.get("overallScore", 88),
        "overallScore": result.get("overallScore", 88),
        "summary": f"{u_name}님의 관상은 전반적으로 기운이 정돈되어 있으며, 특히 재물과 인연의 흐름이 순탄합니다.",
        "personality": personality_list,
        "wealthLuck": result.get("wealthLuck", "성실한 자산 축적 흐름"),
        "careerLuck": result.get("careerLuck", "조직과 기획에서 두각"),
        "loveLuck": result.get("loveLuck", "깊은 신뢰를 쌓는 인연"),
        "healthLuck": result.get("healthLuck", "규칙적인 습관 유지 권장"),
        "advice": result.get("advice", "자신의 직관을 믿고 나아가세요."),
    }

    # DB 저장
    analysis = GwansangAnalysis(
        user_name=u_name,
        app_id=settings.APP_ID,
        animal_type=formatted_result["animalType"],
        overall_score=formatted_result["score"],
        personality=result.get("personality"),
        wealth_luck=formatted_result["wealthLuck"],
        career_luck=formatted_result["careerLuck"],
        love_luck=formatted_result["loveLuck"],
        health_luck=formatted_result["healthLuck"],
        advice=formatted_result["advice"],
        raw_result=formatted_result,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "ok": True,
        "analysis_id": analysis.id,
        "result": formatted_result,
    }