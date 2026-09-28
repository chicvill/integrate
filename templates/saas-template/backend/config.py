"""
templates/saas-template/backend/config.py
MQnet 스마트 SaaS 표준 설정 클래스 (BaseConfig 상속).
환경변수 또는 15대 표준 프리셋 정보를 기반으로 유연하게 설정됩니다.
"""
import os
from shared.core.base_config import BaseConfig
try:
    from .presets import get_preset
except ImportError:
    from presets import get_preset

class AppConfig(BaseConfig):
    APP_ID: str = os.getenv("APP_ID", "{{APP_ID}}")
    APP_NAME: str = os.getenv("APP_NAME", "{{APP_NAME}}")
    APP_CATEGORY: str = os.getenv("APP_CATEGORY", "{{APP_CATEGORY}}")
    APP_ICON: str = os.getenv("APP_ICON", "{{APP_ICON}}")
    PORT: int = int(os.getenv("PORT", "{{APP_PORT}}") if os.getenv("PORT", "{{APP_PORT}}").isdigit() else 9015)
    
    # 기본 프리셋 연결
    def get_preset_meta(self):
        # 만약 치환되지 않은 템플릿 상태라면 studycafe를 기본 프리셋으로 로드
        effective_id = self.APP_ID if not self.APP_ID.startswith("{{") else "studycafe"
        return get_preset(effective_id)

settings = AppConfig()
