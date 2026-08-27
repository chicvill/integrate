"""
shared/tenant/registry.py
등록된 모든 SaaS 앱의 설정 및 상세 메타데이터 레지스트리.
"""
from typing import Dict, Any, List

APP_REGISTRY: Dict[str, Dict[str, Any]] = {
    "studycafe": {
        "app_id": "studycafe",
        "app_name": "스터디카페 관리",
        "icon": "☕",
        "description": "스터디카페 좌석 배치 및 이용권 관리",
        "backend_port": 8001,
        "features": ["좌석 실시간 현황", "이용권 관리", "NFC 도어락", "QR 체크인"],
    },
    "store": {
        "app_id": "store",
        "app_name": "매장 QR 주문",
        "icon": "🍽️",
        "description": "매장 QR코드 테이블 비대면 주문",
        "backend_port": 8002,
        "features": ["테이블 QR 주문", "실시간 주방 디스플레이", "토스 결제", "메뉴 관리"],
    },
    "selfstudy": {
        "app_id": "selfstudy",
        "app_name": "자기주도학습 관리",
        "icon": "📚",
        "description": "자기주도학습 목표 및 AI 플래너",
        "backend_port": 8003,
        "features": ["학습 플래너", "AI 멘토 피드백", "진도 통계", "학부모 리포트"],
    },
    "smartfarm": {
        "app_id": "smartfarm",
        "app_name": "스마트팜 제어",
        "icon": "🌿",
        "description": "스마트팜 IoT 센서 모니터링 및 장치 제어",
        "backend_port": 8004,
        "features": ["센서 모니터링", "환풍/급수 자동제어", "AI 이상감지 진단"],
    },
    "ai_gwansang": {
        "app_id": "ai_gwansang",
        "app_name": "AI 관상 분석",
        "icon": "🔮",
        "description": "AI 관상 분석 (얼굴 이미지 + Gemini 2.5)",
        "backend_port": 8005,
        "features": ["얼굴 관상 분석", "동물상 분류", "Gemini 2.5 Flash", "토스 결제"],
    },
}


def get_app_config(app_id: str) -> Dict[str, Any]:
    return APP_REGISTRY.get(app_id, {})


def is_registered_app(app_id: str) -> bool:
    return app_id in APP_REGISTRY


def list_apps() -> List[Dict[str, Any]]:
    """등록된 모든 앱 목록을 아이콘과 상세 설명과 함께 반환"""
    return [
        {
            "id": k,
            "name": v["app_name"],
            "icon": v["icon"],
            "description": v["description"],
            "port": v["backend_port"],
            "features": v.get("features", []),
        }
        for k, v in APP_REGISTRY.items()
    ]