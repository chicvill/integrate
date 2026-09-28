"""
templates/saas-template/backend/presets.py
15개 표준 SaaS 애플리케이션 아키타입(Archetype) 프리셋 정의.
도메인별(Business, Education, IoT, AI Vision, Media, Utility, Automation, Portal)
표준 KPI, CRUD 모의 데이터, AI 액션 프롬프트 및 특화 기능을 제공합니다.
"""
from typing import Dict, Any, List

SAAS_PRESETS: Dict[str, Dict[str, Any]] = {
    "studycafe": {
        "app_id": "studycafe",
        "app_name": "스터디카페 관리",
        "icon": "☕",
        "category": "business",
        "port": 9002,
        "tagline": "무인 스터디카페 좌석 관제, 시간권·기간권 결제 및 스마트 도어락 연동",
        "accent_color": "#f59e0b",
        "gradient": "linear-gradient(135deg, #f59e0b, #d97706)",
        "kpis": [
            {"label": "좌석 점유율", "value": "78.4%", "sub": "36 / 46석 이용중", "trend": "+12%", "status": "active"},
            {"label": "금일 매출", "value": "₩485,000", "sub": "결제 28건 집계", "trend": "+8.5%", "status": "active"},
            {"label": "활성 이용권", "value": "142건", "sub": "시간권 94 · 기간권 48", "trend": "+4건", "status": "active"},
            {"label": "NFC 도어락", "value": "정상 작동", "sub": "게이트웨이 연동중", "trend": "99.9% 가동", "status": "healthy"}
        ],
        "default_items": [
            {"id": "SC-101", "title": "A-04 1인 집중석 (김*준)", "category": "좌석", "status": "active", "detail": "4시간 이용권 잔여 1시간 40분"},
            {"id": "SC-102", "title": "B-12 오픈형 카페석", "category": "좌석", "status": "pending", "detail": "퇴실 완료 · 청소 점검 대기"},
            {"id": "SC-103", "title": "스터디룸 4인실 (예약)", "category": "공간", "status": "active", "detail": "19:00 ~ 21:00 그룹 프로젝트"},
            {"id": "SC-104", "title": "프리미엄 4주 정기권 결제", "category": "결제", "status": "active", "detail": "토스페이 180,000원 결제 완료"},
            {"id": "SC-105", "title": "메인 출입문 NFC 도어락 락해제", "category": "장치", "status": "active", "detail": "QR 체크인 인증 성공 (0.12s)"}
        ],
        "ai_prompts": [
            "현재 시간대(16시~20시) 좌석 점유율 예측 및 스터디룸 야간 타임세일 이벤트 기획안 생성",
            "단골 고객 대상 만료 예정 정기권 재등록 알림 SMS 템플릿 작성",
            "냉난방 최적 온도(현재 23.5°C) 에너지 절감 스케줄러 추천"
        ],
        "quick_actions": ["새 좌석 배치 추가", "이용권 강제 퇴실 처리", "도어락 원격 개방", "일일 매출 리포트 출력"]
    },

    "store": {
        "app_id": "store",
        "app_name": "매장 QR 주문 & POS",
        "icon": "🍽️",
        "category": "business",
        "port": 9004,
        "tagline": "비대면 테이블 QR 주문, 주방 디스플레이(KDS) 실시간 연동 및 매장 통합 POS",
        "accent_color": "#f97316",
        "gradient": "linear-gradient(135deg, #f97316, #ea580c)",
        "kpis": [
            {"label": "금일 누적 매출", "value": "₩1,420,000", "sub": "목표 달성률 118%", "trend": "+15.2%", "status": "active"},
            {"label": "완료 주문수", "value": "86건", "sub": "테이블 72 · 포장 14", "trend": "+9건", "status": "active"},
            {"label": "평균 조리시간", "value": "8.5분", "sub": "KDS 최적 표준 충족", "trend": "-1.2분", "status": "healthy"},
            {"label": "주방 디스플레이", "value": "3/3 연동", "sub": "양방향 웹소켓 정상", "trend": "실시간", "status": "healthy"}
        ],
        "default_items": [
            {"id": "POS-201", "title": "테이블 3번: 트러플 파스타 외 2건", "category": "주문", "status": "active", "detail": "₩42,000 · 조리 완료 대기"},
            {"id": "POS-202", "title": "테이블 7번: 부라타 치즈 샐러드", "category": "주문", "status": "pending", "detail": "₩18,500 · 주방 KDS 접수"},
            {"id": "POS-203", "title": "포장 주문 #14호: 수제 버거 세트", "category": "포장", "status": "active", "detail": "픽업 대기중 (호출 번호 14)"},
            {"id": "POS-204", "title": "토스페이 결제 승인 #88219", "category": "결제", "status": "active", "detail": "₩85,000 카드 승인 완료"},
            {"id": "POS-205", "title": "신선 생연어 재고 경고 (잔여 1.5kg)", "category": "재고", "status": "pending", "detail": "안전 재고 수량 도달 · 발주 요망"}
        ],
        "ai_prompts": [
            "오늘 판매 데이터를 바탕으로 마감 전 소진해야 할 식자재 기반 타임세일 메뉴 추천",
            "주말 피크타임(토/일 18:00~20:00) 예상 주문량 및 식자재 사전 준비 가이드 작성",
            "재방문율을 높이기 위한 QR 주문 완료 고객 대상 맞춤 리뷰 이벤트 기획"
        ],
        "quick_actions": ["새 테이블 QR 생성", "품절 메뉴 즉시 설정", "주방 호출 벨 전송", "영수증 재출력"]
    },

    "selfstudy": {
        "app_id": "selfstudy",
        "app_name": "자기주도학습 관리",
        "icon": "📚",
        "category": "education",
        "port": 9003,
        "tagline": "AI 플래너 기반 데일리 목표 수립, 순공시간 측정 및 취약점 분석 리포트",
        "accent_color": "#3b82f6",
        "gradient": "linear-gradient(135deg, #3b82f6, #1d4ed8)",
        "kpis": [
            {"label": "일일 순공시간", "value": "6시간 28분", "sub": "목표 7시간 대비 92%", "trend": "+45분", "status": "active"},
            {"label": "주간 목표 달성", "value": "89.5%", "sub": "완료 34 / 전체 38개", "trend": "+6.3%", "status": "active"},
            {"label": "AI 오답노트", "value": "24문항", "sub": "수학 14 · 영어 10 분석", "trend": "완료", "status": "healthy"},
            {"label": "학부모 주간리포트", "value": "발송 완료", "sub": "이번 주 성취도 A등급", "trend": "정기발송", "status": "healthy"}
        ],
        "default_items": [
            {"id": "ST-301", "title": "수학 II 미적분 극대극소 킬러 5문항", "category": "수학", "status": "active", "detail": "집중 풀이 85분 소요 · 오답 1개"},
            {"id": "ST-302", "title": "수능특강 영어 빈칸추론 3회차", "category": "영어", "status": "pending", "detail": "32~34번 지문 구조 독해 진행중"},
            {"id": "ST-303", "title": "화학 I 중화반응 양적관계 개념정리", "category": "과학", "status": "active", "detail": "마인드맵 노트 작성 완료"},
            {"id": "ST-304", "title": "국어 비문학 인문철학 지문 2세트", "category": "국어", "status": "active", "detail": "지문 분석 및 어휘 퀴즈 100점"},
            {"id": "ST-305", "title": "내일 학습 플래너 스케줄링", "category": "계획", "status": "pending", "detail": "AI 멘토 피드백 반영 후 확정 예정"}
        ],
        "ai_prompts": [
            "수학 미적분 취약 유형(삼각함수 극한 도형)을 보완하는 이번 주 3단계 학습 전략 수립",
            "집중력이 저하되는 오후 3~5시 슬럼프 극복을 위한 뽀모도로 학습 루틴 설계",
            "최근 14일간의 학습 패턴을 분석한 학생 격려 및 학부모 안심 피드백 리포트 작성"
        ],
        "quick_actions": ["스톱워치 타이머 시작", "AI 오답 사진 스캔", "주간 플랜 자동 생성", "성적표 통계 분석"]
    },

    "grammer": {
        "app_id": "grammer",
        "app_name": "Grammar Quest (AI 영문법)",
        "icon": "🔤",
        "category": "education",
        "port": 9014,
        "tagline": "초3~고3 정규 문법 무한 생성 & AI 음성 섀도잉 원어민 발음 코칭",
        "accent_color": "#8b5cf6",
        "gradient": "linear-gradient(135deg, #8b5cf6, #6d28d9)",
        "kpis": [
            {"label": "퀘스트 달성도", "value": "42 / 50", "sub": "레벨 Lv.18 그랜드마스터", "trend": "+3퀘스트", "status": "active"},
            {"label": "음성 발음 정확도", "value": "94.8%", "sub": "억양 및 연음 코칭 완료", "trend": "+2.1%", "status": "healthy"},
            {"label": "어휘 습득량", "value": "1,480 단어", "sub": "STEM / AI 테크 예문", "trend": "+120개", "status": "active"},
            {"label": "원어민 음성 TTS", "value": "초저지연", "sub": "Edge TTS 6개국 억양", "trend": "0.15s", "status": "healthy"}
        ],
        "default_items": [
            {"id": "GQ-401", "title": "수능 킬러 관계대명사 vs 관계부사 판별", "category": "퀘스트", "status": "active", "detail": "10문항 중 10문항 정답 · 콤보 100"},
            {"id": "GQ-402", "title": "AI 논문 발췌문 음성 섀도잉 실전 훈련", "category": "스피킹", "status": "active", "detail": "발음 일치율 96% 달성"},
            {"id": "GQ-403", "title": "가정법 과거완료 조건절 도치 구문", "category": "퀘스트", "status": "pending", "detail": "심화 3단계 연습문제 대기"},
            {"id": "GQ-404", "title": "분사구문 주어 일치 및 독립분사구문", "category": "문법", "status": "active", "detail": "오답 노트 정리 완료"},
            {"id": "GQ-405", "title": "보카 마스터: 반도체·우주항공 테크 어휘", "category": "단어", "status": "active", "detail": "플래시카드 50장 복습 완료"}
        ],
        "ai_prompts": [
            "최신 AI 테크 뉴스 기사에서 고난도 분사구문 문장 3개를 발췌하여 문법 해설 퀴즈 출제",
            "한국인 학습자가 자주 틀리는 관계사 'which vs that' 뉘앙스 비교 가이드 작성",
            "가정법 구문을 활용한 일상 회화 롤플레잉 대화문 스크립트 생성"
        ],
        "quick_actions": ["새 퀘스트 생성", "마이크 음성 진단 시작", "오답 퀴즈 재도전", "어휘 플래시카드"]
    },

    "smartfarm": {
        "app_id": "smartfarm",
        "app_name": "스마트팜 센서 관제",
        "icon": "🌿",
        "category": "iot",
        "port": 9005,
        "tagline": "온실 온습도·CO2·토양수분 IoT 실시간 텔레메트리 및 급수/환풍 원격 자동 제어",
        "accent_color": "#10b981",
        "gradient": "linear-gradient(135deg, #10b981, #059669)",
        "kpis": [
            {"label": "온실 평균온도", "value": "23.8 °C", "sub": "적정 목표(22~25°C) 유지", "trend": "안정", "status": "healthy"},
            {"label": "토양 수분율", "value": "68.2%", "sub": "점적관수 밸브 2구역 대기", "trend": "+1.4%", "status": "healthy"},
            {"label": "CO2 농도", "value": "540 ppm", "sub": "광합성 촉진 수준", "trend": "-15ppm", "status": "active"},
            {"label": "자동 제어 시스템", "value": "스마트 모드", "sub": "환풍팬 · 차광막 연동", "trend": "정상 가동", "status": "active"}
        ],
        "default_items": [
            {"id": "SF-501", "title": "온실 1호기 주 센서 노드 (온·습도·조도)", "category": "센서", "status": "active", "detail": "온도 24.1°C / 습도 67% (배터리 94%)"},
            {"id": "SF-502", "title": "딸기 베드 3번 구역 토양 수분 센서", "category": "센서", "status": "active", "detail": "수분 68.2% · EC 농도 1.4 mS/cm"},
            {"id": "SF-503", "title": "서측 대형 환기팬 2호기", "category": "장치", "status": "active", "detail": "습도 조절 자동 회전중 (RPM 1200)"},
            {"id": "SF-504", "title": "양액 점적 관수 밸브 #1", "category": "급수", "status": "pending", "detail": "다음 스케줄 17:30 관수 예정 (15분간)"},
            {"id": "SF-505", "title": "천창 차광막 모터 액추에이터", "category": "장치", "status": "active", "detail": "일조량 420W/m² 감지 후 30% 전개"}
        ],
        "ai_prompts": [
            "기상청 내일 강우 및 기온 급강하 예보를 반영한 야간 결로 방지 최적 환기 제어 알고리즘 제안",
            "토양 EC 농도 및 수분 변화 추이를 바탕으로 작물 생육 단계별 양액 희석비 추천",
            "센서 데이터 이상 징후 조기 감지 및 병충해 발생 위험도 사전 진단 리포트"
        ],
        "quick_actions": ["원격 관수 수동 시작", "환기팬 즉시 가동", "차광막 열기/닫기", "센서 캘리브레이션"]
    },

    "ai_gwansang": {
        "app_id": "ai_gwansang",
        "app_name": "AI 관상 분석",
        "icon": "🔮",
        "category": "ai_vision",
        "port": 9009,
        "tagline": "얼굴 이미지 랜드마크 분석 및 Gemini 2.5 기반 오행 운세·성향 진단 리포트",
        "accent_color": "#6366f1",
        "gradient": "linear-gradient(135deg, #6366f1, #4f46e5)",
        "kpis": [
            {"label": "누적 분석 건수", "value": "1,842건", "sub": "오늘 48건 요청", "trend": "+18%", "status": "active"},
            {"label": "AI 비전 모델", "value": "Gemini 2.5", "sub": "구글 최신 Flash 멀티모달", "trend": "온라인", "status": "healthy"},
            {"label": "평균 응답 속도", "value": "1.32초", "sub": "초고속 랜드마크 추출", "trend": "-0.2s", "status": "healthy"},
            {"label": "결제 전환율", "value": "42.8%", "sub": "토스페이 심화 리포트", "trend": "+5.4%", "status": "active"}
        ],
        "default_items": [
            {"id": "GS-601", "title": "정면 안면 랜드마크 468포인트 추출", "category": "비전", "status": "active", "detail": "눈매·미간·이마·하관 비율 산출 완료"},
            {"id": "GS-602", "title": "오행 분석: 금(金)기운 42% 리더형", "category": "관상", "status": "active", "detail": "결단력과 추진력이 뛰어난 기업가상"},
            {"id": "GS-603", "title": "재물운 & 사업운 세부 리포트 생성", "category": "운세", "status": "active", "detail": "30대 후반 인생 최대 전성기 도래"},
            {"id": "GS-604", "title": "동물상 분류: 기품 있는 백호상", "category": "분류", "status": "active", "detail": "신뢰감과 온화함을 겸비한 인상"},
            {"id": "GS-605", "title": "심화 프리미엄 관상 리포트 PDF 결제", "category": "결제", "status": "pending", "detail": "토스페이 결제 대기중"}
        ],
        "ai_prompts": [
            "얼굴 랜드마크 비율(이마-코-턱 1:1:0.9)을 동양 전통 마의상법에 대입하여 현대적 리더십 자질로 재해석",
            "호감도를 높이고 첫인상을 개선할 수 있는 표정 트레이닝 및 헤어스타일 제안",
            "올해 하반기 대인관계 및 재물운을 극대화하는 관상학적 조언 작성"
        ],
        "quick_actions": ["웹캠 안면 촬영", "사진 파일 업로드", "샘플 모델 테스트", "PDF 리포트 저장"]
    },

    "face_analy": {
        "app_id": "face_analy",
        "app_name": "테토/에겐 AI 얼굴 분석",
        "icon": "🧑‍🎨",
        "category": "ai_vision",
        "port": 9010,
        "tagline": "AI 기반 테토상 vs 에겐상 비율 정밀 판별 및 맞춤형 퍼스널 스타일링 컨설팅",
        "accent_color": "#ec4899",
        "gradient": "linear-gradient(135deg, #ec4899, #db2777)",
        "kpis": [
            {"label": "얼굴 판정 완료", "value": "984건", "sub": "테토 54% · 에겐 46%", "trend": "+32건", "status": "active"},
            {"label": "웹캠 실시간 FPS", "value": "60 FPS", "sub": "브라우저 온디바이스 연산", "trend": "지연없음", "status": "healthy"},
            {"label": "스타일링 제안수", "value": "2,460회", "sub": "헤어 · 안경 · 메이크업", "trend": "+14%", "status": "active"},
            {"label": "만족도 평점", "value": "4.92 / 5", "sub": "SNS 바이럴 공유 활발", "trend": "최고등급", "status": "healthy"}
        ],
        "default_items": [
            {"id": "FA-701", "title": "테토:에겐 황금비율 판별 (62:38)", "category": "분석", "status": "active", "detail": "선명한 T존과 날렵한 턱선 테토형 우세"},
            {"id": "FA-702", "title": "퍼스널 컬러: 딥 윈터 쿨톤 매칭", "category": "스타일", "status": "active", "detail": "블랙 & 버건디 대비 추천"},
            {"id": "FA-703", "title": "헤어스타일 추천: 세미 리프컷", "category": "헤어", "status": "active", "detail": "광대를 커버하고 턱선을 강조하는 디자인"},
            {"id": "FA-704", "title": "아이웨어 프레임: 보스턴 크라운판토", "category": "패션", "status": "active", "detail": "지적인 이미지를 부각하는 티타늄 안경테"},
            {"id": "FA-705", "title": "결과 카드 인스타그램 스토리 공유", "category": "공유", "status": "pending", "detail": "카드 이미지 다운로드 준비 완료"}
        ],
        "ai_prompts": [
            "테토상 우세 얼굴형에 어울리는 2026 트렌디 오피스룩 패션 및 메이크업 가이드",
            "부드러운 에겐상 분위기를 살려주는 따뜻한 니트 웨어 및 안경 프레임 추천",
            "얼굴형 단점을 커버하고 셀카가 가장 잘 나오는 베스트 촬영 앵글 분석"
        ],
        "quick_actions": ["실시간 웹캠 감지", "사진 업로드", "스타일 무드보드 생성", "인스타 카드 공유"]
    },

    "photos": {
        "app_id": "photos",
        "app_name": "스마트 갤러리 (Immich AI)",
        "icon": "📸",
        "category": "media",
        "port": 9006,
        "tagline": "AI 안면인식, CLIP 자연어 시맨틱 검색, GPS 세계 지도 및 무손실 클라우드 백업",
        "accent_color": "#0ea5e9",
        "gradient": "linear-gradient(135deg, #0ea5e9, #0284c7)",
        "kpis": [
            {"label": "저장 미디어", "value": "24,190장", "sub": "사진 21,800 · 영상 2,390", "trend": "+180장", "status": "active"},
            {"label": "AI 인식 인물", "value": "48명", "sub": "클러스터링 분류 완료", "trend": "100%", "status": "healthy"},
            {"label": "시맨틱 색인", "value": "CLIP AI", "sub": "자연어 문장 검색 지원", "trend": "색인완료", "status": "healthy"},
            {"label": "모바일 자동동기화", "value": "연결됨", "sub": "와이파이 백업 대기 0건", "trend": "실시간", "status": "active"}
        ],
        "default_items": [
            {"id": "PH-801", "title": "가족 제주도 여행 2026 (사진 142장)", "category": "앨범", "status": "active", "detail": "위치 태그: 서귀포시 · 인물 4명 인식"},
            {"id": "PH-802", "title": "서울 벚꽃 축제 파노라마 고화질", "category": "사진", "status": "active", "detail": "2400만 화소 · CLIP 태그 '봄, 꽃길, 노을'"},
            {"id": "PH-803", "title": "프로젝트 회의 화이트보드 스냅", "category": "문서", "status": "active", "detail": "AI OCR 텍스트 자동 추출 완료"},
            {"id": "PH-804", "title": "반려견 산책 4K 영상 60fps", "category": "영상", "status": "active", "detail": "1분 45초 · 얼굴 및 행동 태그 '반려동물'"},
            {"id": "PH-805", "title": "중복 사진 128장 정리 추천", "category": "최적화", "status": "pending", "detail": "저장공간 1.4GB 절약 가능"}
        ],
        "ai_prompts": [
            "'바닷가 일몰을 배경으로 웃고 있는 인물 사진' 시맨틱 검색 결과 큐레이션 및 베스트 컷 선정",
            "지난 1년간의 여행 사진들을 요약하는 스마트 포토북 스토리라인 및 캡션 작성",
            "유사 중복 사진 자동 선별 및 스마트 저장공간 다이어트 제안"
        ],
        "quick_actions": ["새 앨범 만들기", "미디어 일괄 업로드", "인물 태그 관리", "GPS 지도 보기"]
    },

    "videobooth": {
        "app_id": "videobooth",
        "app_name": "레트로 TV 비디오 부스",
        "icon": "📺",
        "category": "media",
        "port": 9013,
        "tagline": "브라운관 TV 인터랙티브 동영상 방명록, 레트로 필터 녹화 및 음성 카운트다운",
        "accent_color": "#ef4444",
        "gradient": "linear-gradient(135deg, #ef4444, #dc2626)",
        "kpis": [
            {"label": "녹화된 비디오", "value": "148편", "sub": "평균 길이 22.4초", "trend": "+12편", "status": "active"},
            {"label": "레트로 CRT 필터", "value": "주사선 FX", "sub": "RGB 왜곡 · 글리치 셰이더", "trend": "온라인", "status": "healthy"},
            {"label": "부스 방문자수", "value": "312명", "sub": "인터랙티브 방명록 참여", "trend": "+45명", "status": "active"},
            {"label": "TTS 카운트다운", "value": "준비완료", "sub": "음성 안내 & 찰칵 효과음", "trend": "정상", "status": "healthy"}
        ],
        "default_items": [
            {"id": "VB-901", "title": "오프닝 방명록 축하 영상 #148", "category": "녹화", "status": "active", "detail": "20초 · CRT 브라운관 필터 렌더링 완료"},
            {"id": "VB-902", "title": "대학 동기 모임 레트로 비디오 #147", "category": "녹화", "status": "active", "detail": "15초 · 네온사인 자막 오버레이"},
            {"id": "VB-903", "title": "스타트업 런칭 기념 인터뷰 클립 #146", "category": "녹화", "status": "active", "detail": "30초 · 웹캠 무손실 녹화 완료"},
            {"id": "VB-904", "title": "빈티지 흑백 모노톤 필터 프리셋", "category": "필터", "status": "active", "detail": "1960년대 클래식 브라운관 룩"},
            {"id": "VB-905", "title": "인기 방명록 영상 하이라이트 릴스", "category": "편집", "status": "pending", "detail": "자동 쇼츠 합성 렌더링 대기중"}
        ],
        "ai_prompts": [
            "레트로 80년대 VHS 테이프 감성의 15초 바이럴 비디오 방명록 연출 콘셉트 기획",
            "촬영 카운트다운 중 화면에 출력할 위트 있는 랜덤 축하 문구 10개 생성",
            "방명록 영상들의 오디오를 분석하여 하이라이트 웃음 구간 자동 추출 가이드"
        ],
        "quick_actions": ["3초 카운트 녹화 시작", "CRT 필터 토글", "최신 갤러리 재생", "QR 코드 다운로드"]
    },

    "ytdownloader": {
        "app_id": "ytdownloader",
        "app_name": "유튜브 미디어 다운로더",
        "icon": "🎬",
        "category": "media",
        "port": 9008,
        "tagline": "최고화질 4K MP4/MP3 고속 추출, 미디어 아카이브 및 AI 핵심 3줄 요약 리포트",
        "accent_color": "#e11d48",
        "gradient": "linear-gradient(135deg, #e11d48, #be123c)",
        "kpis": [
            {"label": "다운로드 완료", "value": "184건", "sub": "금일 14건 처리", "trend": "+8건", "status": "active"},
            {"label": "AI 3줄 요약", "value": "98건", "sub": "자막 기반 핵심 인사이트", "trend": "100%", "status": "healthy"},
            {"label": "절약된 대역폭", "value": "42.8 GB", "sub": "로컬 고속 캐싱 엔진", "trend": "+4.2GB", "status": "active"},
            {"label": "다운로드 큐", "value": "1건 대기", "sub": "yt-dlp 최고속 인코더", "trend": "0.8x 남음", "status": "healthy"}
        ],
        "default_items": [
            {"id": "YT-1001", "title": "AI 개발자 콘퍼런스 2026 기조연설 (4K)", "category": "비디오", "status": "active", "detail": "1080p MP4 · 1.2GB · 3줄 요약 완료"},
            {"id": "YT-1002", "title": "코딩할 때 듣기 좋은 로우파이 비트 (1시간)", "category": "오디오", "status": "active", "detail": "320kbps MP3 무손실 오디오 추출 완료"},
            {"id": "YT-1003", "title": "파이썬 비동기 FastAPI 완벽 마스터 강의", "category": "강의", "status": "active", "detail": "타임스탬프 목차 및 핵심 스크립트 저장"},
            {"id": "YT-1004", "title": "차세대 웹 프레임워크 벤치마크 영상", "category": "비디오", "status": "pending", "detail": "다운로드 진행중 (78% 완료)"},
            {"id": "YT-1005", "title": "다운로드 완료 파일 자동 NAS 동기화", "category": "스토리지", "status": "active", "detail": "L: 드라이브 통합 아카이브 전송"}
        ],
        "ai_prompts": [
            "45분짜리 테크 세미나 영상의 자막 스크립트를 분석하여 3줄 핵심 요약 및 타임스탬프 목차 작성",
            "동영상 내용 중 실무에 즉시 적용 가능한 체크리스트 5가지 도출",
            "영어 IT 팟캐스트 자막에서 고급 실무 표현 10개 추출 및 한글 해설 제공"
        ],
        "quick_actions": ["유튜브 URL 붙여넣기", "MP3 오디오만 추출", "AI 3줄 요약 보기", "다운로드 폴더 열기"]
    },

    "mqhome": {
        "app_id": "mqhome",
        "app_name": "MQnet 브랜드 홈페이지",
        "icon": "🌐",
        "category": "portal",
        "port": 9001,
        "tagline": "MQnet 혁신 IT 솔루션 브랜드 소개, 15개 통합 제품 라인업 쇼케이스 및 도입 문의",
        "accent_color": "#6366f1",
        "gradient": "linear-gradient(135deg, #6366f1, #3b82f6)",
        "kpis": [
            {"label": "월간 순방문자", "value": "84,200명", "sub": "글로벌 B2B 트래픽", "trend": "+24.5%", "status": "active"},
            {"label": "제품 쇼케이스", "value": "15개 SaaS", "sub": "원클릭 포털 허브 연결", "trend": "전체 정상", "status": "healthy"},
            {"label": "통합 API 호출", "value": "1.28M", "sub": "게이트웨이 통합 라우팅", "trend": "99.99%", "status": "healthy"},
            {"label": "엔터프라이즈 문의", "value": "38건/주", "sub": "솔루션 도입 상담", "trend": "+12건", "status": "active"}
        ],
        "default_items": [
            {"id": "MH-1101", "title": "15개 통합 Multi-SaaS 포털 쇼케이스 배포", "category": "플랫폼", "status": "active", "detail": "포트 9000 통합 게이트웨이 연동 완료"},
            {"id": "MH-1102", "title": "인터랙티브 파티클 3D 히어로 애니메이션", "category": "디자인", "status": "active", "detail": "초당 60프레임 경량 렌더링 최적화"},
            {"id": "MH-1103", "title": "MQnet 기술 백서 v2.5 업데이트 공개", "category": "문서", "status": "active", "detail": "Coolify 클라우드 배포 가이드 수록"},
            {"id": "MH-1104", "title": "엔터프라이즈 고객사 맞춤형 온프레미스 도입 문의", "category": "영업", "status": "pending", "detail": "제안서 검토 및 기술 미팅 일정 조율중"},
            {"id": "MH-1105", "title": "글로벌 다국어(한국어/영어/일본어) 지원", "category": "글로벌", "status": "active", "detail": "i18n 언어팩 로드 완료"}
        ],
        "ai_prompts": [
            "MQnet 15개 SaaS의 통합 시너지를 강조하는 글로벌 B2B 랜딩페이지 헤드라인 및 가치 제안 카피 작성",
            "대기업 IT 총괄 책임자 대상 클라우드 비용 60% 절감 솔루션 소개 이메일 작성",
            "고객사 업종(카페/학원/스마트팜/미디어)에 맞춘 맞춤형 솔루션 패키지 조합 제안"
        ],
        "quick_actions": ["쇼케이스 데모 실행", "기술 백서 다운로드", "도입 문의 작성", "포털 대시보드 이동"]
    },

    "filebrowser": {
        "app_id": "filebrowser",
        "app_name": "통합 파일 탐색기",
        "icon": "📁",
        "category": "utility",
        "port": 9007,
        "tagline": "대용량 클라우드 파일 매니저, 문서·음악·영상 스트리밍 및 안전한 공유 링크",
        "accent_color": "#64748b",
        "gradient": "linear-gradient(135deg, #64748b, #475569)",
        "kpis": [
            {"label": "스토리지 사용량", "value": "4.2 / 8.0 TB", "sub": "사용률 52.5% 여유", "trend": "안전", "status": "healthy"},
            {"label": "색인된 파일수", "value": "148,200개", "sub": "문서 · 미디어 · 백업", "trend": "+1,240개", "status": "active"},
            {"label": "오늘 전송 대역폭", "value": "14.8 GB", "sub": "고속 파일 업·다운로드", "trend": "+2.4GB", "status": "active"},
            {"label": "암호화 보안", "value": "AES-256", "sub": "토큰 인증 안전 공유", "trend": "최고등급", "status": "healthy"}
        ],
        "default_items": [
            {"id": "FB-1201", "title": "MQnet_통합_아키텍처_설계서_v3.pdf", "category": "문서", "status": "active", "detail": "14.2 MB · 비밀번호 보호 공유 링크 활성"},
            {"id": "FB-1202", "title": "2026_데이터베이스_정기백업_archive.zip", "category": "백업", "status": "active", "detail": "2.4 GB · 무결성 검증 완료"},
            {"id": "FB-1203", "title": "UI_디자인_에셋_팩_Figma_export.tar.gz", "category": "에셋", "status": "active", "detail": "520 MB · 프론트엔드 팀 공유"},
            {"id": "FB-1204", "title": "회사 로고 및 홍보 비디오 클립 4K", "category": "미디어", "status": "active", "detail": "1.8 GB · 웹 내장 플레이어 스트리밍 지원"},
            {"id": "FB-1205", "title": "30일 이상 미사용 임시 캐시 파일 정리", "category": "정리", "status": "pending", "detail": "임시 파일 4.8GB 삭제 대기"}
        ],
        "ai_prompts": [
            "지정된 폴더 내 30일 이상 미사용 대용량 파일 정리 및 아카이빙 자동화 스크립트 작성",
            "외부 파트너사 협업을 위한 7일 유효기간 일회용 보안 공유 링크 정책 가이드 수립",
            "대용량 미디어 파일 검색 속도 개선을 위한 태그 기반 폴더 구조화 방안 제안"
        ],
        "quick_actions": ["새 폴더 생성", "파일 드래그 업로드", "보안 공유 링크 발급", "스토리지 검사"]
    },

    "clock": {
        "app_id": "clock",
        "app_name": "모던 스마트 클락",
        "icon": "⏰",
        "category": "utility",
        "port": 9012,
        "tagline": "네온 아날로그/디지털 듀얼 시계, 글로벌 5대 도시 세계시 및 포커스 뽀모도로",
        "accent_color": "#06b6d4",
        "gradient": "linear-gradient(135deg, #06b6d4, #0891b2)",
        "kpis": [
            {"label": "NTP 동기화 오차", "value": "±2 ms", "sub": "한국표준시 정밀 동기화", "trend": "최고정밀", "status": "healthy"},
            {"label": "완료 뽀모도로", "value": "38 세션", "sub": "오늘 총 집중시간 15.8h", "trend": "+6세션", "status": "active"},
            {"label": "글로벌 모니터링", "value": "5대 도시", "sub": "서울·도쿄·런던·뉴욕·파리", "trend": "실시간", "status": "active"},
            {"label": "디스플레이 주사율", "value": "120 FPS", "sub": "초침 부드러운 렌더링", "trend": "부드러움", "status": "healthy"}
        ],
        "default_items": [
            {"id": "CK-1301", "title": "서울 (Seoul / KST) - 홈 타임존", "category": "세계시", "status": "active", "detail": "UTC+9:00 · 대한민국 표준시"},
            {"id": "CK-1302", "title": "뉴욕 (New York / EDT) - 글로벌 지사", "category": "세계시", "status": "active", "detail": "UTC-4:00 · 미국 동부 서머타임"},
            {"id": "CK-1303", "title": "런던 (London / BST) - 금융 거래소", "category": "세계시", "status": "active", "detail": "UTC+1:00 · 영국 서머타임"},
            {"id": "CK-1304", "title": "25분 집중 코딩 뽀모도로 타이머", "category": "타이머", "status": "active", "detail": "진행중 (잔여 16분 42초 · 휴식 5분)"},
            {"id": "CK-1305", "title": "오전 09:00 데일리 스크럼 알람", "category": "알람", "status": "pending", "detail": "월~금 반복 · 은은한 차임 사운드"}
        ],
        "ai_prompts": [
            "서울, 런던, 뉴욕 팀원들이 동시에 참여할 수 있는 최적의 화상회의 골든타임 슬롯 추천",
            "업무 생산성을 극대화하는 50분 집중 / 10분 스트레칭 바이오리듬 타이머 스케줄 제안",
            "야간 교대근무자 및 수험생을 위한 서카디안 리듬 수면 및 기상 알람 계획표 작성"
        ],
        "quick_actions": ["뽀모도로 타이머 시작", "스톱워치 랩타임 측정", "새 세계시 도시 추가", "다크 네온 모드 토글"]
    },

    "ironman": {
        "app_id": "ironman",
        "app_name": "아이언맨 제스처 게임",
        "icon": "🎮",
        "category": "game",
        "port": 9011,
        "tagline": "웹캠 실시간 핸드 트래킹, p5.js 리펄서 빔 인터랙션 및 글로벌 랭킹 시스템",
        "accent_color": "#eab308",
        "gradient": "linear-gradient(135deg, #eab308, #ca8a04)",
        "kpis": [
            {"label": "플레이 세션수", "value": "4,210회", "sub": "오늘 142회 플레이", "trend": "+28%", "status": "active"},
            {"label": "최고 랭킹 점수", "value": "98,400점", "sub": "콤보 48연속 격추", "trend": "신기록", "status": "healthy"},
            {"label": "핸드 트래킹 정밀도", "value": "99.2%", "sub": "MediaPipe 실시간 좌표", "trend": "초정밀", "status": "healthy"},
            {"label": "오디오 FX 반응", "value": "16 ms", "sub": "리펄서 빔 사운드 초저지연", "trend": "즉각반응", "status": "healthy"}
        ],
        "default_items": [
            {"id": "IM-1401", "title": "글로벌 랭킹 1위: Stark_Pilot (98,400점)", "category": "랭킹", "status": "active", "detail": "보스 드론 12기 격추 · 명중률 94%"},
            {"id": "IM-1402", "title": "오른손 손바닥 리펄서 빔 조준 시스템", "category": "인식", "status": "active", "detail": "손바닥 펼침 제스처 감지 시 충전 발사"},
            {"id": "IM-1403", "title": "왼손 가슴 아크 리액터 파워 차지", "category": "제스처", "status": "active", "detail": "주먹 쥐기 감지 시 전체 화면 필살기 충전"},
            {"id": "IM-1404", "title": "동적 난이도 조절 적 드론 웨이브 8단계", "category": "게임", "status": "active", "detail": "스피드형 드론 4기 출현"},
            {"id": "IM-1405", "title": "게임 오버 화면 점수 서버 리더보드 저장", "category": "데이터", "status": "pending", "detail": "SQLite 랭킹 DB 동기화 대기"}
        ],
        "ai_prompts": [
            "플레이어의 핸드 모션 속도와 반응 시간을 분석하여 몰입감을 높이는 동적 드론 스폰 패턴 설계",
            "아이언맨 자비스(JARVIS) 스타일의 위트 있는 게임 인게임 음성 피드백 대사 10개 생성",
            "제스처 피로도를 줄이면서 운동 효과를 줄 수 있는 홈 피트니스 게이미피케이션 요소 기획"
        ],
        "quick_actions": ["웹캠 트래킹 게임 시작", "리더보드 순위표 확인", "조작 가이드 보기", "사운드 효과 테스트"]
    },

    "n8n": {
        "app_id": "n8n",
        "app_name": "n8n AI 워크플로우 자동화",
        "icon": "⚡",
        "category": "automation",
        "port": 5678,
        "tagline": "비주얼 노드 기반 엔드투엔드 자동화, 농협 계좌 입금 알림 파싱 및 AI 에이전트 연동",
        "accent_color": "#f97316",
        "gradient": "linear-gradient(135deg, #f97316, #c2410c)",
        "kpis": [
            {"label": "활성 워크플로우", "value": "16개", "sub": "무중단 백그라운드 구동", "trend": "100%", "status": "healthy"},
            {"label": "오늘 실행 트리거", "value": "3,420회", "sub": "웹훅 · 크론 · 이메일", "trend": "+18.2%", "status": "active"},
            {"label": "농협 입금 파싱", "value": "성공률 100%", "sub": "실시간 구글 시트 기장", "trend": "무오류", "status": "healthy"},
            {"label": "워크플로우 실패율", "value": "0.02%", "sub": "자동 재시도 3회 정책", "trend": "안정", "status": "healthy"}
        ],
        "default_items": [
            {"id": "N8N-1501", "title": "농협 스마트뱅킹 입금 알림 -> 구글 시트 자동 기장", "category": "금융", "status": "active", "detail": "성공 28건 처리 · 장부 잔액 자동 계산"},
            {"id": "N8N-1502", "title": "토스페이 결제 완료 웹훅 -> 슬랙 채널 실시간 알림", "category": "알림", "status": "active", "detail": "지연시간 0.3초 · 구매자 및 금액 브로드캐스트"},
            {"id": "N8N-1503", "title": "매일 자정 통합 데이터베이스 SQLite S3 자동 백업", "category": "백업", "status": "active", "detail": "압축률 64% · 백업 완료 확인 메일 수신"},
            {"id": "N8N-1504", "title": "Gemini AI 고객 문의 자동 분류 및 답변 초안 작성", "category": "AI", "status": "active", "detail": "고객 지원 헬프데스크 티켓 연동"},
            {"id": "N8N-1505", "title": "주간 SaaS 매출 및 서버 리소스 통계 리포트 생성", "category": "리포트", "status": "pending", "detail": "매주 월요일 오전 8시 트리거 대기"}
        ],
        "ai_prompts": [
            "수신된 다양한 은행 입금 확인 이메일에서 거래일시, 입금자명, 금액을 정규식 및 LLM으로 완벽 파싱하는 커스텀 노드 코드 작성",
            "서버 CPU/메모리 부하 발생 시 관리자 텔레그램으로 경고를 보내고 자동 재기동하는 장애 복구 워크플로우 설계",
            "신규 가입 고객 대상 3일차/7일차 맞춤형 온보딩 메시지를 자동 발송하는 마케팅 시나리오 구성"
        ],
        "quick_actions": ["공식 n8n 편집기 열기", "입금 알림 테스트 트리거", "워크플로우 즉시 실행", "실행 로그 확인"]
    }
}


def get_preset(app_id: str) -> Dict[str, Any]:
    """해당 app_id에 맞는 프리셋 반환, 없을 경우 기본 studycafe 반환"""
    return SAAS_PRESETS.get(app_id, SAAS_PRESETS["studycafe"])


def list_all_presets() -> List[Dict[str, Any]]:
    """모든 15개 SaaS 프리셋 요약 목록 반환"""
    return [
        {
            "app_id": p["app_id"],
            "app_name": p["app_name"],
            "icon": p["icon"],
            "category": p["category"],
            "port": p["port"],
            "tagline": p["tagline"],
            "accent_color": p["accent_color"],
            "gradient": p["gradient"],
            "item_count": len(p["default_items"]),
            "kpis": p["kpis"],
            "quick_actions": p["quick_actions"]
        }
        for p in SAAS_PRESETS.values()
    ]
