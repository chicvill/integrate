---
name: bass-laundry-ops
description: Operational business rules, domain invariants, and verification instructions for the BassSaasApp Smart 24h Laundry (무인빨래방) application (apps/laundry). Review and update this skill before modifying laundry features.
---

# Bass Laundry (스마트 24시 무인빨래방) 도메인 운영규칙 Skill

앱 식별자: `laundry`  
카테고리: `business`  
포트: 8000 (`/api/laundry`, `/laundry/`)

---

## 1. 비즈니스 도메인 규칙 (Domain Invariants)

### ① 장비 상태 전이 다이어그램
```text
  ┌──────┐    start(course, paid)    ┌─────────┐
  │ IDLE │ ────────────────────────▶ │ RUNNING │
  └──────┘                           └─────────┘
     ▲                                    │ (ends_at 경과 시 sync)
     │ collect()                          ▼
     │                               ┌─────────┐
     └────────────────────────────── │  DONE   │
                                     └─────────┘

  [어느 상태] ──report_broken(reason)──▶ [ BROKEN ] ──repair()──▶ [ IDLE ]
```

- **IDLE (사용 가능)**: 누구나 코스를 선택하고 결제할 수 있음.
- **RUNNING (가동 중)**: 추가 결제 불가 (`Conflict` 409 황색 배너). 잔여 시간 카운트다운.
- **DONE (수거 대기)**: 세탁 완료 상태. 세탁물을 비우고 `collect()` 호출 시 IDLE로 복귀.
- **BROKEN (점검 중)**: 관리자만 수리(`repair()`)할 수 있으며 일반 고객 결제 전면 차단.

### ② 요금 정합성 및 차액 안내 (`Mismatch` 422)
- 투입 금액(`paid`)이 코스 요금(`price`)과 1원이라도 다르면 결제가 거절됩니다.
- 거절 시 단순 실패가 아닌 **주황색 차액 배너(`diff`)**로 `차액(difference)`, `정확한 필요 금액(expected)`을 실시간 계산하여 안내해야 합니다.

### ③ 코스 및 요금표 불변식
| 구분 | 코스 키 | 코스 명 | 소요 시간 | 정상 요금 |
| :--- | :--- | :--- | :--- | :--- |
| **세탁기** | `quick` | 쾌속 세탁 | 25분 | 3,000원 |
| | `standard` | 표준 세탁 | 40분 | 4,000원 |
| | `bedding` | 이불 세탁 | 60분 | 6,000원 |
| **건조기** | `dry30` | 건조 30분 | 30분 | 3,000원 |
| | `dry50` | 건조 50분 | 50분 | 4,500원 |

---

## 2. 기능 변경 시 필수 체크리스트 (Skill-First Workflow)

1. 새로운 코스(예: 살균 건조)를 추가하거나 가격을 변경할 때는 **반드시 본 문서의 요금표와 코스 키를 먼저 개정**합니다.
2. `apps/laundry/backend/domain.py`의 `COURSES` 딕셔너리를 스킬과 일치시킵니다.
3. `apps/laundry/frontend/index.html` 및 `apps/laundry/frontend/manual.html`의 테이블을 동기화합니다.
4. `unittest`로 차액 계산 및 상태 전이가 정상 작동하는지 확인합니다.
