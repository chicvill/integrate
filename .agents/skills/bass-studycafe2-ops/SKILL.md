---
name: bass-studycafe2-ops
description: Operational business rules, domain invariants, and verification instructions for the BassSaasApp Smart StudyCafe2 application (apps/studycafe2). Review and update this skill before modifying studycafe features.
---

# Bass StudyCafe2 (무인 스터디카페 관제) 도메인 운영규칙 Skill

앱 식별자: `studycafe2`  
카테고리: `business`  
포트: 8000 (`/api/studycafe2`, `/studycafe2/`)

---

## 1. 핵심 비즈니스 불변식 (Core Business Invariants)

### ① 좌석 상태 전이 규칙
```text
  [ EMPTY ] ──check_in(member)──▶ [ OCCUPIED ] ──check_out()──▶ [ EMPTY ]
                                      │   ▲
                            step_out()│   │step_in()
                                      ▼   │
                                  [ STEP_OUT ] (외출)
```
- **EMPTY (빈 좌석)**: 유효한 이용권(`Ticket`)을 보유한 회원만 입실 가능.
- **OCCUPIED (사용 중)**: 동일 좌석에 중복 입실 불가. 외출(`step_out`) 또는 퇴실(`check_out`) 가능.
- **STEP_OUT (외출 중)**: 좌석 점유는 유지되며, 재입실(`step_in`) 시 `OCCUPIED`로 복귀.

### ② 이용권 차감 및 자동 만료
- 시간권: 입실 시간부터 분 단위 잔여시간(`remaining_minutes`)이 실시간 차감됨.
- 잔여시간 소진 시 세션 강제 종료 및 알림 발송.

---

## 2. 기능 변경 시 필수 체크리스트 (Skill-First Workflow)

1. 좌석 요금 정책이나 이용권 유형(심야권, 정기권 등) 변경 시 **본 문서의 요금 및 이용권 규칙을 먼저 개정**합니다.
2. `apps/studycafe2/backend/domain/` 도메인 모델을 업데이트합니다.
3. `apps/studycafe2/frontend/manual.html` 운영 매뉴얼을 동기화합니다.
