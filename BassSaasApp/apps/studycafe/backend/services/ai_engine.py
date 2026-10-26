"""
apps/studycafe/backend/services/ai_engine.py
StudyCafe AI Engine using shared GeminiClient.
"""
import os
import logging
from shared.ai.gemini_client import GeminiClient

logger = logging.getLogger("mqnet.studycafe.ai")


class AIEngine:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self.client = GeminiClient(api_key=api_key, model="gemini-2.5-flash")

    def ask_ai_study_assistant(self, question: str, subject: str = "General") -> str:
        prompt = (
            f"당신은 스터디카페 학습 케어 AI 튜터입니다.\n"
            f"과목: {subject}\n"
            f"질문: {question}\n\n"
            f"학생에게 친절하고 명확하게 공부 답변과 설명 및 공부 팁을 3문장 이내로 제공해주세요."
        )
        try:
            return self.client.generate_text(prompt)
        except Exception as e:
            logger.warning(f"AI assistant error: {e}")
            return f"[{subject} 학습 가이드] 질문하신 '{question}'에 대해 기본 개념을 정리하고 기출문제를 반복 풀이해 보세요."


ai_engine = AIEngine()
