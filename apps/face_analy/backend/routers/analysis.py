"""
apps/face_analy/backend/routers/analysis.py
Face Analysis router (Teto vs Egen) using shared GeminiClient & QuotaManager.
"""
import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from shared.ai.gemini_client import GeminiClient
from shared.utils.quota_manager import get_client_identifier, check_and_increment_quota
from shared.core.exceptions import RateLimitError

logger = logging.getLogger("mqnet.face_analy")

router = APIRouter(prefix="", tags=["Face Analysis (Teto/Egen)"])

# 현실적 기본 fallback 응답
FALLBACK_TETO = {
    "type": "TETO",
    "confidence": 88,
    "description": "선명하고 또렷한 눈매와 시크한 턱선 라인이 매력적인 전형적인 테토상입니다. 도시적이고 당당한 매력이 돋보입니다.",
    "traits": [
        {"label": "눈매", "value": "시크하고 날렵한 고양이상 눈매"},
        {"label": "얼굴선", "value": "또렷하고 세련된 페이스 라인"},
        {"label": "전체 무드", "value": "트렌디하고 자신감 있는 아우라"},
    ],
    "stylingAdvice": {
        "fashion": "블랙 & 뉴트럴 톤의 세련된 모던 수트 또는 스트릿웨어",
        "makeup": "또렷한 음영 메이크업과 포인트 립 연출",
        "hair": "슬릭 댄디컷 또는 깔끔한 테슬컷",
        "vibe": "미니멀하고 세련된 도시적 무드 극대화",
    },
}


class AnalyzeRequest(BaseModel):
    image: str  # Base64 data URL or raw base64 string
    user_id: Optional[str] = None


@router.post("/analyze")
async def analyze_face_type(request: Request, payload: AnalyzeRequest):
    if not payload.image:
        raise HTTPException(status_code=400, detail="이미지 데이터가 전달되지 않았습니다.")

    # 공통 쿼터 관리: 일일 무료 5회 제한
    client_id = get_client_identifier(request, payload.user_id)
    try:
        check_and_increment_quota(app_id="face_analy", client_key=client_id, daily_limit=5)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)

    api_key = os.getenv("GEMINI_API_KEY", "")
    client = GeminiClient(api_key=api_key, model="gemini-2.5-flash")

    system_instruction = (
        "당신은 관상학 및 얼굴 분석 전문가입니다. 사용자의 얼굴 사진을 보고 '테토상(TETO)'과 '에겐상(EGEN)' 중 어느 쪽에 더 가까운지 분석합니다.\n"
        "- 테토상 (TETO): 눈매가 날카롭거나 시크한 느낌, 세련되고 도시적인 이미지, 고양이상이나 여우상에 가까운 특징.\n"
        "- 에겐상 (EGEN): 눈매가 둥글고 부드러운 느낌, 친근하고 따뜻한 이미지, 강아지상이나 토끼상에 가까운 특징.\n\n"
        "반드시 다음 JSON 형식으로만 응답하세요:\n"
        "{\n"
        '  "type": "TETO" 또는 "EGEN",\n'
        '  "confidence": 0~100 정수,\n'
        '  "description": "상세한 분석 사유 (한국어)",\n'
        '  "traits": [\n'
        '    {"label": "눈매", "value": "시크하고 또렷한 눈매"},\n'
        '    {"label": "얼굴형", "value": "세련된 V라인"},\n'
        '    {"label": "분위기", "value": "도시적이고 당당한 무드"}\n'
        "  ],\n"
        '  "stylingAdvice": {\n'
        '    "fashion": "모던 미니멀룩 또는 시크 스트릿",\n'
        '    "makeup": "캣츠아이 아이라인 & 매트 립",\n'
        '    "hair": "슬릭백 또는 깔끔한 스트레이트",\n'
        '    "vibe": "자신감 넘치는 세련된 아우라 연출"\n'
        "  }\n"
        "}"
    )

    prompt = f"{system_instruction}\n\n이 사진 속 인물의 얼굴을 분석하여 지정된 JSON으로 반환해주세요."
    result = await client.generate_structured_with_image(
        prompt=prompt,
        image_base64=payload.image,
        fallback_data=FALLBACK_TETO,
    )

    return result
