"""
apps/grammer/backend/routers/grammer_router.py
Grammar Quest AI tutoring & progress API router using shared modules.
"""
import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from shared.ai.gemini_client import GeminiClient
from shared.utils.quota_manager import get_client_identifier, check_and_increment_quota
from shared.core.exceptions import RateLimitError
from apps.grammer.backend.config import settings

logger = logging.getLogger("mqnet.grammer")

router = APIRouter(prefix="", tags=["Grammar Quest (AI 영문법)"])

# 메모리 기반 간단 진행도/점수 캐시
_scores_history = []


class ExplainRequest(BaseModel):
    sentence: str
    target_grammar: Optional[str] = "일반 문법"
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    user_id: Optional[str] = None


class ProgressRecordRequest(BaseModel):
    grade_level: str
    score: int
    total: int
    duration_seconds: int
    user_name: Optional[str] = "학습자"


@router.post("/explain", summary="AI 영문법 즉석 해설")
async def explain_grammar(request: Request, payload: ExplainRequest):
    """주어진 영어 문장과 문법 개념에 대해 1:1 맞춤형 AI 해설을 제공합니다."""
    client_id = get_client_identifier(request, payload.user_id)
    try:
        check_and_increment_quota(app_id="grammer", client_key=client_id, daily_limit=20)
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=e.message)

    api_key = os.getenv("GEMINI_API_KEY", "")
    client = GeminiClient(api_key=api_key, model="gemini-2.5-flash")

    prompt = f"""
당신은 대한민국 최고의 영어 교육 전문가이자 친절한 AI 영문법 튜터입니다.
다음 문제/문장에 대해 학생이 이해하기 쉽게 핵심 규칙을 짚어주고 오답 원인을 명쾌하게 설명해주세요.

[문장]: {payload.sentence}
[핵심 문법 영역]: {payload.target_grammar}
[학생의 답안]: {payload.user_answer or '미제출'}
[정답]: {payload.correct_answer or '문장 분석'}

반드시 다음 JSON 형식으로만 답하세요:
{{
  "summary": "한 줄 핵심 규칙 요약",
  "explanation": "학생 눈높이에 맞춘 상세 해설 (2-3문단)",
  "commonMistakes": "학생들이 자주 헷갈리는 함정 포인트",
  "recommendedExample": "동일 문법 규칙이 쓰인 추가 추천 예문"
}}
    """

    fallback = {
        "summary": f"{payload.target_grammar}의 기본 원칙을 숙지하세요.",
        "explanation": f"주어진 문장 '{payload.sentence}'에서는 주어와 동사의 일치 및 시제 규칙을 주의 깊게 살펴보아야 합니다.",
        "commonMistakes": "주어의 인칭과 시제 변화에 따른 동사 형태 변화 혼동",
        "recommendedExample": "The researchers analyze the data carefully every day."
    }

    result = await client.generate_structured(prompt=prompt, fallback_data=fallback)
    return result


@router.post("/progress", summary="학습 스코어 기록")
async def record_progress(payload: ProgressRecordRequest):
    """완료된 퀘스트 점수 및 학습 시간을 기록합니다."""
    entry = {
        "user_name": payload.user_name,
        "grade_level": payload.grade_level,
        "score": payload.score,
        "total": payload.total,
        "accuracy": round((payload.score / max(1, payload.total)) * 100, 1),
        "duration_seconds": payload.duration_seconds,
    }
    _scores_history.append(entry)
    # 최근 50건 유지
    if len(_scores_history) > 50:
        _scores_history.pop(0)
    return {"success": True, "saved": entry}


@router.get("/rankings", summary="명예의 전당 / 실시간 랭킹")
async def get_rankings():
    """최근 우수 학습자 랭킹 목록을 반환합니다."""
    sorted_history = sorted(_scores_history, key=lambda x: (x["score"], -x["duration_seconds"]), reverse=True)
    return sorted_history[:10]
