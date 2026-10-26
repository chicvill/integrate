---
name: mqnet-system-navigator
description: >-
  Use this skill to navigate, understand, operate, and verify the entire MQnet Integrated Workspace.
  Covers platform architecture, multi-tenant dynamic routing, domain business logic (rent2 FIFO collection,
  ghost overdue prevention, VAT calculation), resilient UX guidelines (alert banner standard),
  and automated 5-stage system verification.
---

# 🧭 MQnet System Navigator & Architecture Runbook

MQnet 통합 플랫폼의 방대한 시스템 구조, 비즈니스 도메인 규칙, 인증/권한 체계, 프론트엔드/백엔드 표준을 한눈에 파악하고 자동 검증할 수 있는 공식 마스터 스킬입니다.

---

## 🚀 빠른 시작: 5단계 시스템 자동 검증 (Automated System Verification)

코드 수정, 새 기능 추가 또는 전체 시스템 상태를 점검할 때는 아래 검증 스크립트를 즉시 실행합니다:

```bash
# Windows PowerShell 환경
py .agents/skills/mqnet-system-navigator/scripts/verify_system.py
```

### 검증 파이프라인 (5-Stage Pipeline)
1. **Python AST 구문 분석**: 전체 백엔드 코드의 문법적 오류를 AST 파서로 정밀 전수 검사 (0 Syntax Errors).
2. **프론트엔드 JS 구문 검사**: 브라우저 스크립트(`ai.js`, `rooms.js`, `smart.js` 등)의 Node.js 구문 컴파일 검증 (`node -c`).
3. **핵심 백엔드 모듈 임포트 무결성**: 라우터, 도메인, 커널 모듈의 상호 참조 및 의존성 무결성 검증.
4. **도메인 단위 테스트 스위트 (`unittest`)**: 선후불 계산, 회계 수납, 권한 로직 등 19개 핵심 테스트 100% 통과 확인.
5. **FastAPI TestClient 시뮬레이션**: 메모리 DB 환경에서 실제 API 호출, 스마트 입금 파싱, FIFO 수납, 중복 입금 차단(Idempotency) 실시간 검증.

---

## 🏛️ 전체 시스템 아키텍처 한눈에 보기

```text
                                  ┌──────────────────────────────┐
                                  │      Client (Browser/PWA)    │
                                  └──────────────┬───────────────┘
                                                 │ HTTP / WebSocket
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     MQnet Gateway (Port 8000/9000)                               │
│                      [Reverse Proxy] + [JWT Identity Verification] + [NoCacheStaticFiles]         │
└────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                         │ Dynamic Dispatch
             ┌───────────────────────────┼───────────────────────────┐
             ▼                           ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│ apps/rent2 (Port 9016)  │ │apps/studycafe(Port 9002)│ │  apps/store (Port 9006) │
│ • 스마트 모바일 임차관리│ │ • 무인 스터디카페 관제  │ │ • 스마트 스토어 POS     │
│ • FIFO 수납 / 가짜체납방│ │ • 멀티스토어 동적 라우팅│ │ • 무인 키오스크/결제    │
└────────────┬────────────┘ └────────────┬────────────┘ └────────────┬────────────┘
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Shared Kernel & Database Layer                                 │
│      [shared/auth] JWT/RBAC  •  [shared/core] StorageMonitor  •  [data/integrat.db] SQLite WAL   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ 반드시 준수해야 하는 5대 핵심 시스템 규칙

### 1. 자율 논스톱 실행 원칙 (Autonomous Non-stop Mode)
- **선택지 질문 모달 생략 (`ask_question` 금지)**: 사용자가 명시적으로 선택지를 요구하지 않는 한, 작업을 멈추지 않고 가장 완성도 높은 최선의 방안으로 끝까지 구현합니다.
- **직접 실행 (Direct Execution)**: 플랜 승인 대기로 중단하지 않고 100% 검증될 때까지 완료합니다.
- **검증 필수**: 코드 변경 후 반드시 `verify_system.py`를 실행하여 5단계 검증 통과를 확인합니다.

### 2. 비즈니스 도메인 규칙의 현실 정합성 (Domain Logic Soundness)
- **후불 입주월 비과세/익월 청구**: 월세 후불 계약은 입주월에 당월 청구가 발생하지 않으며, 다음 달에 전월 사용료가 청구됩니다.
- **가짜 체납(Ghost Overdue) 원천 차단**: 전입일 이전 데이터는 절대 청구에 포함되지 않습니다.
- **FIFO(선입선출) 순차 상계**: 입금 시 가장 오래된 미납월부터 순차 완납 처리하며, 중복 입금은 백엔드에서 원천 차단합니다.
- **단일 진입점 정규화**: 지점 ID 에일리어스(`imsi`, `main` 등)는 서비스 진입점에서 1회 단일 정규화합니다.

### 3. 멀티 테넌트 & 다이내믹 라우팅 표준 (Role-Based Routing)
- `admin / 1212`: 최고관리자 (`superadmin`) ➡️ 본사 지점/수납 관리 센터 (`/branches.html`)
- `admin01 / 1212`: 1호점 점주실장 (`branch_admin`) ➡️ 1호점 관제 화면 (`/admin.html?branch=studycafe_01`)
- `admin02 / 1212`: 2호점 점주실장 (`branch_admin`) ➡️ 2호점 관제 화면 (`/admin.html?branch=studycafe_02`)
- `student / user`: 수험생/회원 ➡️ 좌석 및 이용권 화면
- `parent`: 학부모 ➡️ 자녀 안심 모니터링 포털 (`/parent.html?phone=...`)
- `_seeded = True`: 기본 관리자 시딩은 기동 시 1회 메모리 플래그 캐싱으로 불필요한 DB 풀 스캔을 제거합니다.

### 4. 사용자 및 시스템 오류 안내 표준 (Resilient UX Banner)
- 투박한 브라우저 `alert()`를 퇴출하고, 상단 컬러 배너(`updateAppAlert`)로 안내합니다:
  - ⚠️ **황색 (Warning / Info)**: 미납 내역 없음 / 이미 완납됨 / 중복 실행 방지
  - ⚖️ **주황색 (Diff / Mismatch)**: 입력 금액과 청구 금액의 차액 발생 안내
  - ❌ **적색 (Error / Failure)**: 서버/네트워크 오류 사유 및 복구 가이드 고지
  - ✅ **녹색 (Success)**: 정상 수납 및 클립보드 복사 완료 안내
- **이중 클릭 방지 & 로딩 복원**: 버튼 클릭 즉시 `disabled = true` 및 `처리 중... ⏳`, 에러 시 즉시 복원.
- **무음 에러 삼킴(Silent Failure) 절대 금지**: `catch (err)`에서 침묵하지 않고 화면에 적색 배너 표시.

### 5. 프론트엔드 번들리스 & 공식 운영 매뉴얼 표준
- **Zero-Build Vanilla JS**: Webpack/Vite 빌드 없이 브라우저 표준 ES Module로 즉시 동작.
- **공식 운영 매뉴얼 (`manual.html`)**: 모든 SaaS 앱은 단독 실행형 매뉴얼과 `[🖨️ 인쇄 / PDF 저장]` 버튼, `@media print` A4 출력 스타일을 포함해야 합니다.

---

## 📚 상세 레퍼런스 문서 (Detailed Documentation)

필요 시 아래 참조 문서를 직접 확인하여 세부 기술 명세를 검토하십시오:
- [전체 시스템 아키텍처 명세](./references/architecture_overview.md): 모노레포, 게이트웨이, 포트 맵, 듀얼 모드
- [임차관리(Rent2) 도메인 규칙](./references/domain_rules_rent2.md): 선후불, FIFO 수납, 가짜 체납 방지, 부가세
- [멀티 테넌트 & 인증/등업 표준](./references/auth_and_multitenant.md): 계정 분기, 등업 심사 승인, 시딩 캐싱
- [개발 및 Resilient UX 표준](./references/development_and_ux_standards.md): Zero-Build, 4색 배너, 이중 클릭 방지, manual.html
