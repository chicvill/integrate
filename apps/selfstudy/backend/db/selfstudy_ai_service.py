"""apps/selfstudy/backend/db/selfstudy_ai_service.py - 자기주도학습 Gemini AI 멘토 서비스"""
from shared.ai.gemini_client import GeminiClient
import json


class SelfStudyAIService(GeminiClient):
    """학생 맞춤형 학습 계획 생성 및 AI 피드백 멘토 서비스"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 1:1 수능 및 자격증 자기주도학습 전문 AI 수석 멘토이다. "
                "학생의 목표, 과목, 일일 가용 학습 시간을 분석하여 체계적이고 실천 가능한 "
                "주간 학습 루틴과 동기부여 피드백을 한국어로 제공한다."
            ),
        )

    async def generate_smart_plan(self, subject: str, target: str, daily_minutes: int = 60) -> dict:
        """목표 및 과목 기반 맞춤형 AI 학습 플랜 생성"""
        if not self.is_available:
            return self._mock_smart_plan(subject, target, daily_minutes)

        prompt = f"""
학생 학습 정보:
- 과목: {subject}
- 달성 목표: {target}
- 하루 공부 가능 시간: {daily_minutes}분

다음 JSON 형식으로 실천 가능한 주간 계획과 핵심 전략을 작성하세요:
{{
  "planTitle": "{subject} 목표 달성 마스터 플랜",
  "weeklyRoutine": [
    {{"day": "월/수/금", "task": "개념 정리 (30분) + 핵심 유형 문제 풀이 (30분)"}},
    {{"day": "화/목", "task": "기출 변형 문제 풀이 (40분) + 오답 분석 (20분)"}},
    {{"day": "토", "task": "주간 누적 테스트 및 취약 단원 집중 복습 (60분)"}}
  ],
  "mentorAdvice": "개념 암기보다 문제 적용 훈련에 집중하고, 오답 노트를 3회독 이상 반복하세요.",
  "estimatedCompletionWeeks": 4
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "weeklyRoutine" in parsed:
                return parsed
            return self._mock_smart_plan(subject, target, daily_minutes)
        except Exception:
            return self._mock_smart_plan(subject, target, daily_minutes)

    async def ask_study_mentor(self, question: str, subject: str = "전과목", student_id: str = "demo-student") -> dict:
        """1:1 AI 수석 멘토 질의응답 (개념설명, 공부 팁, 문제풀이 전략)"""
        if not self.is_available:
            return self._mock_mentor_answer(question, subject)

        prompt = f"""
학생 질의 사항:
- 과목: {subject}
- 질문: {question}

너는 학생에게 친절하고 전문적인 1:1 수석 멘토이다. 다음 JSON 형식으로 응답하세요:
{{
  "answer": "핵심 개념 설명 및 해설 내용...",
  "studyTip": "실전 풀이 팁 또는 오답 노하우",
  "encouragement": "따뜻한 동기부여 응원 한마디"
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "answer" in parsed:
                return parsed
            return self._mock_mentor_answer(question, subject)
        except Exception:
            return self._mock_mentor_answer(question, subject)

    async def analyze_study_performance(self, total_minutes: int, session_count: int, avg_score: float, streak_days: int) -> dict:
        """학생의 누적 학습 데이터를 바탕으로 종합 AI 성취도 분석 리포트 생성"""
        if not self.is_available:
            return self._mock_performance_analysis(total_minutes, session_count, avg_score, streak_days)

        prompt = f"""
학생 공부 통계:
- 총 학습 시간: {total_minutes}분 ({round(total_minutes/60, 1)}시간)
- 총 완료 학습 세션: {session_count}회
- 평균 몰입도/만족도: {avg_score} / 5.0 점
- 연속 학습 스트릭: {streak_days}일 연속

다음 JSON 형식으로 학습 평가 및 개선 전략 리포트를 작성하세요:
{{
  "grade": "A+",
  "summary": "우수한 집중력과 꾸준한 루틴을 유지하고 있습니다.",
  "strengths": ["연속 학습 스트릭을 통해 습관이 형성됨", "높은 몰입도로 시간 대비 효율성 극대화"],
  "improvements": ["휴식 시간과 학습 시간 배분을 보다 세밀하게 조정 필요"],
  "actionPlan": "다음 주에는 고난도 문제 비중을 20% 늘려 실전 감각을 극대화하세요."
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "summary" in parsed:
                return parsed
            return self._mock_performance_analysis(total_minutes, session_count, avg_score, streak_days)
        except Exception:
            return self._mock_performance_analysis(total_minutes, session_count, avg_score, streak_days)

    def _mock_smart_plan(self, subject: str, target: str, daily_minutes: int) -> dict:
        return {
            "planTitle": f"{subject} ({target}) 맞춤 마스터 플랜",
            "weeklyRoutine": [
                {"day": "월/수/금", "task": f"핵심 개념서 정독 (30분) + 기본 예제 풀이 ({max(15, daily_minutes-30)}분)"},
                {"day": "화/목", "task": "실전 기출 문제 풀이 (40분) + 오답 원인 분석 (20분)"},
                {"day": "토요일", "task": "주간 모의평가 및 취약 유형 집중 피드백 (60분)"}
            ],
            "mentorAdvice": "꾸준한 1일 1오답 정리가 단기 점수 상승의 핵심입니다. 당일 복습 원칙을 지키세요.",
            "estimatedCompletionWeeks": 4
        }

    def _mock_mentor_answer(self, question: str, subject: str) -> dict:
        return {
            "answer": f"[{subject}] '{question}'에 관한 핵심 답변입니다:\n개념을 수식으로만 외우기보다는 실제 그래프나 원리를 그려보면서 흐름을 파악하는 것이 중요합니다. 취약 단원은 3단계 구조화 풀이법을 적용해보세요.",
            "studyTip": "오답 노트 작성 시 내가 생각했던 잘못된 접근 방식을 붉은 펜으로 따로 기록하는 습관을 들이세요.",
            "encouragement": "오늘 질문을 던진 것 자체가 한 단계 성장하고 있다는 증거입니다. 오늘도 끝까지 화이팅입니다! 🔥"
        }

    def _mock_performance_analysis(self, total_minutes: int, session_count: int, avg_score: float, streak_days: int) -> dict:
        return {
            "grade": "A" if streak_days >= 3 else "B+",
            "summary": f"총 {round(total_minutes/60, 1)}시간({total_minutes}분) 동안 {session_count}회의 학습을 달성했습니다. 연속 {streak_days}일 학습 습관이 훌륭합니다!",
            "strengths": [
                f"{streak_days}일 연속 출석 및 목표 달성",
                f"평균 몰입도 {avg_score}/5.0점 유지"
            ],
            "improvements": ["주말 복습 세션 비중을 조금 늘려 누적 장기 기억화 촉진"],
            "actionPlan": "매일 공부 시작 전 5분간 이전 날 오답 노트를 인덱싱 복습하세요."
        }
