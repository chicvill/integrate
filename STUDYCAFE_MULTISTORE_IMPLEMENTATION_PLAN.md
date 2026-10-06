# 🏢 스터디카페 × 셀프스터디 다중 매장(Multi-Branch) 확장 세부 구현 계획서

> **문서 버전:** v1.0.0 (2026-10-06)  
> **시스템 명칭:** MQnet StudyCafe Multi-Tenant Architecture  
> **적용 범위:** 무인 스터디카페 프랜차이즈, 직영/가맹 다지점 운영, 셀프스터디(SelfStudy OS) 연동형 관리형 독서실  
> **핵심 원칙:** **Zero-Config Onboarding (URL/QR 기반 자동 분기)**, **Physical/Hardware Isolation (지점별 물리/장비 격리)**, **Unified Student Learning Core (단일 학습 진도 자산 유지)**

---

## 📑 목차
1. [시스템 아키텍처 및 객체 도메인 모델](#1-시스템-아키텍처-및-객체-도메인-모델)
2. [데이터베이스 스키마 확장 설계 (SQLAlchemy)](#2-데이터베이스-스키마-확장-설계-sqlalchemy)
3. [지점 식별 및 테넌트 컨텍스트 미들웨어 (Backend)](#3-지점-식별-및-테넌트-컨텍스트-미들웨어-backend)
4. [프론트엔드 Zero-Config 지점 라우팅 (Kiosk & Mobile)](#4-프론트엔드-zero-config-지점-라우팅-kiosk--mobile)
5. [지점별 스마트 도어락(IoT) 하드웨어 제어 구조](#5-지점별-스마트-도어락iot-하드웨어-제어-구조)
6. [점주/관리자 권한 분리 및 멀티 지점 관제 UI (RBAC)](#6-점주관리자-권한-분리-및-멀티-지점-관제-ui-rbac)
7. [단계별 구축 로드맵 및 테스트 시나리오](#7-단계별-구축-로드맵-및-테스트-시나리오)

---

## 1. 시스템 아키텍처 및 객체 도메인 모델

### 1.1 핵심 객체 관계 (도메인 분리 원칙)

```
[MQnet SaaS 플랫폼]
       │
       ├── [StudyCafeBranch (지점 객체)] : 1:N 물리 공간 & 현장 하드웨어
       │         │── [Seat (좌석)] : 지점별 20~50석 독립 배치
       │         │── [DoorHardware (도어락)] : 지점별 릴레이 IP / Port
       │         │── [TicketSale (매출/정산)] : 지점 사업자번호 단위 결제/정산
       │         └── [PatrolLog (순찰일지)] : 지점 관리자/실장의 현장 지도 기록
       │
       └── [SelfStudy OS (학습 엔진)] : 전사 단일 중앙 서비스
                 │── [User (학생)] : 010 전화번호 기반 단일 SSO 계정
                 │── [Curriculum (교재/진도)] : 국·영·수 과목별 진도표
                 └── [PPH / AI Rebalancing] : 실측 학습속도 및 스케줄링
```

* **지점(StudyCafeBranch)**: 매장 위치, 좌석 배치, 스마트 도어락 릴레이 IP, 지점 매출 등 **"물리적 공간과 로컬 하드웨어"**를 담당합니다.
* **학생(Student) & 자주학습(SelfStudy)**: 학생 개인의 교재 진도, PPH 학습 속도, AI 오더는 특정 지점에 종속되지 않고 **"학생 계정 중심의 영구 자산"**으로 유지됩니다.
* **연결 방식**: 학생이 `강남점`의 "4주 관리형 프리미엄 패스"를 결제하면, 해당 이용권의 `tenant_id`가 `sc-gangnam`으로 지정되어 **강남점 관리자 화면에 해당 학생의 학습 진도가 실시간 동기화**됩니다.

---

## 2. 데이터베이스 스키마 확장 설계 (SQLAlchemy)

### 2.1 지점 마스터 테이블 (`studycafe_branches`) 신설

```python
# apps/studycafe/backend/models.py
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.sql import func
from shared.database import Base

class StudyCafeBranch(Base):
    """스터디카페 지점(매장) 마스터 테이블"""
    __tablename__ = "studycafe_branches"

    branch_id = Column(String(50), primary_key=True, index=True) # 예: 'sc-gangnam', 'sc-daechi'
    name = Column(String(100), nullable=False)                    # 매장명: 'MQnet 스터디카페 강남본점'
    business_number = Column(String(20), nullable=True)           # 사업자 등록번호
    contact_phone = Column(String(20), nullable=True)             # 매장 대표 번호
    address = Column(String(200), nullable=True)                  # 지점 주소
    
    # 좌석 및 운영 설정
    total_seats = Column(Integer, default=20)                     # 보유 좌석 수
    night_curfew_enabled = Column(Boolean, default=True)          # 22시 청소년 퇴실 단속 여부
    
    # IoT 스마트 출입문 릴레이 하드웨어 설정
    relay_type = Column(String(20), default="HTTP")               # 'HTTP' (Web Relay), 'MQTT', 'TCP'
    relay_host = Column(String(100), default="127.0.0.1")         # 현장 릴레이 컨트롤러 IP / DDNS
    relay_port = Column(Integer, default=8080)                    # 릴레이 포트
    relay_secret = Column(String(100), nullable=True)             # 하드웨어 통신 인증 토큰
    
    # SelfStudy 관리형 기능 활성화 여부 (가맹 옵션)
    has_selfstudy_lms = Column(Boolean, default=True)
    
    # 지점 점주(소유자) 계정 ID
    owner_user_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    is_active = Column(Boolean, default=True)
```

### 2.2 기존 테이블의 `tenant_id` 외래키 및 인덱스 정비

이미 `Seat`, `Ticket`, `StudyCafeSession`, `StudyCafeLog`에 `tenant_id` 컬럼이 존재하므로, 아래와 같이 복합 인덱스를 최적화합니다:
1. `seats`: `(tenant_id, seat_number)` 복합 유니크 제약 (`UniqueConstraint('tenant_id', 'seat_number')`)
2. `tickets`: `(tenant_id, user_phone)` 인덱스
3. `studycafe_sessions`: `(tenant_id, is_active)` 인덱스

---

## 3. 지점 식별 및 테넌트 컨텍스트 미들웨어 (Backend)

API 요청 시 지점을 자동으로 판별하고 분기하는 3단계 폴백(Fallback) 구조를 적용합니다:

```
[API Request]
      │
      ├── 1순위: Header [X-Tenant-ID: sc-gangnam]
      ├── 2순위: Query String [?branch=sc-gangnam 또는 ?tenant_id=sc-gangnam]
      └── 3순위: JWT 토큰의 user.tenant_id (점주 로그인 시)
      │
      └── 기본값 폴백: 'studycafe-main' (하위 호환성 100% 보장)
```

### 3.1 FastAPI 테넌트 추출 의존성 (`dependencies.py`)

```python
# apps/studycafe/backend/dependencies.py
from fastapi import Request, Header, Query
from typing import Optional

def get_current_tenant_id(
    request: Request,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    branch: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None)
) -> str:
    """모든 엔드포인트에서 공통으로 지점 코드를 해결하는 의존성"""
    resolved = x_tenant_id or branch or tenant_id
    if not resolved:
        # 로그인 세션이 있는 경우 사용자의 소속 매장 확인
        user = getattr(request.state, "user", None)
        if user and getattr(user, "tenant_id", None):
            resolved = user.tenant_id
    return resolved or "studycafe-main"
```

---

## 4. 프론트엔드 Zero-Config 지점 라우팅 (Kiosk & Mobile)

현장 키오스크 태블릿이나 출입문 QR 코드는 별도의 설정 화면 없이 **URL 파라미터 하나로 지점이 완벽하게 바인딩**됩니다.

### 4.1 URL 구조 규격

| 용도 | 접속 URL | 비고 |
| :--- | :--- | :--- |
| **강남점 키오스크** | `https://studycafe.mqnet.io/?branch=sc-gangnam` | 현장 태블릿 전체화면 PWA |
| **대치점 키오스크** | `https://studycafe.mqnet.io/?branch=sc-daechi` | 대치점 35석 좌석배치도 로드 |
| **강남점 출입문 QR** | `https://studycafe.mqnet.io/?branch=sc-gangnam&action=door` | 모바일 웹 1초 자동 출입문 열기 |
| **점주 대시보드** | `https://studycafe.mqnet.io/admin.html?branch=sc-gangnam` | 해당 지점 전용 관제 |

### 4.2 프론트엔드 API 클라이언트 테넌트 자동 주입 ([api.js](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/frontend/js/api.js))

```javascript
// apps/studycafe/frontend/js/api.js
const urlParams = new URLSearchParams(window.location.search);
export const CURRENT_BRANCH = urlParams.get('branch') || localStorage.getItem('studycafe_branch') || 'studycafe-main';

// 로컬 저장소에 현재 지점 저장
localStorage.setItem('studycafe_branch', CURRENT_BRANCH);

// 모든 API 호출 함수에서 공통 파라미터 자동 합성
export async function apiRequest(endpoint, options = {}) {
  const url = new URL(endpoint, window.location.origin);
  if (!url.searchParams.has('tenant_id')) {
    url.searchParams.set('tenant_id', CURRENT_BRANCH);
  }
  options.headers = {
    ...options.headers,
    'X-Tenant-ID': CURRENT_BRANCH
  };
  return fetch(url.toString(), options);
}
```

---

## 5. 지점별 스마트 도어락(IoT) 하드웨어 제어 구조

매장별로 인터넷 회선(공유기)과 도어락 릴레이 컨트롤러가 물리적으로 다른 위치에 존재합니다.

```
[클라우드 게이트웨이 서버]
            │
            ├── 지점 sc-gangnam 도어락 열기 요청 (HTTP POST /door/open)
            │      ▼
            │   [강남점 로컬 공유기 포트포워딩 / DDNS]
            │      ▼
            │   [강남점 Web Relay Controller] ──(NC 접점)──▶ [강남점 EM-Lock (5초 개방)]
            │
            └── 지점 sc-daechi 도어락 열기 요청 (HTTP POST /door/open)
                   ▼
                [대치점 Web Relay Controller] ──(NC 접점)──▶ [대치점 EM-Lock (5초 개방)]
```

### 5.1 [door_router.py](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/backend/routers/door_router.py) 하드웨어 라우팅 구현

```python
# apps/studycafe/backend/routers/door_router.py
@router.post("/open")
async def trigger_door_open(
    body: DoorOpenRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    branch = db.query(StudyCafeBranch).filter(StudyCafeBranch.branch_id == tenant_id).first()
    target_host = branch.relay_host if branch else "127.0.0.1"
    target_port = branch.relay_port if branch else 8080

    # 현장 릴레이 컨트롤러에 펄스(5초 개방) 신호 전송
    try:
        # 하드웨어 통신 (타임아웃 1.5초 Fail-Safe)
        res = requests.get(f"http://{target_host}:{target_port}/relay/0?state=pulse&duration=5", timeout=1.5)
    except Exception as e:
        logger.warning(f"[{tenant_id}] 하드웨어 릴레이 오프라인 (모의 개방 처리): {e}")

    # 출입 감사 로그 기록
    _log_door_event(db, tenant_id=tenant_id, action="OPEN", user_name=body.user_name)
    return {"success": True, "message": f"{tenant_id} 출입문이 5초간 개방되었습니다."}
```

---

## 6. 점주/관리자 권한 분리 및 멀티 지점 관제 UI (RBAC)

### 6.1 계정 권한 체계
* **최고 관리자 (`superadmin`)**:
  * 모든 매장의 실시간 현황 모니터링
  * 신규 가맹점(지점) 생성, 릴레이 IP 설정, 좌석 수 설정
  * 전 지점 월별/기간별 통합 매출 조회 및 엑셀 다운로드
* **지점 점주 (`owner`) / 점장 (`manager`)**:
  * 본인 소속 지점(`tenant_id`)의 좌석 현황, 순찰 일지, 90일 데이터 파기만 접근 가능
  * 본인 지점의 매출 통계 및 소득세 신고용 공급가액/부가세 조회

### 6.2 대시보드 지점 전환 드롭다운 ([admin.html](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/frontend/admin.html))
최고 관리자로 로그인 시 네비게이션 바에 **`지점 선택 셀렉트박스`**가 노출되어 원클릭으로 매장을 전환합니다:
```html
<!-- 점주 화면 상단: 최고 관리자 전용 지점 셀렉터 -->
<div id="branchSelectorContainer" style="display:none; align-items:center; gap:0.5rem;">
  <span style="font-size:0.85rem;color:#94a3b8;">🏢 매장 관제:</span>
  <select id="branchSelect" class="sc-form-input" style="padding:0.35rem 0.75rem;width:auto;">
    <option value="sc-gangnam">강남역 본점 (20석)</option>
    <option value="sc-daechi">대치 학원가점 (35석)</option>
    <option value="sc-sinchon">신촌 연세점 (28석)</option>
  </select>
</div>
```

---

## 7. 단계별 구축 로드맵 및 테스트 시나리오

| 단계 | 추진 과제 | 상세 작업 내용 | 예상 소요 |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **지점 마스터 모델 및 DB 마이그레이션** | • `StudyCafeBranch` 테이블 생성<br/>• 기본 지점(`studycafe-main`, `sc-gangnam`, `sc-daechi`) 시드 데이터 주입<br/>• 좌석수 동적 생성 함수 구현 (`_ensure_branch_seats`) | 1일 |
| **Phase 2** | **Backend 테넌트 의존성 통합** | • `get_current_tenant_id` 미들웨어/의존성 전면 적용<br/>• 도어락 제어 라우터에 지점별 `relay_host`/`port` 연결<br/>• 매출 통계 및 엑셀 내보내기 지점 필터링 연동 | 1.5일 |
| **Phase 3** | **Frontend Zero-Config 라우팅** | • `api.js` 공통 테넌트 헤더 주입<br/>• `index.html` URL `?branch=` 파라미터 감지 및 매장 타이틀 자동 반영<br/>• 매장별 데스크 QR 다운로드 기능 (좌석별 고유 URL) | 1일 |
| **Phase 4** | **관리자 RBAC 및 멀티 관제 검증** | • 최고 관리자용 매장 셀렉터 UI 연동<br/>• 점주 계정 지점 권한 격리 테스트<br/>• 복수 매장 동시 입퇴실 모의 테스트 및 매뉴얼 갱신 | 1.5일 |

---

## 8. 즉시 착수 가능한 파일 수정 체크리스트

- [ ] [apps/studycafe/backend/models.py](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/backend/models.py): `StudyCafeBranch` ORM 모델 추가
- [ ] [apps/studycafe/backend/routers/seat_router.py](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/backend/routers/seat_router.py): `_ensure_original_20_seats`를 지점별 동적 좌석 초기화(`_ensure_branch_seats`)로 고도화
- [ ] [apps/studycafe/backend/routers/door_router.py](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/backend/routers/door_router.py): 지점별 릴레이 IP 조회 및 비상 전면 개방 지점별 격리
- [ ] [apps/studycafe/frontend/js/api.js](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/frontend/js/api.js): URL 쿼리스트링 `branch` 자동 파싱 및 테넌트 헤더 추가
- [ ] [apps/studycafe/frontend/admin.html](file:///c:/Users/USER/Desktop/Workstation/integrated/apps/studycafe/frontend/admin.html): 지점 전환 셀렉터 및 지점별 매출 탭 연동
