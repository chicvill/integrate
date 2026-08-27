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
    "photos": {
        "app_id": "photos",
        "app_name": "미디어 갤러리 & AI 앨범",
        "icon": "📸",
        "description": "스마트 사진/동영상 갤러리 및 Gemini 비전 AI 자동 태깅",
        "backend_port": 8006,
        "features": ["사진/비디오 원본 스트리밍", "폴더별 앨범 관리", "고속 썸네일 캐시", "Gemini AI 비전 태깅"],
    },
    "ytdownloader": {
        "app_id": "ytdownloader",
        "app_name": "유튜브 미디어 다운로더",
        "icon": "🎬",
        "description": "YouTube 최고화질 영상/오디오 추출 및 AI 3줄 요약 리포트",
        "backend_port": 8007,
        "features": ["YouTube 고화질 MP4/MP3 추출", "AI 영상 3줄 핵심 요약", "미디어 아카이브", "다운로드 큐 관리"],
    },
    "mqhome": {
        "app_id": "mqhome",
        "app_name": "MQnet 브랜드 홈페이지",
        "icon": "🌐",
        "description": "MQnet 혁신 IT 솔루션 브랜드 소개 및 통합 제품 쇼케이스",
        "backend_port": 8008,
        "features": ["브랜드 스토리", "전체 제품 라인업", "기술 블로그", "인터랙티브 파티클 디자인"],
    },
    "ironman": {
        "app_id": "ironman",
        "app_name": "아이언맨 제스처 게임",
        "icon": "🎮",
        "description": "실시간 웹캠 핸드 트래킹 & p5.js 아이언맨 리펄서 인터랙티브 게임",
        "backend_port": 8009,
        "features": ["핸드 트래킹", "실시간 모션 인식", "랭킹 시스템", "오디오 효과음"],
    },
    "clock": {
        "app_id": "clock",
        "app_name": "모던 스마트 클락",
        "icon": "⏰",
        "description": "네온 아날로그/디지털 듀얼 시계, 글로벌 타임존 및 뽀모도로 타이머",
        "backend_port": 8010,
        "features": ["스마트 아날로그/디지털", "글로벌 5대 도시 세계시", "정밀 스톱워치", "뽀모도로 타이머"],
    },
    "face_analy": {
        "app_id": "face_analy",
        "app_name": "테토/에겐 AI 얼굴 분석",
        "icon": "🧑‍🎨",
        "description": "Gemini 2.5 AI 기반 테토상(시크/도시적) vs 에겐상(따뜻/친근) 얼굴 분석 및 스타일링",
        "backend_port": 8011,
        "features": ["AI 얼굴형 분석", "테토/에겐 분류", "맞춤형 패션/헤어 추천", "실시간 웹캠"],
    },
    "videobooth": {
        "app_id": "videobooth",
        "app_name": "레트로 TV 비디오 부스",
        "icon": "📺",
        "description": "레트로 브라운관 TV 스타일 인터랙티브 동영상 방명록 & 비디오 레코더",
        "backend_port": 8012,
        "features": ["실시간 웹캠 녹화", "레트로 TV 프레임", "최신 갤러리 아카이브", "TTS 음성 카운트다운"],
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