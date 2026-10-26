"""apps/studycafe/backend/db/studycafe_ai_service.py - 스터디카페 AI 혼잡도 예측 및 1:1 학습 튜터 케어 서비스"""
from shared.ai.gemini_client import GeminiClient
import json


class StudyCafeAIService(GeminiClient):
    """스터디카페 AI 혼잡도 분석 및 학습 케어(1:1 튜터) 서비스"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 스마트 스터디카페 운영 및 학습 케어 전문 AI 튜터이다. "
                "1) 좌석 점유율 및 혼잡도를 정밀 예측하고, "
                "2) 학생들의 질문에 친절하고 명확한 공부 답변과 핵심 개념 정리, 공부 팁을 3문장 이내로 제공한다."
            ),
        )

    async def predict_congestion(self, current_occupied: int, total_seats: int, hour: int = 15) -> dict:
        """현재 시간 및 점유 상태 기반 혼잡도 예측"""
        if not self.is_available:
            return self._mock_congestion(current_occupied, total_seats, hour)

        prompt = f"""
현재 스터디카페 상태:
- 총 좌석 수: {total_seats}석 (A-01~A-20)
- 현재 사용 중: {current_occupied}석 (점유율 {int(current_occupied/total_seats*100) if total_seats else 0}%)
- 현재 시각: {hour}시

다음 JSON 형식으로 반드시 답하세요:
{{
  "congestionLevel": "여유/보통/혼잡/매우혼잡",
  "congestionScore": 45,
  "peakHourPrediction": "오후 4시~7시 예상",
  "recommendedZone": "🎯 포커스존 (A-01 ~ A-08)",
  "recommendedSeatType": "집중 1인실 (A-01~A-08 포커스존)",
  "aiAdvice": "현재 포커스존 좌석이 비교적 여유로우며 조용한 몰입 학습에 최적화된 시간대입니다."
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "congestionLevel" in parsed:
                return parsed
            return self._mock_congestion(current_occupied, total_seats, hour)
        except Exception:
            return self._mock_congestion(current_occupied, total_seats, hour)

    async def ask_study_assistant(self, question: str, subject: str = "General", user_type: str = "GENERAL") -> dict:
        """오리지널 studycafe Gemini AI 학습 질문/답변 튜터링 (관리형 케어 포함)"""
        care_mode = "관리형 집중 케어 모드" if user_type == "MANAGED" else "일반 학습 도우미 모드"
        
        if not self.is_available:
            return {
                "success": True,
                "subject": subject,
                "question": question,
                "user_type": user_type,
                "answer": f"[{care_mode}] '{question}'에 대한 핵심 개념 요약입니다. 기본 원리를 파악한 후 3단계 심화 문제 풀이로 접근하면 쉽게 해결할 수 있습니다.",
                "study_tip": "포커스존에서 50분 집중 후 10분 휴식을 취하는 포모도로 학습법을 추천합니다.",
            }

        prompt = f"""
과목: {subject}
학습자 유형: {user_type} ({care_mode})
질문: {question}

학생에게 친절하고 명확하게 공부 답변과 설명 및 공부 팁을 3문장 이내로 제공해주세요.
반드시 아래 JSON 형식으로 응답하세요:
{{
  "answer": "핵심 개념 설명 및 풀이 접근법",
  "study_tip": "오늘의 추천 공부 팁"
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            return {
                "success": True,
                "subject": subject,
                "question": question,
                "user_type": user_type,
                "answer": parsed.get("answer", result),
                "study_tip": parsed.get("study_tip", "50분 집중 후 10분 스트레칭을 추천합니다."),
            }
        except Exception:
            return {
                "success": True,
                "subject": subject,
                "question": question,
                "user_type": user_type,
                "answer": result or f"'{question}'에 대한 개념 복습을 권장합니다.",
                "study_tip": "핵심 키워드를 요약하여 마인드맵을 작성해 보세요.",
            }

    def _mock_congestion(self, current_occupied: int, total_seats: int, hour: int) -> dict:
        rate = int(current_occupied / total_seats * 100) if total_seats else 30
        level = "혼잡" if rate > 70 else "보통" if rate > 40 else "여유"
        return {
            "congestionLevel": level,
            "congestionScore": rate,
            "peakHourPrediction": "오후 4시~8시",
            "recommendedZone": "🎯 포커스존 (A-01 ~ A-08)",
            "recommendedSeatType": "집중 1인실 (A-01 ~ A-08)",
            "aiAdvice": f"현재 점유율은 {rate}%로 {level} 상태입니다. 포커스존에서 조용한 집중 학습을 권장합니다.",
        }
