# MQnet Multi-Tenant & Identity Standard

MQnet 통합 플랫폼은 단일 포털에서 각 역할별 사용자를 자동으로 식별하고, 해당 권한에 맞는 전용 관제 화면으로 분기시키는 **다이내믹 라우팅(Dynamic Routing)** 체계를 갖추고 있습니다.

---

## 1. 계정별 자동 분기 매트릭스 (Role-Based Dynamic Routing)

| 로그인 계정 (ID / PW) | 역할 (Role) | 전용 라우팅 대상 화면 | 핵심 권한 및 기능 |
| :--- | :--- | :--- | :--- |
| **`admin / 1212`** | `superadmin` (본사 총괄 최고관리자) | `/branches.html` | 전 지점 통합 관제, 신규 지점 개설, 가맹점 관리자 승인/반려, 전사 매출 통계 |
| **`admin01 / 1212`** | `branch_admin` (1호점 점주실장) | `/admin.html?branch=studycafe_01` | 제1매장 실시간 좌석/사물함 현황, 스마트 도어 개폐, 현장 수납 |
| **`admin02 / 1212`** | `branch_admin` (2호점 점주실장) | `/admin.html?branch=studycafe_02` | 제2매장 실시간 좌석/사물함 현황, 스마트 도어 개폐, 현장 수납 |
| **`student` / `user`** | `user` (일반 회원 / 수험생) | `/user.html` (또는 `/kiosk.html`) | 좌석 선택 및 시간권 결제, 입/퇴실 바코드, 내 이용권 조회 |
| **`parent`** | `parent` (학부모) | `/parent.html?phone={자녀전화번호}` | 자녀 실시간 안심 입실/퇴실 모니터링, 공부 시간 리포트 |

---

## 2. 등업 신청 및 승인 워크플로우 (Self-Service Upgrade)

```text
[일반 가입자 회원가입]
       │
       ▼
[지점 관리자 등업 신청 제출] ──▶ status = 'PENDING'
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
   [본사 관리자 (superadmin) 승인]          [본사 관리자 (superadmin) 반려]
                 │                                         │
                 ▼                                         ▼
      role = 'branch_admin'                     status = 'REJECTED'
      status = 'APPROVED'                       일반 회원 권한 유지
      지점 관제 화면 즉시 개방
```

1. **신청 접수**: 일반 사용자가 마이페이지에서 가맹점 관리자 등업을 신청하면 `upgrade_status = "PENDING"` 상태가 기록됩니다.
2. **본사 심사**: `superadmin`은 `/branches.html`의 승인 대기 목록에서 사업자등록증 및 신청 내역을 검토합니다.
3. **즉시 승격**: 승인 버튼을 클릭하면 `role = "branch_admin"`, `status = "APPROVED"`로 즉시 승격되며, 해당 지점에 대한 독점 관제 권한이 부여됩니다.

---

## 3. 초기화 및 시드 데이터 캐싱 최적화 (`_seeded = True`)
- 성능 저하를 방지하기 위해 기본 관리자 계정 생성 로직(`ensure_default_admins`)은 매 요청마다 데이터베이스를 풀 스캔하지 않습니다.
- 백엔드 프로세스 기동 시 1회만 초기화하고, 메모리 플래그(`_seeded = True`)를 적용하여 0.1ms 미만의 빠른 응답 속도를 유지합니다.
