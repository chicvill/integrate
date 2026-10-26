"""apps/selfstudy/backend/services/ai_service.py - 자기주도학습 AI 서비스"""
from shared.ai.gemini_client import GeminiClient


class StudyAIService(GeminiClient):
    """
    자기주도학습 전용 AI 멘토 서비스.
    GeminiClient를 상속하여 학습 분석에 특화된 메서드를 추가합니다.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 초중고 자기주도학습 전문 AI 멘토다. "
                "학생의 학습 패턴, 진도, 성취도를 분석하여 개인 맞춤형 학습 전략을 제안하라. "
                "긍정적이고 격려하는 어조로, 구체적이고 실용적인 조언을 한국어로 제공하라."
            )
        )

    async def generate_study_plan(self, student_info: dict, goal: str) -> dict:
        """학생 정보 기반 맞춤형 학습 계획 생성"""
        prompt = f"""
학생 정보:
- 이름: {student_info.get('name')}
- 학년: {student_info.get('grade')}
- 목표: {goal}
- 현재 수준: {student_info.get('current_level', '보통')}

위 학생을 위한 4주 학습 계획을 JSON으로 작성하세요:
{{
  "weekly_goals": ["1주차 목표", "2주차 목표", "3주차 목표", "4주차 목표"],
  "daily_schedule": {{"monday": "학습 내용", "tuesday": "..."}},
  "daily_minutes": 60,
  "tips": ["공부 팁1", "팁2"],
  "motivation": "격려 메시지"
}}
        """
        return await self.generate_structured(prompt, {})

    async def generate_weekly_feedback(self, progress_data: list, student_name: str) -> str:
        """주간 학습 데이터 기반 AI 피드백 생성"""
        total_minutes = sum(p.get("studied_minutes", 0) for p in progress_data)
        avg_score = sum(p.get("self_score", 3) for p in progress_data) / max(len(progress_data), 1)

        prompt = f"""
{student_name} 학생의 이번 주 학습 현황:
- 총 학습 시간: {total_minutes}분
- 평균 자기평가: {avg_score:.1f}/5
- 학습 일수: {len(progress_data)}일

이 학생에게 이번 주 학습에 대한 피드백과 다음 주 권장 사항을 200자 이내로 작성해주세요.
        """
        return await self.generate_text(prompt)
