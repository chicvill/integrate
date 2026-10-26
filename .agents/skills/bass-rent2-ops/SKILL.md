---
name: bass-rent2-ops
description: Operational business rules, domain invariants, and verification instructions for the BassSaasApp Smart Rent2 (스마트 원룸임차 관리) application (apps/rent2). Review and update this skill before modifying rent2 features.
---

# Bass Rent2 (스마트 모바일 원룸임차 관리) 도메인 운영규칙 Skill

앱 식별자: `rent2`  
카테고리: `business`  
포트: 8000 (`/api/rent2`, `/rent2/`)

---

## 1. 핵심 비즈니스 불변식 (Core Business Invariants)

### ① 후불 입주월 비과세 / 익월 청구 원칙 (가짜 체납 Ghost Overdue 방지)
- **규칙**: 월세가 '후불'인 경우, 입주월 당월에는 청구가 발생하지 않으며 다음 달에 전월 사용료가 청구됩니다.
- **가짜 체납 원천 차단**: 전입일(`move_in`) 이전 날짜는 청구 대상에 절대 포함되지 않으며, 입주월 당월을 미납으로 오판단하여 적색 경고나 독촉 문자를 보내는 행위를 엄격히 금지합니다.

### ② 은행 입금 문자 파싱 및 FIFO(선입선출) 순차 상계
- **FIFO 원칙**: 입금 발생 시 **가장 오래된 미납월(Oldest Unpaid Month)부터 순차 상계**합니다.
  - 예: 5월 50만 원 미납, 6월 50만 원 미납 상태에서 70만 원 입금 ➡️ 5월분 50만 원 완납 + 6월분 20만 원 부분 납부 (잔여 미납 30만 원).
- **중복 입금 방지 (Idempotency)**: 동일 호실, 동일 입금자, 동일 금액, 동일 일시의 중복 등록을 원천 차단하며 ⚠️ 황색 경고 배너로 안내합니다.

### ③ 부가세(VAT) 및 과세 구분
- 주거용 원룸: 면세 (VAT 없음).
- 상가/사무실: 공급가액 + 10% VAT 분리 계산 및 세금계산서 발행 플래그 관리.

### ④ 단일 진입점 정규화 (Single Source of Truth)
- 지점 ID(`normalize_branch_id`)는 진입점에서 단일 Canonical ID로 1회만 변환합니다.
- 금액 필드 누락 시 `0` 또는 기본값 fallback을 의무 적용합니다.

---

## 2. 기능 변경 시 필수 체크리스트 (Skill-First Workflow)

1. 수납 알고리즘이나 계약 청구 방식을 변경할 때는 **반드시 본 문서의 FIFO 상계 원칙 및 후불 비과세 규칙을 먼저 검토**합니다.
2. `apps/rent2/backend/domain/` 내 계산 모델을 개정합니다.
3. `apps/rent2/frontend/manual.html`의 운영 가이드를 동기화합니다.
4. 단위 테스트로 가짜 체납 발생 여부를 검증합니다.
