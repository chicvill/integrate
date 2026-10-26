"""apps/smartfarm/backend/services/ai_service.py - 스마트팜 AI 진단 서비스"""
from shared.ai.gemini_client import GeminiClient


class FarmAIService(GeminiClient):
    """
    스마트팜 전용 AI 진단 서비스.
    GeminiClient를 상속하여 농장 진단에 특화된 메서드를 추가합니다.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        super().__init__(
            api_key=api_key,
            model=model,
            system_prompt=(
                "너는 스마트팜 전문 AI 농업 컨설턴트다. "
                "센서 데이터를 분석하고 작물 재배 환경 이상 원인과 조치 방안을 제시하라. "
                "응답은 항상 한국어로 작성하고, 구체적이고 실용적인 조언을 제공하라."
            )
        )

    async def diagnose_sensor_alert(self, sensor_data: dict, farm_info: dict) -> dict:
        """센서 이상 감지 시 AI 진단 및 조치 가이드 생성"""
        prompt = f"""
농장 정보:
- 농장명: {farm_info.get('farm_name', '알 수 없음')}
- 작물: {farm_info.get('crop_types', [])}

현재 센서 이상값:
{chr(10).join([f"- {k}: {v}" for k, v in sensor_data.items()])}

위 데이터를 분석하여 다음을 JSON 형식으로 답하세요:
{{
  "diagnosis": "진단 결과",
  "severity": "low/medium/high/critical",
  "cause": "원인 분석",
  "actions": ["즉시 조치사항1", "조치사항2"],
  "prevention": "재발 방지 방안"
}}
        """
        return await self.generate_structured(prompt, {})

    async def generate_daily_report(self, readings_summary: dict, farm_info: dict) -> str:
        """일간 농장 운영 AI 리포트 생성"""
        prompt = f"""
농장 '{farm_info.get('farm_name')}'의 오늘 운영 데이터:
{chr(10).join([f"- {k}: {v}" for k, v in readings_summary.items()])}

오늘의 농장 운영 상태를 요약하고 내일 주의해야 할 사항을 알려주세요.
        """
        return await self.generate_text(prompt)
