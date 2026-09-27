"""
shared/ai/gemini_client.py
Gemini AI 공통 클라이언트 (BaseAIClient 구현).
모든 앱의 AI 기능은 이 클래스를 상속하거나 직접 인스턴스화하여 사용합니다.

상속 예시:
    from shared.ai.gemini_client import GeminiClient

    class GwansangAIService(GeminiClient):
        async def analyze_face(self, image_data: str, user_name: str) -> dict:
            prompt = f"사용자: {user_name}\n" + self.system_prompt
            return await self.generate_with_image(prompt, image_data)
"""
import os
import json
import logging
from typing import Optional, Dict, Any

from shared.ai.base import BaseAIClient

logger = logging.getLogger("mqnet.gemini")


def clean_json_markdown(text: str) -> str:
    """AI 응답 문자열에서 ```json ... ``` 코드 블록 마크다운을 안전하게 제거"""
    clean = text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    return clean.strip()


def extract_base64_data(image_data: str, default_mime: str = "image/jpeg") -> tuple[str, str]:
    """Base64 data URL에서 순수 base64 문자열과 MIME 타입을 추출"""
    if "," in image_data:
        header, b64 = image_data.split(",", 1)
        mime = default_mime
        if header.startswith("data:") and ";base64" in header:
            mime = header[5:].split(";")[0]
        return b64.strip(), mime
    return image_data.strip(), default_mime


class GeminiClient(BaseAIClient):
    """
    Gemini AI 기반 공통 클라이언트 클래스.
    각 앱은 이 클래스를 상속하여 앱별 AI 로직을 구현합니다.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", system_prompt: str = ""):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model
        self.system_prompt = system_prompt
        self._client = None

        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
                logger.info(f"Gemini AI 클라이언트 초기화 완료. 모델: {model}")
            except ImportError:
                logger.warning("google-genai 패키지가 설치되지 않았습니다. (pip install google-genai 필요)")
        else:
            logger.warning("GEMINI_API_KEY가 설정되지 않았습니다. Mock 모드로 실행됩니다.")

    @property
    def is_available(self) -> bool:
        """Gemini AI 실제 사용 가능 여부"""
        return self._client is not None

    async def generate_text(self, prompt: str) -> str:
        """텍스트 기반 AI 생성"""
        if not self.is_available:
            return self._mock_text_response(prompt)

        try:
            full_prompt = f"{self.system_prompt}\n\n{prompt}" if self.system_prompt else prompt
            response = self._client.models.generate_content(
                model=self.model,
                contents=full_prompt,
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini 텍스트 생성 오류: {e}")
            return self._mock_text_response(prompt)

    async def generate_with_image(self, prompt: str, image_base64: str, mime_type: str = "image/jpeg") -> str:
        """이미지 + 텍스트 기반 AI 생성 (관상 분석, 스마트팜 진단 등)"""
        if not self.is_available:
            return self._mock_image_response()

        try:
            import base64
            clean_b64 = image_base64.split(",")[1] if "," in image_base64 else image_base64
            image_bytes = base64.b64decode(clean_b64)
            full_prompt = f"{self.system_prompt}\n\n{prompt}" if self.system_prompt else prompt

            from google.genai import types
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            response = self._client.models.generate_content(
                model=self.model,
                contents=[image_part, full_prompt],
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini 이미지 분석 오류: {e}")
            return self._mock_image_response()

    async def generate_structured(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """구조화된 JSON 응답 생성 (데이터 분석 등)"""
        json_prompt = f"{prompt}\n\n응답은 반드시 마크다운이나 부가 설명 없이 순수한 JSON 형식으로만 작성하세요."
        text = await self.generate_text(json_prompt)

        try:
            clean = clean_json_markdown(text)
            return json.loads(clean)
        except Exception as e:
            logger.warning(f"JSON 파싱 실패 ({e}), fallback 또는 원본 반환")
            if fallback_data:
                return fallback_data
            return {"raw": text, "parse_error": True}

    async def generate_structured_with_image(
        self,
        prompt: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
        schema: Optional[Dict[str, Any]] = None,
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """이미지 기반 구조화된 JSON 데이터 분석 및 생성 (관상, 얼굴분석, 작물진단 등)"""
        if not self.is_available:
            return fallback_data or json.loads(self._mock_image_response())

        b64_clean, detected_mime = extract_base64_data(image_base64, default_mime=mime_type)
        json_prompt = f"{prompt}\n\n응답은 반드시 마크다운(```json) 없이 순수한 JSON 형식으로만 작성하세요."
        
        try:
            raw_text = await self.generate_with_image(json_prompt, b64_clean, mime_type=detected_mime)
            clean = clean_json_markdown(raw_text)
            return json.loads(clean)
        except Exception as e:
            logger.warning(f"Gemini 이미지 구조화 파싱 실패 ({e})")
            if fallback_data:
                return fallback_data
            return {"raw": raw_text if 'raw_text' in locals() else "", "parse_error": True}

    # ─── Mock 응답 (API Key 없을 때) ──────────────────────────
    def _mock_text_response(self, prompt: str) -> str:
        return f"[Mock AI 응답] '{prompt[:30]}...' 에 대한 AI 분석 결과입니다. (실제 운영 시 GEMINI_API_KEY를 설정하세요)"

    def _mock_image_response(self) -> str:
        return json.dumps({
            "mock": True,
            "message": "이미지 분석 Mock 응답입니다. GEMINI_API_KEY를 설정하세요.",
        }, ensure_ascii=False)
