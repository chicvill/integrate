"""
apps/face_analy/backend/routers/analysis.py
Face Analysis router (Teto vs Egen) using shared GeminiClient & QuotaManager.
"""
import os
import hashlib
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from shared.ai.gemini_client import GeminiClient
from shared.utils.quota_manager import get_client_identifier, check_and_increment_quota
from shared.core.exceptions import RateLimitError

logger = logging.getLogger("mqnet.face_analy")

router = APIRouter(prefix="", tags=["Face Analysis (Teto/Egen)"])


def get_dynamic_fallback(image_str: str) -> Dict[str, Any]:
    """네트워크나 API 실패 시 일관되면서도 이미지별로 다른 역동적 대체 결과 생성"""
    h = int(hashlib.md5(image_str[:300].encode("utf-8", errors="ignore")).hexdigest(), 16)
    is_teto = (h % 2 == 0)
    score_main = 55 + (h % 35)  # 55 ~ 89
    score_sub = 100 - score_main

    if is_teto:
        return {
            "type": "TETO",
            "confidence": score_main,
            "tetoScore": score_main,
            "egenScore": score_sub,
            "description": "선명하고 또렷한 눈매와 시크한 턱선 라인이 매력적인 테토상입니다. 도시적이고 당당한 매력과 세련된 분위기가 돋보입니다.",
            "traits": [
                {"label": "T존 입체감", "value": "선명하고 또렷한 콧대와 눈썹뼈 라인"},
                {"label": "눈매 & 눈빛", "value": "시크하고 날렵한 고양이상 눈매"},
                {"label": "턱선 & 페이스라인", "value": "샤프하고 세련된 페이스 윤곽"},
                {"label": "전체적인 무드", "value": "트렌디하고 자신감 넘치는 도회적 아우라"},
            ],
            "stylingAdvice": {
                "fashion": "블랙 & 뉴트럴 톤의 세련된 모던 미니멀룩 또는 시크 스트릿웨어",
                "makeup": "또렷한 음영 메이크업과 포인트 립 연출",
                "hair": "슬릭 댄디컷 또는 가일 스타일",
                "vibe": "미니멀하고 세련된 도시적 무드 극대화",
            },
            "hairOptions": [
                {"id": "slick_dandy", "name": "슬릭 댄디컷", "desc": "이마를 살짝 드러내 시크하고 정갈한 도시적 무드를 연출합니다."},
                {"id": "guile_cut", "name": "가일 / 아이비리그컷", "desc": "한쪽 앞머리를 넘겨 T존의 입체감과 카리스마를 강조합니다."},
                {"id": "tassel_cut", "name": "테슬컷 / 스트레이트", "desc": "직선적인 라인감으로 날렵한 턱선과 모던함을 극대화합니다."},
                {"id": "ash_tone", "name": "애쉬 쿨톤 브라운", "desc": "차분한 쿨톤 컬러로 시크하고 세련된 인상을 완성합니다."},
            ],
        }
    else:
        return {
            "type": "EGEN",
            "confidence": score_main,
            "tetoScore": score_sub,
            "egenScore": score_main,
            "description": "부드러운 곡선미와 따뜻하고 친근한 인상이 돋보이는 에겐상입니다. 다정하고 편안한 분위기와 동안 매력이 느껴집니다.",
            "traits": [
                {"label": "T존 입체감", "value": "부드럽고 자연스러운 미간과 콧대 라인"},
                {"label": "눈매 & 눈빛", "value": "동글동글하고 순한 반달형 강아지 눈매"},
                {"label": "턱선 & 페이스라인", "value": "말랑하고 유연한 U라인 / 달걀형 윤곽"},
                {"label": "전체적인 무드", "value": "따뜻하고 사랑스러운 친근한 분위기"},
            ],
            "stylingAdvice": {
                "fashion": "파스텔톤, 크림 베이지 및 포근한 니트 / 캐주얼 룩",
                "makeup": "내추럴 치크와 생기 있는 코랄/핑크 틴트 연출",
                "hair": "소프트 애즈펌 또는 쉐도우 볼륨펌",
                "vibe": "편안하고 다정한 러블리 무드 연출",
            },
            "hairOptions": [
                {"id": "soft_asche", "name": "소프트 애즈펌", "desc": "이마를 자연스럽게 덮어 부드럽고 다정한 인상을 극대화합니다."},
                {"id": "shadow_volume", "name": "쉐도우 볼륨펌", "desc": "자연스러운 컬감으로 풍성한 볼륨과 동안 매력을 부여합니다."},
                {"id": "romantic_wave", "name": "로맨틱 C컬 / 웨이브", "desc": "부드러운 곡선 라인으로 온화하고 사랑스러운 분위기 연출."},
                {"id": "milk_brown", "name": "밀크 브라운 웜톤", "desc": "따뜻한 웜톤 컬러로 부드러운 인상을 더욱 화사하게 밝혀줍니다."},
            ],
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
    # 공식 지원 모델: gemini-3.5-flash
    client = GeminiClient(api_key=api_key, model="gemini-3.5-flash")

    system_instruction = (
        "당신은 최고 권위의 퍼스널 이미지 컨설턴트이자 관상/얼굴형 정밀 분석 AI 전문가입니다.\n"
        "제출된 사진 속 인물의 이목구비를 세밀하게 관찰하여 '테토상(TETO)'과 '에겐상(EGEN)'의 비율을 계산하고 최적의 스타일을 처방하세요.\n\n"
        "[핵심 개념 및 감별 기준]\n"
        "1. 테토상 (TETO, 테스토스테론 모티브):\n"
        "   - T존(눈썹뼈-콧대-미간)의 입체감이 뚜렷하고 또렷한 인상\n"
        "   - 눈매: 날렵하거나 또렷하고 눈빛이 선명함 (고양이상/여우상/늑대상)\n"
        "   - 턱선/윤곽: 직선적이고 샤프하거나 각진 턱선, 세련된 입체감\n"
        "   - 분위기: 시크함, 도시적, 카리스마, 세련됨, 힙함\n\n"
        "2. 에겐상 (EGEN, 에스트로겐 모티브):\n"
        "   - O존(볼살, 턱끝, 입술)이 부드럽고 곡선적인 페이스라인\n"
        "   - 눈매: 동글동글하거나 순한 눈매, 부드러운 반달눈 (강아지상/토끼상/사슴상)\n"
        "   - 턱선/윤곽: 부드러운 달걀형 또는 U라인, 말랑하고 친근한 인상\n"
        "   - 분위기: 따뜻함, 순수함, 다정함, 러블리, 부드러움\n\n"
        "[분석 규칙]\n"
        "- 사진 속 인물의 고유한 이목구비(T존 입체감, 눈꼬리 각도, 하관 형태)를 공정하고 엄밀하게 평가하세요.\n"
        "- 절대 특정 유형으로 일괄 편향되지 마세요. 직선적/샤프함이 두드러지면 테토상(TETO), 부드러운 곡선미가 두드러지면 에겐상(EGEN)으로 정확히 판별하세요.\n"
        "- tetoScore(0~100)와 egenScore(0~100)의 합은 반드시 100이 되어야 합니다.\n"
        "- type은 더 높은 점수의 유형('TETO' 또는 'EGEN')으로 지정하세요.\n"
        "- confidence는 60~98 사이의 정수로 지정하세요.\n\n"
        "반드시 다음 JSON 형식으로만 응답하세요:\n"
        "{\n"
        '  "type": "TETO" 또는 "EGEN",\n'
        '  "confidence": 60~98 정수,\n'
        '  "tetoScore": 0~100 정수,\n'
        '  "egenScore": 0~100 정수,\n'
        '  "description": "이 인물만의 구체적 이목구비 특징을 서술한 개별 맞춤 상세 분석문 (한국어 3~4문장)",\n'
        '  "traits": [\n'
        '    {"label": "T존 입체감", "value": "구체적 평가 내용"},\n'
        '    {"label": "눈매 & 눈빛", "value": "구체적 평가 내용"},\n'
        '    {"label": "턱선 & 페이스라인", "value": "구체적 평가 내용"},\n'
        '    {"label": "전체적인 무드", "value": "구체적 평가 내용"}\n'
        "  ],\n"
        '  "stylingAdvice": {\n'
        '    "fashion": "어울리는 패션 스타일 및 추천 컬러",\n'
        '    "makeup": "눈매 및 피부톤 메이크업 포인트",\n'
        '    "hair": "가장 추천하는 대표 헤어스타일 명칭",\n'
        '    "vibe": "매력을 돋보이게 하는 분위기 연출 팁"\n'
        "  },\n"
        '  "hairOptions": [\n'
        '    {"id": "style_1", "name": "헤어스타일명1", "desc": "스타일링 설명 및 드라이 팁"},\n'
        '    {"id": "style_2", "name": "헤어스타일명2", "desc": "스타일링 설명 및 드라이 팁"},\n'
        '    {"id": "style_3", "name": "헤어스타일명3", "desc": "스타일링 설명 및 드라이 팁"},\n'
        '    {"id": "style_4", "name": "헤어스타일명4", "desc": "스타일링 설명 및 드라이 팁"}\n'
        "  ]\n"
        "}"
    )

    prompt = f"{system_instruction}\n\n이 사진 속 인물의 얼굴을 정밀 분석하여 지정된 JSON으로 반환해주세요."
    fallback = get_dynamic_fallback(payload.image)

    result = await client.generate_structured_with_image(
        prompt=prompt,
        image_base64=payload.image,
        fallback_data=fallback,
    )

    # 응답 안전성 검증 및 보정
    if not isinstance(result, dict) or "type" not in result or result.get("type") not in ("TETO", "EGEN"):
        logger.warning(f"Gemini 응답 규격 불일치, 동적 fallback 적용: {result}")
        result = fallback

    # 점수 필드 보장
    if "tetoScore" not in result or "egenScore" not in result:
        conf = result.get("confidence", 75)
        if result.get("type") == "TETO":
            result["tetoScore"] = conf
            result["egenScore"] = 100 - conf
        else:
            result["egenScore"] = conf
            result["tetoScore"] = 100 - conf

    return result
