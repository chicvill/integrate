"""apps/ai_gwansang/backend/services/gwansang_ai_service.py - 관상 AI 서비스"""
import json
from shared.ai.gemini_client import GeminiClient


class GwansangAIService(GeminiClient):
    """
    AI 관상 분석 서비스.
    GeminiClient를 상속하여 관상 분석에 특화된 메서드를 추가합니다.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 30년 경력의 정통 동양 관상가이다. "
                "얼굴의 이목구비, 눈썹, 이마, 턱, 피부 등의 특징을 세밀하게 분석하여 "
                "재물운, 연애운, 직업운, 건강운을 한국어로 분석한다. "
                "분석은 구체적이고 따뜻하며 긍정적인 방향으로 제시한다."
            )
        )

    async def analyze_face(self, image_base64: str, user_name: str) -> dict:
        """얼굴 이미지 관상 분석"""
        if not self.is_available:
            return self._mock_gwansang_result(user_name)

        prompt = f"""
사용자 이름: {user_name}님

이 분의 얼굴을 관상학적으로 분석하여 다음 JSON 형식으로 반드시 답하세요:
{{
  "animalType": "동물상 (예: 지혜로운 여우상)",
  "animalDescription": "해당 동물상 설명 (2-3문장)",
  "overallScore": 85,
  "personality": "성격 분석 (3-4문장)",
  "wealthLuck": "{user_name}님의 재물운 (3-4문장)",
  "careerLuck": "직업운 (3-4문장)",
  "loveLuck": "연애운 (3-4문장)",
  "healthLuck": "건강운 (2-3문장)",
  "advice": "오늘의 조언 (2-3문장)"
}}
        """
        fallback = self._mock_gwansang_result(user_name)
        return await self.generate_structured_with_image(
            prompt=prompt,
            image_base64=image_base64,
            fallback_data=fallback,
        )

    def _mock_gwansang_result(self, user_name: str) -> dict:
        return {
            "animalType": "지혜로운 백조상",
            "animalDescription": "눈매가 차분하고 고요하며 얼굴선이 정돈되어 있어 신뢰감을 줍니다.",
            "overallScore": 88,
            "personality": "차분하고 신중하며 주변 사람들에게 안정감을 주는 성격입니다.",
            "wealthLuck": f"{user_name}님은 꾸준한 노력으로 재물을 안정적으로 쌓는 흐름입니다.",
            "careerLuck": "명확한 판단력과 리더십이 있어 장기적으로 성과를 만들어냅니다.",
            "loveLuck": "인연을 천천히 바라보는 타입이라 깊고 믿음직한 관계를 만들어갑니다.",
            "healthLuck": "규칙적인 생활을 유지하면 건강을 잘 관리할 수 있습니다.",
            "advice": "오늘의 선택은 장기적인 흐름에 유리합니다. 차분하게 실행하세요.",
        }
