"""
shared/ai/base.py
MQnet AI 서비스 공통 인터페이스 (추상 클래스).
Gemini, OpenAI, 로컬 LLM 등 다양한 AI 엔진을 교체 가능하도록 추상화합니다.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class BaseAIClient(ABC):
    """모든 AI 클라이언트의 기본 추상 인터페이스"""

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """AI 엔진 활성화 여부"""
        pass

    @abstractmethod
    async def generate_text(self, prompt: str) -> str:
        """텍스트 생성"""
        pass

    @abstractmethod
    async def generate_with_image(self, prompt: str, image_base64: str, mime_type: str = "image/jpeg") -> str:
        """이미지 기반 멀티모달 분석/생성"""
        pass

    @abstractmethod
    async def generate_structured(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """구조화된 JSON 형식 생성"""
        pass

    @abstractmethod
    async def generate_structured_with_image(
        self,
        prompt: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
        schema: Optional[Dict[str, Any]] = None,
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """이미지 기반 구조화된 JSON 데이터 분석 및 생성"""
        pass
