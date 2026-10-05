"""
apps/photos/backend/services/ai_engine.py
AI Vision and Auto-Tagging Service for Photos & Media Gallery using shared GeminiClient.
"""
import os
import base64
import logging
from typing import Dict, Any, List
from shared.ai.gemini_client import GeminiClient

logger = logging.getLogger("mqnet.photos.ai")


class PhotosAIEngine:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self.client = GeminiClient(api_key=api_key, model="gemini-2.5-flash")

    async def analyze_image_tags(self, image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Analyze an image and generate auto-tags, categories, and a descriptive caption using Gemini 2.5 Flash.
        """
        prompt = f"""
        당신은 스마트 포토 앨범의 최고 수준 AI 비전 태깅 시스템입니다.
        제공된 사진 파일({filename})의 시각적 요소(인물, 표정, 풍경, 자연, 건축, 사물, 색상, 분위기, 시간대 등)를 정밀하게 분석하여
        반드시 JSON 형식으로 자동 태그와 1줄 설명을 생성하세요.

        출력 형식 (JSON only):
        {{
            "tags": ["풍경", "자연", "하늘", "바다", "여름휴가"],
            "category": "여행/풍경",
            "caption": "맑은 여름날 푸른 바다와 수평선이 어우러진 해변 풍경",
            "dominant_colors": ["#1e3a8a", "#38bdf8", "#facc15"]
        }}
        """
        fallback = {
            "tags": ["사진", "미디어", "앨범", "스마트갤러리"],
            "category": "일반/사진",
            "caption": f"{filename or '사진'} 미디어 파일입니다.",
            "dominant_colors": ["#6366f1", "#ec4899"]
        }

        try:
            b64_str = base64.b64encode(image_bytes).decode('utf-8')
            res = await self.client.generate_structured_with_image(
                prompt=prompt,
                image_base64=b64_str,
                mime_type="image/jpeg",
                fallback_data=fallback
            )
            if res and isinstance(res, dict) and "tags" in res:
                return res
        except Exception as e:
            logger.warning(f"Gemini photo vision analysis failed: {e}")

        return fallback


photos_ai_engine = PhotosAIEngine()
