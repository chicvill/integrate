"""
shared/ai/mock_client.py
API 키가 없거나 테스트 환경에서 사용하는 Mock AI 클라이언트.
"""
from typing import Dict, Any, Optional
from shared.ai.base import BaseAIClient


class MockAIClient(BaseAIClient):
    """테스트/오프라인 전용 Mock AI 클라이언트"""

    def __init__(self, system_prompt: str = ""):
        self.system_prompt = system_prompt

    @property
    def is_available(self) -> bool:
        return True

    async def generate_text(self, prompt: str) -> str:
        return f"[Mock AI 텍스트] '{prompt[:40]}' 에 대한 응답입니다."

    async def generate_with_image(self, prompt: str, image_base64: str, mime_type: str = "image/jpeg") -> str:
        return f"[Mock AI 이미지 분석] 프롬프트: '{prompt[:40]}', 이미지 크기: {len(image_base64)} bytes"

    async def generate_structured(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "mock": True,
            "status": "success",
            "prompt": prompt[:50],
            "message": "API 키를 설정하면 실제 AI 모델 분석 결과가 반환됩니다.",
        }
