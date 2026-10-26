---
name: bass-selfstudy2-ops
description: Operational business rules, domain invariants, and verification instructions for the BassSaasApp Smart SelfStudy2 application (apps/selfstudy2). Review and update this skill before modifying selfstudy features.
---

# Bass SelfStudy2 (관리형 독서실 관제) 도메인 운영규칙 Skill

앱 식별자: `selfstudy2`  
카테고리: `education`  
포트: 8000 (`/api/selfstudy2`, `/selfstudy2/`)

---

## 1. 핵심 비즈니스 불변식 (Core Business Invariants)

### ① 수험생 관리 및 출결 규칙
- **고정석 배정**: 수험생 등록 시 전용 좌석(`assigned_seat`)이 지정되며 중복 배정 불가.
- **출결 상태 전이**:
  - `check_in()`: 등원 처리 및 출결 일시 기록. 학부모 안심 알림 연동.
  - `check_out()`: 하원 처리 및 당일 총 순공시간(학습 시간) 집계.

### ② 학부모 참관 및 상담 일지
- 학부모 전화번호(`parent_phone`)가 등록된 학생의 입퇴실 이벤트는 실시간 포털로 공유.
- 정기 면담(`Consultation`) 기록은 학생 객체에 영구 보존.

---

## 2. 기능 변경 시 필수 체크리스트 (Skill-First Workflow)

1. 수험 과정(수능, 공시, 편입 등)이나 출결 감시 정책 변경 시 **본 문서를 먼저 개정**합니다.
2. `apps/selfstudy2/backend/domain/` 도메인 모델을 업데이트합니다.
3. `apps/selfstudy2/frontend/manual.html` 운영 매뉴얼을 동기화합니다.
