"""
gateway/main.py — 제로터치 통합 게이트웨이.

핵심 게이트웨이 팩토리는 core.gateway 에 구현되어 있으며,
이 파일은 하위 호환성을 위해 create_gateway 를 재노출합니다.
"""
from core.gateway import create_gateway, SaaSAppManager

__all__ = ["create_gateway", "SaaSAppManager"]
