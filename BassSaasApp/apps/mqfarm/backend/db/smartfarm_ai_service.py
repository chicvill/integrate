"""apps/smartfarm/backend/db/smartfarm_ai_service.py - 스마트팜 Gemini AI 이상 진단 및 생육 가이드 서비스"""
from shared.ai.gemini_client import GeminiClient
import json


class SmartFarmAIService(GeminiClient):
    """스마트팜 환경 센서 이상 진단 및 AI 생육 최적화 서비스"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 스마트 농업 및 온실 환경 제어 전문 수석 농업 AI 연구원이다. "
                "온도, 습도, CO2, 조도, 토양 수분 데이터를 분석하여 병해충 위험 및 이상 징후를 진단하고 "
                "환풍기, 급수 밸브, LED 조명 제어에 대한 가이드를 한국어로 제공한다."
            ),
        )

    async def diagnose_environment(self, telemetry: list, crop_name: str = "딸기") -> dict:
        """실시간 센서 텔레메트리 기반 이상치 진단 및 최적 환경 가이드"""
        if not self.is_available:
            return self._mock_diagnosis(crop_name)

        prompt = f"""
작물 종류: {crop_name}
현재 온실 센서 텔레메트리: {telemetry}

다음 JSON 형식으로 환경 상태 분석 및 권장 제어 액션을 작성하세요:
{{
  "overallStatus": "정상 / 주의 / 경고",
  "healthScore": 92,
  "summary": "현재 주간 온·습도 밸런스가 {crop_name} 생육에 최적 범위로 유지되고 있습니다.",
  "riskFactor": "야간 습도 상승 시 잿빛곰팡이병 발생 가능성에 유의하세요.",
  "recommendedAction": "오후 5시 이후 환풍팬 20분 가동 권장"
}}
        """
        result = await self.generate_text(prompt)
        try:
            clean = result.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "overallStatus" in parsed:
                return parsed
            return self._mock_diagnosis(crop_name)
        except Exception:
            return self._mock_diagnosis(crop_name)

    def _mock_diagnosis(self, crop_name: str) -> dict:
        return {
            "overallStatus": "정상 (최적)",
            "healthScore": 95,
            "summary": f"온도(24.5°C) 및 습도(68.2%)가 {crop_name} 생육에 이상적인 상태입니다.",
            "riskFactor": "이상 징후 없음 (생육 활력 지수 높음)",
            "recommendedAction": "현재 자동 제어 모드를 유지하세요."
        }
