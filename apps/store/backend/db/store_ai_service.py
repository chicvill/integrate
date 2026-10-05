"""apps/store/backend/db/store_ai_service.py - 매장 AI 메뉴 추천 및 매출 분석 서비스"""
from shared.ai.gemini_client import GeminiClient
import json


class StoreAIService(GeminiClient):
    """매장 주문 분석 및 AI 메뉴 추천 서비스"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 F&B 매장 및 카페 운영 전문 AI 컨설턴트이다. "
                "고객의 주문 내역 및 매장 메뉴를 바탕으로 최고 조합의 사이드/음료 페어링을 추천하고 "
                "매출 증대를 위한 프로모션 조언을 한국어로 제공한다."
            ),
        )

    async def recommend_pairing(self, selected_item: str, all_menus: list) -> dict:
        """선택한 메뉴와 가장 잘 어울리는 사이드/디저트 추천"""
        if not self.is_available:
            return self._mock_pairing(selected_item)

        prompt = f"""
고객이 선택한 대표 메뉴: {selected_item}
매장 내 전체 메뉴 목록: {all_menus}

다음 JSON 형식으로 가장 어울리는 추천 메뉴 2가지와 페어링 이유를 작성하세요:
{{
  "recommendedItems": ["크로플 & 바닐라 아이스크림", "자몽 에이드"],
  "pairingReason": "{selected_item}의 고소하고 쌉싸름한 맛을 크로플의 달콤함과 자몽의 상큼함이 완벽하게 밸런스를 잡아줍니다.",
  "discountOffer": "세트 주문 시 1,000원 할인 프로모션 추천"
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "recommendedItems" in parsed:
                return parsed
            return self._mock_pairing(selected_item)
        except Exception:
            return self._mock_pairing(selected_item)

    def _mock_pairing(self, selected_item: str) -> dict:
        return {
            "recommendedItems": ["크로플 & 바닐라 아이스크림", "바질 치킨 파니니"],
            "pairingReason": f"{selected_item}과 함께 곁들이면 한 끼 식사나 디저트로 만족도가 가장 높은 인기 조합입니다.",
            "discountOffer": "세트 주문 시 1,000원 할인 추천",
        }
