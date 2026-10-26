import logging
from apps.store.backend.config import settings

logger = logging.getLogger("ai_engine")

class StoreAIEngine:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Gemini Store AI Engine initialized.")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini AI: {e}")

    def analyze_situation_room(self, sales_today: float, order_count: int, low_stock_items: list) -> str:
        """Generates real-time AI Situation Room operational insights."""
        if not self.client:
            stock_str = ", ".join(low_stock_items) if low_stock_items else "없음"
            return (
                f"[상황실 분석 요약]\n"
                f"- 오늘 총 매출: {sales_today:,.0f}원 ({order_count}건 주문 완료)\n"
                f"- 재고 부족 품목: {stock_str}\n"
                f"- AI 상태 진단: 매장 운영 상태가 양호하며 재고 수급을 점검하세요."
            )

        try:
            prompt = (
                f"당신은 매장 종합 상황실(Situation Room) AI 분석관입니다.\n"
                f"오늘 매출: {sales_today}원, 주문 수: {order_count}건, 부족 재고: {low_stock_items}\n"
                f"매장 운영 이상 징후 및 피크 타임 대비 조언을 3문장 이내로 분석해주세요."
            )
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"상황실 분석 중 오류 발생: {str(e)}"

store_ai_engine = StoreAIEngine()
