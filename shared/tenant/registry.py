"""
shared/tenant/registry.py
등록된 모든 SaaS 앱의 설정 및 상세 메타데이터 레지스트리.
새로운 앱 추가 시 이 레지스트리에 등록하면 포털, 게이트웨이, 헬스체크에 자동 반영됩니다.
"""
from typing import Dict, Any, List, Optional

APP_REGISTRY: Dict[str, Dict[str, Any]] = {
    "mqhome": {
        "app_id": "mqhome",
        "app_name": "MQnet 브랜드 홈페이지",
        "icon": "🌐",
        "category": "portal",
        "description": "MQnet 혁신 IT 솔루션 브랜드 소개 및 통합 제품 쇼케이스",
        "backend_port": 9001,
        "route_path": "/mqhome",
        "modules": ["core"],
        "features": ["브랜드 스토리", "전체 제품 라인업", "기술 블로그", "인터랙티브 파티클 디자인"],
    },
    "studycafe": {
        "app_id": "studycafe",
        "app_name": "스터디카페 관리",
        "icon": "☕",
        "category": "business",
        "description": "스터디카페 좌석 배치 및 이용권 관리",
        "backend_port": 9002,
        "route_path": "/studycafe",
        "modules": ["core", "auth", "payment", "database", "events"],
        "features": ["좌석 실시간 현황", "이용권 관리", "NFC 도어락", "QR 체크인"],
    },
    "selfstudy": {
        "app_id": "selfstudy",
        "app_name": "자기주도학습 관리",
        "icon": "📚",
        "category": "education",
        "description": "자기주도학습 목표 및 AI 플래너",
        "backend_port": 9003,
        "route_path": "/selfstudy",
        "modules": ["core", "auth", "ai", "database"],
        "features": ["학습 플래너", "AI 멘토 피드백", "진도 통계", "학부모 리포트"],
    },
    "store": {
        "app_id": "store",
        "app_name": "매장 QR 주문 & POS",
        "icon": "🍽️",
        "category": "business",
        "description": "매장 QR코드 테이블 비대면 주문 및 POS 관제",
        "backend_port": 9004,
        "route_path": "/store",
        "modules": ["core", "auth", "payment", "database", "events", "utils"],
        "features": ["테이블 QR 주문", "실시간 주방 디스플레이", "토스 결제", "메뉴 관리"],
    },
    "smartfarm": {
        "app_id": "smartfarm",
        "app_name": "스마트팜 센서 관제",
        "icon": "🌿",
        "category": "iot",
        "description": "스마트팜 IoT 센서 모니터링 및 장치 제어",
        "backend_port": 9005,
        "route_path": "/mqfarm",
        "modules": ["core", "ai", "database", "events"],
        "features": ["센서 모니터링", "환풍/급수 자동제어", "AI 이상감지 진단"],
    },
    "photos": {
        "app_id": "photos",
        "app_name": "스마트 갤러리 (Immich AI)",
        "icon": "📸",
        "category": "media",
        "description": "AI 안면인식 및 위치 지도, 모바일 실시간 백업 허브",
        "backend_port": 9006,
        "route_path": "/photos",
        "modules": ["core", "ai", "storage", "database"],
        "features": ["AI 안면인식", "CLIP 시맨틱 검색", "GPS 위치지도", "모바일 자동백업"],
    },
    "filebrowser": {
        "app_id": "filebrowser",
        "app_name": "통합 파일 탐색기 (FileBrowser)",
        "icon": "📁",
        "category": "utility",
        "description": "L: 드라이브 내 모든 문서, 음악, 영상, 압축파일 관리자",
        "backend_port": 9007,
        "route_path": "/filebrowser",
        "modules": ["core", "storage"],
        "features": ["파일 탐색기", "문서/음악/영상", "대용량 업·다운로드", "원격 파일관리"],
    },
    "ytdownloader": {
        "app_id": "ytdownloader",
        "app_name": "유튜브 미디어 다운로더",
        "icon": "🎬",
        "category": "media",
        "description": "YouTube 최고화질 영상/오디오 추출 및 AI 3줄 요약 리포트",
        "backend_port": 9008,
        "route_path": "/ytdownloader",
        "modules": ["core", "ai", "storage", "utils"],
        "features": ["YouTube 고화질 MP4/MP3 추출", "AI 영상 3줄 핵심 요약", "미디어 아카이브", "다운로드 큐 관리"],
    },
    "ai_gwansang": {
        "app_id": "ai_gwansang",
        "app_name": "AI 관상 분석",
        "icon": "🔮",
        "category": "ai_vision",
        "description": "AI 관상 분석 (얼굴 이미지 + Gemini 2.5)",
        "backend_port": 9009,
        "route_path": "/gwansang",
        "modules": ["core", "auth", "ai", "payment", "database", "utils"],
        "features": ["얼굴 관상 분석", "동물상 분류", "Gemini 2.5 Flash", "토스 결제"],
    },
    "face_analy": {
        "app_id": "face_analy",
        "app_name": "테토/에겐 AI 얼굴 분석",
        "icon": "🧑‍🎨",
        "category": "ai_vision",
        "description": "Gemini 2.5 AI 기반 테토상 vs 에겐상 얼굴 분석 및 스타일링",
        "backend_port": 9010,
        "route_path": "/face_analy",
        "modules": ["core", "ai", "utils"],
        "features": ["AI 얼굴형 분석", "테토/에겐 분류", "맞춤형 패션/헤어 추천", "실시간 웹캠"],
    },
    "ironman": {
        "app_id": "ironman",
        "app_name": "아이언맨 제스처 게임",
        "icon": "🎮",
        "category": "game",
        "description": "실시간 웹캠 핸드 트래킹 & p5.js 아이언맨 리펄서 인터랙티브 게임",
        "backend_port": 9011,
        "route_path": "/ironman",
        "modules": ["core"],
        "features": ["핸드 트래킹", "실시간 모션 인식", "랭킹 시스템", "오디오 효과음"],
    },
    "clock": {
        "app_id": "clock",
        "app_name": "모던 스마트 클락",
        "icon": "⏰",
        "category": "utility",
        "description": "네온 아날로그/디지털 듀얼 시계, 글로벌 타임존 및 뽀모도로 타이머",
        "backend_port": 9012,
        "route_path": "/clock",
        "modules": ["core"],
        "features": ["스마트 아날로그/디지털", "글로벌 5대 도시 세계시", "정밀 스톱워치", "뽀모도로 타이머"],
    },
    "videobooth": {
        "app_id": "videobooth",
        "app_name": "레트로 TV 비디오 부스",
        "icon": "📺",
        "category": "media",
        "description": "레트로 브라운관 TV 스타일 인터랙티브 동영상 방명록 & 비디오 레코더",
        "backend_port": 9013,
        "route_path": "/videobooth",
        "modules": ["core", "storage", "utils"],
        "features": ["실시간 웹캠 녹화", "레트로 TV 프레임", "최신 갤러리 아카이브", "TTS 음성 카운트다운"],
    },
    "n8n": {
        "app_id": "n8n",
        "app_name": "n8n AI 워크플로우 자동화 & 에디터",
        "icon": "⚡",
        "category": "automation",
        "description": "공식 n8n 비주얼 노드 편집기(포트 5678) 및 농협 입금 알림 대시보드(포트 3000)",
        "backend_port": 5678,
        "route_path": "http://34.31.10.12:5678",
        "modules": ["core"],
        "features": ["공식 n8n 비주얼 편집기", "AI Agent & LLM 노드", "은행 이메일 자동 파싱", "구글 시트/엑셀 연동"],
    },
    "grammer": {
        "app_id": "grammer",
        "app_name": "Grammar Quest (AI 영문법 퀘스트)",
        "icon": "🔤",
        "category": "education",
        "description": "초3~고3 수능 영문법 무한 생성 & AI 음성 섀도잉 발음 코칭",
        "backend_port": 9014,
        "route_path": "/grammar",
        "modules": ["core", "ai", "storage", "utils"],
        "features": ["STEM & AI 어휘 예문", "6단계 정규 교육과정", "5대 인터랙티브 퀘스트", "음성 인식 & 섀도잉", "AI 원어민 발음 코칭"],
    },
}


def get_app_config(app_id: str) -> Dict[str, Any]:
    return APP_REGISTRY.get(app_id, {})


def is_registered_app(app_id: str) -> bool:
    return app_id in APP_REGISTRY


def list_apps(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """등록된 모든 앱 목록을 반환하며, 선택 시 카테고리 필터링 지원"""
    results = []
    for k, v in APP_REGISTRY.items():
        if category and v.get("category") != category:
            continue
        results.append({
            "id": k,
            "name": v["app_name"],
            "icon": v["icon"],
            "category": v.get("category", "general"),
            "description": v["description"],
            "port": v["backend_port"],
            "route_path": v.get("route_path", f"/{k}"),
            "modules": v.get("modules", []),
            "features": v.get("features", []),
        })
    return results


def get_apps_by_module(module_name: str) -> List[str]:
    """특정 공통 모듈(예: 'ai', 'storage', 'payment')을 사용하는 앱 ID 목록 반환"""
    return [k for k, v in APP_REGISTRY.items() if module_name in v.get("modules", [])]