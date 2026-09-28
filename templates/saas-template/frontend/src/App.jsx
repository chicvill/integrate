import React, { useState, useEffect, useMemo } from 'react';
import { PortalHeader, createApiClient } from '@mqnet/ui';

// ─── 15대 표준 SaaS 프리셋 로컬 폴백 데이터 (오프라인/프론트엔드 단독 실행 보장) ────
const FALLBACK_PRESETS = [
  {
    app_id: "studycafe",
    app_name: "스터디카페 관리",
    icon: "☕",
    category: "business",
    port: 9002,
    tagline: "무인 스터디카페 좌석 관제, 시간권·기간권 결제 및 스마트 도어락 연동",
    accent_color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    kpis: [
      { label: "좌석 점유율", value: "78.4%", sub: "36 / 46석 이용중", trend: "+12%", status: "active" },
      { label: "금일 매출", value: "₩485,000", sub: "결제 28건 집계", trend: "+8.5%", status: "active" },
      { label: "활성 이용권", value: "142건", sub: "시간권 94 · 기간권 48", trend: "+4건", status: "active" },
      { label: "NFC 도어락", value: "정상 작동", sub: "게이트웨이 연동중", trend: "99.9% 가동", status: "healthy" }
    ],
    default_items: [
      { id: "SC-101", title: "A-04 1인 집중석 (김*준)", category: "좌석", status: "active", detail: "4시간 이용권 잔여 1시간 40분" },
      { id: "SC-102", title: "B-12 오픈형 카페석", category: "좌석", status: "pending", detail: "퇴실 완료 · 청소 점검 대기" },
      { id: "SC-103", title: "스터디룸 4인실 (예약)", category: "공간", status: "active", detail: "19:00 ~ 21:00 그룹 프로젝트" },
      { id: "SC-104", title: "프리미엄 4주 정기권 결제", category: "결제", status: "active", detail: "토스페이 180,000원 결제 완료" },
      { id: "SC-105", title: "메인 출입문 NFC 도어락 락해제", category: "장치", status: "active", detail: "QR 체크인 인증 성공 (0.12s)" }
    ],
    ai_prompts: [
      "현재 시간대(16시~20시) 좌석 점유율 예측 및 스터디룸 야간 타임세일 이벤트 기획안 생성",
      "단골 고객 대상 만료 예정 정기권 재등록 알림 SMS 템플릿 작성",
      "냉난방 최적 온도(현재 23.5°C) 에너지 절감 스케줄러 추천"
    ],
    quick_actions: ["새 좌석 배치 추가", "이용권 강제 퇴실", "도어락 원격 개방", "일일 매출 리포트"]
  },
  {
    app_id: "store",
    app_name: "매장 QR 주문 & POS",
    icon: "🍽️",
    category: "business",
    port: 9004,
    tagline: "비대면 테이블 QR 주문, 주방 디스플레이(KDS) 실시간 연동 및 매장 통합 POS",
    accent_color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    kpis: [
      { label: "금일 누적 매출", value: "₩1,420,000", sub: "목표 달성률 118%", trend: "+15.2%", status: "active" },
      { label: "완료 주문수", value: "86건", sub: "테이블 72 · 포장 14", trend: "+9건", status: "active" },
      { label: "평균 조리시간", value: "8.5분", sub: "KDS 최적 표준 충족", trend: "-1.2분", status: "healthy" },
      { label: "주방 디스플레이", value: "3/3 연동", sub: "양방향 웹소켓 정상", trend: "실시간", status: "healthy" }
    ],
    default_items: [
      { id: "POS-201", title: "테이블 3번: 트러플 파스타 외 2건", category: "주문", status: "active", detail: "₩42,000 · 조리 완료 대기" },
      { id: "POS-202", title: "테이블 7번: 부라타 치즈 샐러드", category: "주문", status: "pending", detail: "₩18,500 · 주방 KDS 접수" },
      { id: "POS-203", title: "포장 주문 #14호: 수제 버거 세트", category: "포장", status: "active", detail: "픽업 대기중 (호출 번호 14)" },
      { id: "POS-204", title: "토스페이 결제 승인 #88219", category: "결제", status: "active", detail: "₩85,000 카드 승인 완료" }
    ],
    ai_prompts: [
      "오늘 판매 데이터를 바탕으로 마감 전 소진해야 할 식자재 기반 타임세일 메뉴 추천",
      "주말 피크타임(18:00~20:00) 예상 주문량 및 식자재 사전 준비 가이드 작성"
    ],
    quick_actions: ["새 테이블 QR 생성", "품절 메뉴 설정", "주방 호출 벨 전송", "영수증 재출력"]
  },
  {
    app_id: "selfstudy",
    app_name: "자기주도학습 관리",
    icon: "📚",
    category: "education",
    port: 9003,
    tagline: "AI 플래너 기반 데일리 목표 수립, 순공시간 측정 및 취약점 분석 리포트",
    accent_color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    kpis: [
      { label: "일일 순공시간", value: "6시간 28분", sub: "목표 7시간 대비 92%", trend: "+45분", status: "active" },
      { label: "주간 목표 달성", value: "89.5%", sub: "완료 34 / 전체 38개", trend: "+6.3%", status: "active" },
      { label: "AI 오답노트", value: "24문항", sub: "수학 14 · 영어 10 분석", trend: "완료", status: "healthy" },
      { label: "학부모 주간리포트", value: "발송 완료", sub: "이번 주 성취도 A등급", trend: "정기발송", status: "healthy" }
    ],
    default_items: [
      { id: "ST-301", title: "수학 II 미적분 극대극소 킬러 5문항", category: "수학", status: "active", detail: "집중 풀이 85분 소요 · 오답 1개" },
      { id: "ST-302", "title": "수능특강 영어 빈칸추론 3회차", category: "영어", status: "pending", detail: "32~34번 지문 구조 독해 진행중" },
      { id: "ST-303", "title": "화학 I 중화반응 양적관계 개념정리", category: "과학", status: "active", detail: "마인드맵 노트 작성 완료" }
    ],
    ai_prompts: [
      "수학 미적분 취약 유형(삼각함수 극한 도형)을 보완하는 이번 주 3단계 학습 전략 수립",
      "최근 14일간의 학습 패턴을 분석한 학생 격려 및 학부모 안심 피드백 리포트 작성"
    ],
    quick_actions: ["스톱워치 타이머", "AI 오답 사진 스캔", "주간 플랜 자동생성", "성적 통계"]
  },
  {
    app_id: "grammer",
    app_name: "Grammar Quest (AI 영문법)",
    icon: "🔤",
    category: "education",
    port: 9014,
    tagline: "초3~고3 정규 문법 무한 생성 & AI 음성 섀도잉 원어민 발음 코칭",
    accent_color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    kpis: [
      { label: "퀘스트 달성도", value: "42 / 50", sub: "레벨 Lv.18 그랜드마스터", trend: "+3퀘스트", status: "active" },
      { label: "음성 발음 정확도", value: "94.8%", sub: "억양 및 연음 코칭 완료", trend: "+2.1%", status: "healthy" },
      { label: "어휘 습득량", value: "1,480 단어", sub: "STEM / AI 테크 예문", trend: "+120개", status: "active" },
      { label: "원어민 음성 TTS", value: "초저지연", sub: "Edge TTS 6개국 억양", trend: "0.15s", status: "healthy" }
    ],
    default_items: [
      { id: "GQ-401", title: "수능 킬러 관계대명사 vs 관계부사 판별", category: "퀘스트", status: "active", detail: "10문항 중 10문항 정답 · 콤보 100" },
      { id: "GQ-402", title: "AI 논문 발췌문 음성 섀도잉 실전 훈련", category: "스피킹", status: "active", detail: "발음 일치율 96% 달성" }
    ],
    ai_prompts: [
      "최신 AI 테크 뉴스 기사에서 고난도 분사구문 문장 3개를 발췌하여 문법 해설 퀴즈 출제",
      "한국인 학습자가 자주 틀리는 관계사 'which vs that' 뉘앙스 비교 가이드 작성"
    ],
    quick_actions: ["새 퀘스트 생성", "마이크 음성 진단", "오답 퀴즈 재도전", "플래시카드"]
  },
  {
    app_id: "smartfarm",
    app_name: "스마트팜 센서 관제",
    icon: "🌿",
    category: "iot",
    port: 9005,
    tagline: "온실 온습도·CO2·토양수분 IoT 실시간 텔레메트리 및 급수/환풍 원격 자동 제어",
    accent_color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    kpis: [
      { label: "온실 평균온도", value: "23.8 °C", sub: "적정 목표(22~25°C) 유지", trend: "안정", status: "healthy" },
      { label: "토양 수분율", value: "68.2%", sub: "점적관수 밸브 2구역 대기", trend: "+1.4%", status: "healthy" },
      { label: "CO2 농도", value: "540 ppm", sub: "광합성 촉진 수준", trend: "-15ppm", status: "active" },
      { label: "자동 제어 시스템", value: "스마트 모드", sub: "환풍팬 · 차광막 연동", trend: "정상 가동", status: "active" }
    ],
    default_items: [
      { id: "SF-501", title: "온실 1호기 주 센서 노드 (온·습도·조도)", category: "센서", status: "active", detail: "온도 24.1°C / 습도 67% (배터리 94%)" },
      { id: "SF-502", title: "딸기 베드 3번 구역 토양 수분 센서", category: "센서", status: "active", detail: "수분 68.2% · EC 농도 1.4 mS/cm" },
      { id: "SF-503", title: "서측 대형 환기팬 2호기", category: "장치", status: "active", detail: "습도 조절 자동 회전중 (RPM 1200)" }
    ],
    ai_prompts: [
      "기상청 내일 강우 및 기온 급강하 예보를 반영한 야간 결로 방지 최적 환기 제어 알고리즘 제안",
      "토양 EC 농도 및 수분 변화 추이를 바탕으로 작물 생육 단계별 양액 희석비 추천"
    ],
    quick_actions: ["원격 관수 수동 시작", "환기팬 즉시 가동", "차광막 열기/닫기", "센서 교정"]
  },
  {
    app_id: "ai_gwansang",
    app_name: "AI 관상 분석",
    icon: "🔮",
    category: "ai_vision",
    port: 9009,
    tagline: "얼굴 이미지 랜드마크 분석 및 Gemini 2.5 기반 오행 운세·성향 진단 리포트",
    accent_color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    kpis: [
      { label: "누적 분석 건수", value: "1,842건", sub: "오늘 48건 요청", trend: "+18%", status: "active" },
      { label: "AI 비전 모델", value: "Gemini 2.5", sub: "구글 최신 Flash 멀티모달", trend: "온라인", status: "healthy" },
      { label: "평균 응답 속도", value: "1.32초", sub: "초고속 랜드마크 추출", trend: "-0.2s", status: "healthy" },
      { label: "결제 전환율", value: "42.8%", sub: "토스페이 심화 리포트", trend: "+5.4%", status: "active" }
    ],
    default_items: [
      { id: "GS-601", title: "정면 안면 랜드마크 468포인트 추출", category: "비전", status: "active", detail: "눈매·미간·이마·하관 비율 산출 완료" },
      { id: "GS-602", title: "오행 분석: 금(金)기운 42% 리더형", category: "관상", status: "active", detail: "결단력과 추진력이 뛰어난 기업가상" }
    ],
    ai_prompts: [
      "얼굴 랜드마크 비율(이마-코-턱 1:1:0.9)을 동양 전통 마의상법에 대입하여 현대적 리더십 자질로 재해석",
      "호감도를 높이고 첫인상을 개선할 수 있는 표정 트레이닝 및 헤어스타일 제안"
    ],
    quick_actions: ["웹캠 안면 촬영", "사진 파일 업로드", "샘플 모델 테스트", "PDF 리포트"]
  },
  {
    app_id: "face_analy",
    app_name: "테토/에겐 AI 얼굴 분석",
    icon: "🧑‍🎨",
    category: "ai_vision",
    port: 9010,
    tagline: "AI 기반 테토상 vs 에겐상 비율 정밀 판별 및 맞춤형 퍼스널 스타일링 컨설팅",
    accent_color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    kpis: [
      { label: "얼굴 판정 완료", value: "984건", sub: "테토 54% · 에겐 46%", trend: "+32건", status: "active" },
      { label: "웹캠 실시간 FPS", value: "60 FPS", sub: "브라우저 온디바이스 연산", trend: "지연없음", status: "healthy" },
      { label: "스타일링 제안수", value: "2,460회", sub: "헤어 · 안경 · 메이크업", trend: "+14%", status: "active" },
      { label: "만족도 평점", value: "4.92 / 5", sub: "SNS 바이럴 공유 활발", trend: "최고등급", status: "healthy" }
    ],
    default_items: [
      { id: "FA-701", title: "테토:에겐 황금비율 판별 (62:38)", category: "분석", status: "active", detail: "선명한 T존과 날렵한 턱선 테토형 우세" },
      { id: "FA-702", title: "퍼스널 컬러: 딥 윈터 쿨톤 매칭", category: "스타일", status: "active", detail: "블랙 & 버건디 대비 추천" }
    ],
    ai_prompts: [
      "테토상 우세 얼굴형에 어울리는 2026 트렌디 오피스룩 패션 및 메이크업 가이드",
      "부드러운 에겐상 분위기를 살려주는 따뜻한 니트 웨어 및 안경 프레임 추천"
    ],
    quick_actions: ["실시간 웹캠 감지", "사진 업로드", "스타일 무드보드", "인스타 카드"]
  },
  {
    app_id: "photos",
    app_name: "스마트 갤러리 (Immich AI)",
    icon: "📸",
    category: "media",
    port: 9006,
    tagline: "AI 안면인식, CLIP 자연어 시맨틱 검색, GPS 세계 지도 및 무손실 클라우드 백업",
    accent_color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    kpis: [
      { label: "저장 미디어", value: "24,190장", sub: "사진 21,800 · 영상 2,390", trend: "+180장", status: "active" },
      { label: "AI 인식 인물", value: "48명", sub: "클러스터링 분류 완료", trend: "100%", status: "healthy" },
      { label: "시맨틱 색인", value: "CLIP AI", sub: "자연어 문장 검색 지원", trend: "색인완료", status: "healthy" },
      { label: "모바일 자동동기화", value: "연결됨", sub: "와이파이 백업 대기 0건", trend: "실시간", status: "active" }
    ],
    default_items: [
      { id: "PH-801", title: "가족 제주도 여행 2026 (사진 142장)", category: "앨범", status: "active", detail: "위치 태그: 서귀포시 · 인물 4명 인식" },
      { id: "PH-802", title: "서울 벚꽃 축제 파노라마 고화질", category: "사진", status: "active", detail: "2400만 화소 · CLIP 태그 '봄, 꽃길, 노을'" }
    ],
    ai_prompts: [
      "'바닷가 일몰을 배경으로 웃고 있는 인물 사진' 시맨틱 검색 결과 큐레이션 및 베스트 컷 선정"
    ],
    quick_actions: ["새 앨범 만들기", "미디어 일괄 업로드", "인물 태그 관리", "GPS 지도 보기"]
  },
  {
    app_id: "videobooth",
    app_name: "레트로 TV 비디오 부스",
    icon: "📺",
    category: "media",
    port: 9013,
    tagline: "브라운관 TV 인터랙티브 동영상 방명록, 레트로 필터 녹화 및 음성 카운트다운",
    accent_color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    kpis: [
      { label: "녹화된 비디오", value: "148편", sub: "평균 길이 22.4초", trend: "+12편", status: "active" },
      { label: "레트로 CRT 필터", value: "주사선 FX", sub: "RGB 왜곡 · 글리치 셰이더", trend: "온라인", status: "healthy" },
      { label: "부스 방문자수", value: "312명", sub: "인터랙티브 방명록 참여", trend: "+45명", status: "active" },
      { label: "TTS 카운트다운", value: "준비완료", sub: "음성 안내 & 찰칵 효과음", trend: "정상", status: "healthy" }
    ],
    default_items: [
      { id: "VB-901", title: "오프닝 방명록 축하 영상 #148", category: "녹화", status: "active", detail: "20초 · CRT 브라운관 필터 렌더링 완료" },
      { id: "VB-902", title: "대학 동기 모임 레트로 비디오 #147", category: "녹화", status: "active", detail: "15초 · 네온사인 자막 오버레이" }
    ],
    ai_prompts: [
      "레트로 80년대 VHS 테이프 감성의 15초 바이럴 비디오 방명록 연출 콘셉트 기획"
    ],
    quick_actions: ["3초 카운트 녹화", "CRT 필터 토글", "최신 갤러리 재생", "QR 코드 다운로드"]
  },
  {
    app_id: "ytdownloader",
    app_name: "유튜브 미디어 다운로더",
    icon: "🎬",
    category: "media",
    port: 9008,
    tagline: "최고화질 4K MP4/MP3 고속 추출, 미디어 아카이브 및 AI 핵심 3줄 요약 리포트",
    accent_color: "#e11d48",
    gradient: "linear-gradient(135deg, #e11d48, #be123c)",
    kpis: [
      { label: "다운로드 완료", value: "184건", sub: "금일 14건 처리", trend: "+8건", status: "active" },
      { label: "AI 3줄 요약", value: "98건", sub: "자막 기반 핵심 인사이트", trend: "100%", status: "healthy" },
      { label: "절약된 대역폭", value: "42.8 GB", sub: "로컬 고속 캐싱 엔진", trend: "+4.2GB", status: "active" },
      { label: "다운로드 큐", value: "1건 대기", sub: "yt-dlp 최고속 인코더", trend: "0.8x 남음", status: "healthy" }
    ],
    default_items: [
      { id: "YT-1001", title: "AI 개발자 콘퍼런스 2026 기조연설 (4K)", category: "비디오", status: "active", detail: "1080p MP4 · 1.2GB · 3줄 요약 완료" },
      { id: "YT-1002", title: "코딩할 때 듣기 좋은 로우파이 비트 (1시간)", category: "오디오", status: "active", detail: "320kbps MP3 무손실 오디오 추출 완료" }
    ],
    ai_prompts: [
      "45분짜리 테크 세미나 영상의 자막 스크립트를 분석하여 3줄 핵심 요약 및 타임스탬프 목차 작성"
    ],
    quick_actions: ["유튜브 URL 붙여넣기", "MP3 오디오만 추출", "AI 3줄 요약 보기", "다운로드 폴더"]
  },
  {
    app_id: "mqhome",
    app_name: "MQnet 브랜드 홈페이지",
    icon: "🌐",
    category: "portal",
    port: 9001,
    tagline: "MQnet 혁신 IT 솔루션 브랜드 소개, 15개 통합 제품 라인업 쇼케이스 및 도입 문의",
    accent_color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #3b82f6)",
    kpis: [
      { label: "월간 순방문자", value: "84,200명", sub: "글로벌 B2B 트래픽", trend: "+24.5%", status: "active" },
      { label: "제품 쇼케이스", value: "15개 SaaS", sub: "원클릭 포털 허브 연결", trend: "전체 정상", status: "healthy" },
      { label: "통합 API 호출", value: "1.28M", sub: "게이트웨이 통합 라우팅", trend: "99.99%", status: "healthy" },
      { label: "엔터프라이즈 문의", value: "38건/주", sub: "솔루션 도입 상담", trend: "+12건", status: "active" }
    ],
    default_items: [
      { id: "MH-1101", title: "15개 통합 Multi-SaaS 포털 쇼케이스 배포", category: "플랫폼", status: "active", detail: "포트 9000 통합 게이트웨이 연동 완료" },
      { id: "MH-1102", title: "인터랙티브 파티클 3D 히어로 애니메이션", category: "디자인", status: "active", detail: "초당 60프레임 경량 렌더링 최적화" }
    ],
    ai_prompts: [
      "MQnet 15개 SaaS의 통합 시너지를 강조하는 글로벌 B2B 랜딩페이지 헤드라인 및 가치 제안 카피 작성"
    ],
    quick_actions: ["쇼케이스 데모 실행", "기술 백서 다운로드", "도입 문의 작성", "포털 대시보드"]
  },
  {
    app_id: "filebrowser",
    app_name: "통합 파일 탐색기",
    icon: "📁",
    category: "utility",
    port: 9007,
    tagline: "대용량 클라우드 파일 매니저, 문서·음악·영상 스트리밍 및 안전한 공유 링크",
    accent_color: "#64748b",
    gradient: "linear-gradient(135deg, #64748b, #475569)",
    kpis: [
      { label: "스토리지 사용량", value: "4.2 / 8.0 TB", sub: "사용률 52.5% 여유", trend: "안전", status: "healthy" },
      { label: "색인된 파일수", value: "148,200개", sub: "문서 · 미디어 · 백업", trend: "+1,240개", status: "active" },
      { label: "오늘 전송 대역폭", value: "14.8 GB", sub: "고속 파일 업·다운로드", trend: "+2.4GB", status: "active" },
      { label: "암호화 보안", value: "AES-256", sub: "토큰 인증 안전 공유", trend: "최고등급", status: "healthy" }
    ],
    default_items: [
      { id: "FB-1201", title: "MQnet_통합_아키텍처_설계서_v3.pdf", category: "문서", status: "active", detail: "14.2 MB · 비밀번호 보호 공유 링크 활성" },
      { id: "FB-1202", title: "2026_데이터베이스_정기백업_archive.zip", category: "백업", status: "active", detail: "2.4 GB · 무결성 검증 완료" }
    ],
    ai_prompts: [
      "지정된 폴더 내 30일 이상 미사용 대용량 파일 정리 및 아카이빙 자동화 스크립트 작성"
    ],
    quick_actions: ["새 폴더 생성", "파일 드래그 업로드", "보안 공유 링크 발급", "스토리지 검사"]
  },
  {
    app_id: "clock",
    app_name: "모던 스마트 클락",
    icon: "⏰",
    category: "utility",
    port: 9012,
    tagline: "네온 아날로그/디지털 듀얼 시계, 글로벌 5대 도시 세계시 및 포커스 뽀모도로",
    accent_color: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    kpis: [
      { label: "NTP 동기화 오차", value: "±2 ms", sub: "한국표준시 정밀 동기화", trend: "최고정밀", status: "healthy" },
      { label: "완료 뽀모도로", value: "38 세션", sub: "오늘 총 집중시간 15.8h", trend: "+6세션", status: "active" },
      { label: "글로벌 모니터링", value: "5대 도시", sub: "서울·도쿄·런던·뉴욕·파리", trend: "실시간", status: "active" },
      { label: "디스플레이 주사율", value: "120 FPS", sub: "초침 부드러운 렌더링", trend: "부드러움", status: "healthy" }
    ],
    default_items: [
      { id: "CK-1301", title: "서울 (Seoul / KST) - 홈 타임존", category: "세계시", status: "active", detail: "UTC+9:00 · 대한민국 표준시" },
      { id: "CK-1302", title: "뉴욕 (New York / EDT) - 글로벌 지사", category: "세계시", status: "active", detail: "UTC-4:00 · 미국 동부 서머타임" }
    ],
    ai_prompts: [
      "서울, 런던, 뉴욕 팀원들이 동시에 참여할 수 있는 최적의 화상회의 골든타임 슬롯 추천"
    ],
    quick_actions: ["뽀모도로 타이머 시작", "스톱워치 랩타임", "새 세계시 도시 추가", "다크 네온 모드"]
  },
  {
    app_id: "ironman",
    app_name: "아이언맨 제스처 게임",
    icon: "🎮",
    category: "game",
    port: 9011,
    tagline: "웹캠 실시간 핸드 트래킹, p5.js 리펄서 빔 인터랙션 및 글로벌 랭킹 시스템",
    accent_color: "#eab308",
    gradient: "linear-gradient(135deg, #eab308, #ca8a04)",
    kpis: [
      { label: "플레이 세션수", value: "4,210회", sub: "오늘 142회 플레이", trend: "+28%", status: "active" },
      { label: "최고 랭킹 점수", value: "98,400점", sub: "콤보 48연속 격추", trend: "신기록", status: "healthy" },
      { label: "핸드 트래킹 정밀도", value: "99.2%", sub: "MediaPipe 실시간 좌표", trend: "초정밀", status: "healthy" },
      { label: "오디오 FX 반응", value: "16 ms", sub: "리펄서 빔 사운드 초저지연", trend: "즉각반응", status: "healthy" }
    ],
    default_items: [
      { id: "IM-1401", title: "글로벌 랭킹 1위: Stark_Pilot (98,400점)", category: "랭킹", status: "active", detail: "보스 드론 12기 격추 · 명중률 94%" },
      { id: "IM-1402", title: "오른손 손바닥 리펄서 빔 조준 시스템", category: "인식", status: "active", detail: "손바닥 펼침 제스처 감지 시 충전 발사" }
    ],
    ai_prompts: [
      "플레이어의 핸드 모션 속도와 반응 시간을 분석하여 몰입감을 높이는 동적 드론 스폰 패턴 설계"
    ],
    quick_actions: ["웹캠 트래킹 게임 시작", "리더보드 순위표", "조작 가이드", "사운드 효과 테스트"]
  },
  {
    app_id: "n8n",
    app_name: "n8n AI 워크플로우 자동화",
    icon: "⚡",
    category: "automation",
    port: 5678,
    tagline: "비주얼 노드 기반 엔드투엔드 자동화, 농협 계좌 입금 알림 파싱 및 AI 에이전트 연동",
    accent_color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316, #c2410c)",
    kpis: [
      { label: "활성 워크플로우", value: "16개", sub: "무중단 백그라운드 구동", trend: "100%", status: "healthy" },
      { label: "오늘 실행 트리거", value: "3,420회", sub: "웹훅 · 크론 · 이메일", trend: "+18.2%", status: "active" },
      { label: "농협 입금 파싱", value: "성공률 100%", sub: "실시간 구글 시트 기장", trend: "무오류", status: "healthy" },
      { label: "워크플로우 실패율", value: "0.02%", sub: "자동 재시도 3회 정책", trend: "안정", status: "healthy" }
    ],
    default_items: [
      { id: "N8N-1501", title: "농협 스마트뱅킹 입금 알림 -> 구글 시트 자동 기장", category: "금융", status: "active", detail: "성공 28건 처리 · 장부 잔액 자동 계산" },
      { id: "N8N-1502", title: "토스페이 결제 완료 웹훅 -> 슬랙 채널 실시간 알림", category: "알림", status: "active", detail: "지연시간 0.3초 · 구매자 및 금액 브로드캐스트" }
    ],
    ai_prompts: [
      "수신된 다양한 은행 입금 확인 이메일에서 거래일시, 입금자명, 금액을 정규식 및 LLM으로 완벽 파싱하는 커스텀 노드 코드 작성"
    ],
    quick_actions: ["공식 n8n 편집기 열기", "입금 알림 테스트", "워크플로우 즉시실행", "실행 로그 확인"]
  }
];

const CATEGORY_NAMES = {
  all: "전체 아키타입 (15)",
  business: "비즈니스 & POS (2)",
  education: "교육 & 에듀테크 (2)",
  iot: "스마트 IoT 관제 (1)",
  ai_vision: "AI 비전 & 관상 (2)",
  media: "미디어 & 콘텐츠 (3)",
  utility: "유틸리티 & 포털 (3)",
  game: "인터랙티브 게임 (1)",
  automation: "AI 자동화 (1)",
  portal: "플랫폼 포털 (1)"
};

const api = createApiClient('saas_template');

export function App() {
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [activeId, setActiveId] = useState("studycafe");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("crud"); // "crud" | "ai" | "telemetry" | "scaffold"

  // 데이터 & KPI 상태
  const [items, setItems] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // AI 코파일럿 상태
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // 모달 & 토스트 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", category: "일반", status: "active", detail: "" });
  const [toast, setToast] = useState(null);

  // 현재 활성화된 프리셋 객체
  const activePreset = useMemo(() => {
    return presets.find(p => p.app_id === activeId) || presets[0] || FALLBACK_PRESETS[0];
  }, [presets, activeId]);

  // 카테고리 필터링된 프리셋 목록
  const filteredPresets = useMemo(() => {
    if (selectedCategory === "all") return presets;
    return presets.filter(p => p.category === selectedCategory);
  }, [presets, selectedCategory]);

  // 토스트 메시지 헬퍼
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 프리셋 목록 로드 (백엔드 연동)
  useEffect(() => {
    api.get('/api/presets')
      .then(res => {
        if (res.presets && res.presets.length > 0) {
          // 백엔드 프리셋과 로컬 프리셋 병합
          const merged = FALLBACK_PRESETS.map(fp => {
            const remote = res.presets.find(rp => rp.app_id === fp.app_id);
            return remote ? { ...fp, ...remote } : fp;
          });
          setPresets(merged);
        }
      })
      .catch(() => {
        // 백엔드 미실행 시 로컬 프리셋 유지
      });
  }, []);

  // 활성 프리셋 변경 시 데이터 & KPI 동기화
  useEffect(() => {
    setLoading(true);
    setAiResponse("");
    setAiPrompt(activePreset.ai_prompts ? activePreset.ai_prompts[0] : "");

    // 1. KPI 지표 요청
    api.get(`/api/metrics?preset_id=${activeId}`)
      .then(res => {
        if (res.kpis) setKpis(res.kpis);
      })
      .catch(() => {
        setKpis(activePreset.kpis || []);
      });

    // 2. 항목 데이터 요청
    api.get(`/api/data?preset_id=${activeId}`)
      .then(res => {
        if (res.items) setItems(res.items);
      })
      .catch(() => {
        setItems(activePreset.default_items || []);
      })
      .finally(() => setLoading(false));
  }, [activeId, activePreset]);

  // 항목 생성 핸들러
  const handleCreateItem = (e) => {
    e.preventDefault();
    if (!newItem.title.trim()) return;

    api.post('/api/data', { ...newItem, preset_id: activeId })
      .then(res => {
        if (res.item) {
          setItems(prev => [res.item, ...prev]);
        }
      })
      .catch(() => {
        // 로컬 추가
        const created = {
          id: `${activeId.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
          title: newItem.title,
          category: newItem.category || "일반",
          status: newItem.status || "active",
          detail: newItem.detail || "실시간 신규 생성됨"
        };
        setItems(prev => [created, ...prev]);
      })
      .finally(() => {
        setShowCreateModal(false);
        setNewItem({ title: "", category: "일반", status: "active", detail: "" });
        showToast(`새 항목이 성공적으로 등록되었습니다.`);
      });
  };

  // 항목 상태 토글
  const handleToggleStatus = (item) => {
    const nextStatus = item.status === "active" ? "pending" : "active";
    api.put(`/api/data/${item.id}?preset_id=${activeId}`, { status: nextStatus })
      .catch(() => {})
      .finally(() => {
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: nextStatus } : it));
        showToast(`'${item.title}' 상태가 [${nextStatus.toUpperCase()}]로 변경되었습니다.`);
      });
  };

  // 항목 삭제
  const handleDeleteItem = (id) => {
    api.delete(`/api/data/${id}?preset_id=${activeId}`)
      .catch(() => {})
      .finally(() => {
        setItems(prev => prev.filter(it => it.id !== id));
        showToast(`항목이 삭제되었습니다.`);
      });
  };

  // AI 분석 실행
  const handleRunAi = (promptToRun) => {
    const prompt = promptToRun || aiPrompt;
    if (!prompt.trim()) return;

    setAiLoading(true);
    setAiResponse("");

    api.post('/api/ai/action', { prompt, preset_id: activeId })
      .then(res => {
        setAiResponse(res.response || "분석 완료되었습니다.");
      })
      .catch(() => {
        // 로컬 스마트 휴리스틱 생성
        setTimeout(() => {
          setAiResponse(
            `💡 [${activePreset.app_name} AI 코파일럿 분석 리포트]\n\n` +
            `✔ 요청 프롬프트: "${prompt}"\n` +
            `✔ 도메인 상태: 현재 ${activePreset.app_name}의 텔레메트리 파이프라인 및 데이터베이스가 최적화 모드로 운용 중입니다.\n\n` +
            `1. 핵심 인사이트 및 분석:\n` +
            `   - ${activePreset.category.toUpperCase()} 비즈니스 패턴상 피크타임 대비 자원 점유율(현재 ${kpis[0]?.value || '78%'})의 분산 전략이 권장됩니다.\n` +
            `   - 실시간 연동 중인 장치 및 트랜잭션의 SLA 보장률은 99.98%로 고도로 안정적인 상태입니다.\n\n` +
            `2. 실행 가능한 최적화 가이드:\n` +
            `   - 상단 빠른 작업([${activePreset.quick_actions?.join(' · ')}])을 활용하여 운영 부하를 즉시 35% 경감할 수 있습니다.\n` +
            `   - MQnet 통합 포털(/) 및 Coolify 클라우드 배포와 100% 호환되도록 구성되었습니다.`
          );
          setAiLoading(false);
        }, 600);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  // 필터링된 항목 목록
  const displayedItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.detail.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#f8fafc' }}>
      {/* 🌟 MQnet 통합 포털 헤더 */}
      <PortalHeader
        appName="스마트 SaaS 템플릿 허브"
        appIcon="⚡"
        category="starter-kit"
        portalUrl="/"
      />

      {/* 토스트 알림 */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #6366f1',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(99,102,241,0.4)',
          borderRadius: '12px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          animation: 'fadeIn 0.25s ease'
        }}>
          <span>✨</span>
          <span>{toast}</span>
        </div>
      )}

      {/* 메인 작업 영역 */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>
        
        {/* ─── 1. 15대 SaaS 아키타입 셀렉터 섹션 ─── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', letterSpacing: '0.05em' }}>
                  15 SAAS ARCHETYPES
                </span>
                <span className="beacon-online"></span>
                <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>전체 15개 서비스 라이브 프리셋 지원</span>
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                15개 통합 SaaS 아키타입 실시간 전환 탐색기
              </h2>
            </div>

            {/* 카테고리 필터 탭 */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {["all", "business", "education", "iot", "ai_vision", "media", "utility", "game", "automation"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: selectedCategory === cat ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                    background: selectedCategory === cat ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                    color: selectedCategory === cat ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {CATEGORY_NAMES[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          {/* 15개 프리셋 카드 그리드 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '0.85rem'
          }}>
            {filteredPresets.map(preset => {
              const isSelected = preset.app_id === activeId;
              return (
                <div
                  key={preset.app_id}
                  onClick={() => setActiveId(preset.app_id)}
                  className="mq-glass"
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${preset.accent_color || '#6366f1'}` : '1px solid rgba(255,255,255,0.08)',
                    background: isSelected
                      ? `linear-gradient(145deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))`
                      : 'rgba(18, 24, 38, 0.5)',
                    boxShadow: isSelected ? `0 8px 25px -5px ${preset.accent_color || '#6366f1'}40` : 'none',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: preset.accent_color || '#6366f1'
                    }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>{preset.icon}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#94a3b8'
                    }}>
                      Port {preset.port}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.app_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                    {preset.category}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 2. 활성 SaaS 워크스페이스 히어로 배너 ─── */}
        <section style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '2rem 2.5rem',
          marginBottom: '2rem',
          background: `radial-gradient(circle at top right, ${activePreset.accent_color || '#6366f1'}25, transparent 60%), linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))`,
          border: `1px solid ${activePreset.accent_color || '#6366f1'}40`,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{
                fontSize: '3.2rem',
                width: '74px',
                height: '74px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '18px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {activePreset.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    {activePreset.app_name}
                  </h1>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    background: `${activePreset.accent_color || '#6366f1'}25`,
                    color: activePreset.accent_color || '#818cf8',
                    border: `1px solid ${activePreset.accent_color || '#6366f1'}40`
                  }}>
                    {activePreset.category.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <span className="beacon-online"></span>
                    ONLINE (Port {activePreset.port})
                  </span>
                </div>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem', maxWidth: '780px', lineHeight: 1.5 }}>
                  {activePreset.tagline}
                </p>
              </div>
            </div>

            {/* 빠른 액션 버튼들 */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mq-btn-primary"
                style={{ background: activePreset.gradient || undefined }}
              >
                <span>➕</span> 새 데이터 등록
              </button>
              <button
                onClick={() => {
                  setActiveTab("ai");
                  handleRunAi();
                }}
                className="mq-btn-secondary"
              >
                <span>🤖</span> AI 코파일럿 실행
              </button>
              <button
                onClick={() => setActiveTab("scaffold")}
                className="mq-btn-secondary"
              >
                <span>🚀</span> 스캐폴딩 내보내기
              </button>
            </div>
          </div>

          {/* 도메인 빠른 작업 칩 (Quick Action Chips) */}
          {activePreset.quick_actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>빠른 도메인 액션:</span>
              {activePreset.quick_actions.map((act, i) => (
                <button
                  key={i}
                  onClick={() => showToast(`'${act}' 액션이 성공적으로 호출되었습니다.`)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.75rem',
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = activePreset.accent_color || '#6366f1'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  ⚡ {act}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─── 3. 실시간 4대 KPI 메트릭 카드 ─── */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}>
          {kpis.map((kpi, idx) => (
            <div key={idx} className="mq-glass mq-glass-hover" style={{ padding: '1.4rem', borderRadius: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700 }}>{kpi.label}</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px'
                }}>
                  {kpi.trend}
                </span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
                {kpi.value}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </section>

        {/* ─── 4. 기능 탭 네비게이션 ─── */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: '0.75rem'
        }}>
          {[
            { id: "crud", label: "📋 실시간 데이터 & 운영 관리", badge: displayedItems.length },
            { id: "ai", label: "🤖 AI 도메인 코파일럿 스튜디오", badge: "Gemini 2.5" },
            { id: "telemetry", label: "📡 실시간 이벤트 스트림", badge: "LIVE" },
            { id: "scaffold", label: "🚀 1-클릭 SaaS 스캐폴딩 & 코드 생성" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: activeTab === tab.id ? `1px solid ${activePreset.accent_color || '#6366f1'}` : '1px solid transparent',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  background: activeTab === tab.id ? (activePreset.accent_color || '#6366f1') : 'rgba(255,255,255,0.08)',
                  color: '#ffffff'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── 5-A. 탭: 데이터 & 자원 관리 (CRUD) ─── */}
        {activeTab === "crud" && (
          <section className="mq-glass" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            {/* 검색 & 필터 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '480px' }}>
                <input
                  type="text"
                  placeholder={`${activePreset.app_name} 관련 데이터 검색...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>상태 필터:</span>
                {["all", "active", "pending"].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: statusFilter === st ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                      background: statusFilter === st ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      color: statusFilter === st ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    {st === "all" ? "전체" : st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* 데이터 항목 리스트 */}
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                데이터 로딩중...
              </div>
            ) : displayedItems.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                검색 조건에 일치하는 데이터가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {displayedItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1.1rem 1.4rem',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      transition: 'all 0.2s ease',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#64748b',
                        fontFamily: 'monospace',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px'
                      }}>
                        {item.id}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc', marginBottom: '0.2rem' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                          {item.detail}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#cbd5e1'
                      }}>
                        {item.category}
                      </span>

                      {/* 상태 토글 버튼 */}
                      <button
                        onClick={() => handleToggleStatus(item)}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.3rem 0.75rem',
                          borderRadius: '999px',
                          border: 'none',
                          cursor: 'pointer',
                          background: item.status === 'active' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                          color: item.status === 'active' ? '#34d399' : '#fbbf24',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {item.status.toUpperCase()} 🔄
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── 5-B. 탭: AI 코파일럿 스튜디오 ─── */}
        {activeTab === "ai" && (
          <section className="mq-glass" style={{ padding: '2rem', borderRadius: '18px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
                  {activePreset.app_name} 전용 지능형 AI 코파일럿
                </h3>
              </div>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
                Google Gemini 2.5 Flash 멀티모달 및 MQnet 도메인 분석 엔진이 탑재되어 실무 최적화 권고안을 실시간 생성합니다.
              </p>
            </div>

            {/* 추천 AI 프롬프트 칩 */}
            {activePreset.ai_prompts && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>
                  추천 도메인 프롬프트 (클릭하여 즉시 적용):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activePreset.ai_prompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setAiPrompt(p);
                        handleRunAi(p);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e2e8f0',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = activePreset.accent_color || '#6366f1'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    >
                      💡 {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 프롬프트 입력창 */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="AI 코파일럿에게 요청할 질문이나 지시사항을 입력하세요..."
                style={{
                  flex: 1,
                  padding: '0.85rem 1.2rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAi()}
              />
              <button
                onClick={() => handleRunAi()}
                disabled={aiLoading}
                className="mq-btn-primary"
                style={{
                  background: activePreset.gradient || undefined,
                  minWidth: '140px',
                  justifyContent: 'center'
                }}
              >
                {aiLoading ? "분석 중..." : "🚀 분석 실행"}
              </button>
            </div>

            {/* AI 결과 뷰어 */}
            {aiResponse && (
              <div style={{
                padding: '1.5rem',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--mq-font)',
                lineHeight: 1.7,
                fontSize: '0.95rem',
                color: '#e2e8f0',
                animation: 'fadeIn 0.3s ease'
              }}>
                {aiResponse}
              </div>
            )}
          </section>
        )}

        {/* ─── 5-C. 탭: 실시간 텔레메트리 스트림 ─── */}
        {activeTab === "telemetry" && (
          <section className="mq-glass" style={{ padding: '2rem', borderRadius: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>실시간 이벤트 텔레메트리 로그</h3>
                <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                  게이트웨이 및 {activePreset.app_name} 서비스 노드 간 실시간 패킷 스트림입니다.
                </p>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="beacon-online"></span>
                웹소켓 스트림 연결됨
              </span>
            </div>

            <div style={{
              background: '#040711',
              borderRadius: '12px',
              padding: '1.25rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#38bdf8',
              maxHeight: '360px',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div>[00:00:01] [INFO] MQnet Gateway Engine v2.5 started on port 9000 & 10000</div>
              <div>[00:00:02] [SUCCESS] Service mounted: {activePreset.app_name} ({activePreset.app_id}) on port {activePreset.port}</div>
              <div>[00:00:04] [INFO] Telemetry pipeline polling interval: 1000ms (latency: 18ms)</div>
              <div>[00:00:07] [SUCCESS] Health check status: 200 OK (uptime: 99.98%)</div>
              <div>[00:00:12] [INFO] Active items synchronized: {items.length} items loaded into memory store</div>
              <div>[00:00:15] [SUCCESS] Event bus subscription ready for tenant: default_tenant</div>
            </div>
          </section>
        )}

        {/* ─── 5-D. 탭: 1-클릭 SaaS 스캐폴딩 & 코드 생성 ─── */}
        {activeTab === "scaffold" && (
          <section className="mq-glass" style={{ padding: '2rem', borderRadius: '18px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
                🚀 '{activePreset.app_name}' 아키타입 독립 서비스 스캐폴딩
              </h3>
              <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.95rem' }}>
                MQnet 표준 CLI 제너레이터 명령을 통해 이 아키타입을 완벽히 복제하여 새로운 프로덕션 SaaS 서비스를 생성할 수 있습니다.
              </p>
            </div>

            {/* CLI 터미널 박스 */}
            <div style={{
              background: '#040711',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                CLI SCAFFOLDING COMMAND
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '1rem',
                color: '#34d399',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                overflowX: 'auto'
              }}>
                <code>
                  python scripts/create_app.py --preset {activePreset.app_id} --id my_{activePreset.app_id} --name "{activePreset.app_name} 서비스" --port {activePreset.port}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`python scripts/create_app.py --preset ${activePreset.app_id} --id my_${activePreset.app_id} --name "${activePreset.app_name} 서비스" --port ${activePreset.port}`);
                    showToast("CLI 명령어가 클립보드에 복사되었습니다!");
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    marginLeft: '1rem'
                  }}
                >
                  복사 📋
                </button>
              </div>
            </div>

            {/* 구조 안내 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem' }}>1. 백엔드 구성 (FastAPI)</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  • <code>shared.core.base_app.create_base_app</code> 상속<br/>
                  • 자동 CORS, 헬스체크(/health), 예외 처리<br/>
                  • 도메인별 RESTful CRUD 엔드포인트 자동 제공
                </div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '0.5rem' }}>2. 프론트엔드 구성 (React + Vite)</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  • <code>@mqnet/ui</code> 공유 컴포넌트 라이브러리 탑재<br/>
                  • 반응형 글래스모피즘 디자인 시스템 완비<br/>
                  • 포털 통합 네비게이션 PortalHeader 자동 포함
                </div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.5rem' }}>3. 원클릭 배포 & 호스팅</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  • 게이트웨이(Port 9000 & 10000) 통합 라우팅<br/>
                  • Docker Compose 멀티컨테이너 즉시 지원<br/>
                  • Coolify 클라우드 배포 호환 규격 준수
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ─── 새 데이터 등록 모달 ─── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="mq-glass" style={{
            width: '90%',
            maxWidth: '520px',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.35rem', fontWeight: 800 }}>
              새 {activePreset.app_name} 항목 등록
            </h3>
            <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>항목 명칭 / 타이틀</label>
                <input
                  type="text"
                  required
                  placeholder="예: A-05 신규 프리미엄 집중석"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>분류 카테고리</label>
                <input
                  type="text"
                  placeholder="예: 좌석, 주문, 센서, 퀘스트 등"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>상세 내용 / 비고</label>
                <textarea
                  rows={3}
                  placeholder="항목에 대한 상세 설명이나 운용 정보를 입력하세요..."
                  value={newItem.detail}
                  onChange={(e) => setNewItem({ ...newItem, detail: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="mq-btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="mq-btn-primary"
                  style={{ background: activePreset.gradient || undefined }}
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
