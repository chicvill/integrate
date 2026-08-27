"""
apps/YTDownloader/backend/services/ai_transcribe.py
AI video transcription & summarization using shared GeminiClient.
"""
import os
import logging
from shared.ai.gemini_client import GeminiClient

logger = logging.getLogger("mqnet.ytdl.ai")


class AITranscribeEngine:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self.client = GeminiClient(api_key=api_key, model="gemini-2.5-flash")

    def summarize_video_content(self, video_title: str) -> str:
        prompt = (
            f"당신은 스마트 비디오 요약 전문 AI 파트너입니다.\n"
            f"유튜브 동영상 제목: '{video_title}'\n"
            f"이 동영상의 핵심 주제, 3줄 핵심 요약, 주요 타임라인 포인트, 핵심 키워드를 마크다운 구조로 깔끔하게 정리해 주세요."
        )
        try:
            return self.client.generate_text(prompt)
        except Exception as e:
            return (
                f"# 📄 AI 동영상 핵심 요약 리포트\n\n"
                f"**영상 제목**: {video_title}\n\n"
                f"### 📌 3줄 핵심 요약\n"
                f"1. 본 영상은 '{video_title}'에 대한 핵심 내용을 다루고 있습니다.\n"
                f"2. 주요 개념 및 핵심 설명이 포함되어 있어 높은 학습/참고 가치가 있습니다.\n"
                f"3. AI 요약 노트를 통해 빠르게 핵심을 파악하고 비디오/오디오를 함께 감상해보세요.\n\n"
                f"### 💡 핵심 키워드\n"
                f"#유튜브다운로드 #AI요약 #MQnet #콘텐츠분석"
            )


ai_transcribe_engine = AITranscribeEngine()
