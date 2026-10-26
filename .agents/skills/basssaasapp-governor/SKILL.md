---
name: basssaasapp-governor
description: Master operations, architectural standards, and Skill-First governance rules for the BassSaasApp object-oriented micro-SaaS platform. Use this skill when creating new apps, migrating legacy apps, or modifying platform core capabilities.
---

# BassSaasApp Master Platform Governor Skill

본 스킬은 50~100개 마이크로 SaaS 앱을 하나의 통일된 체계로 관리하기 위한 **플랫폼 총괄 헌법이자 거버넌스 엔진**입니다.

---

## 1. 🌟 Skill-First 개발 원칙 (절대 규칙)

새로운 기능을 추가하거나 기존 비즈니스 로직을 변경할 때, **코드를 먼저 수정하는 것은 엄격히 금지**됩니다.

```text
[요구사항 발생] 
       │
       ▼
[1단계] 해당 앱의 SKILL.md 검토 및 비즈니스 규칙 개정 (도메인 정합성 확인)
       │
       ▼
[2단계] 도메인 모델(domain.py) 비즈니스 메서드 구현
       │
       ▼
[3단계] API 라우터(api.py) 및 프론트엔드 UI/매뉴얼(manual.html) 갱신
       │
       ▼
[4단계] 스킬 내 검증 스크립트 및 unittest 통과 확인 후 커밋
```

### 왜 Skill-First인가?
1. **코드-명세 불일치(Drift) 원천 방지**: 시간이 지나도 스킬이 항상 최신 비즈니스 진실(Source of Truth)을 담고 있습니다.
2. **도메인 왜곡 차단**: '가짜 체납', '잘못된 위약금', '시간 계산 착오' 등 현실 업무 규칙 위반을 코딩 전에 걸러냅니다.
3. **AI 에이전트 인수인계 보장**: 다른 AI 에이전트나 개발자가 투입되어도 스킬만 읽으면 도메인 규칙을 즉각 파악합니다.

---

## 2. 2단계 객체화 아키텍처 (Two-Tier OOP Standard)

1. **계층 1. 시스템 레벨 객체화 (`BaseSaaSApp`)**:
   - 모든 앱은 `apps/<app_id>/app.py` 에 `BaseSaaSApp` 을 상속한 클래스 1개로 정의됩니다.
   - 메타데이터(`app_id`, `app_name`, `icon`, `category`, `features`, `subdomains`), `get_router()`, `on_startup()`, `health_check()` 구현.
   - 게이트웨이는 앱 내부 구현을 알 필요 없이 제로터치로 자동 마운트합니다.

2. **계층 2. 도메인 레벨 객체화 (`Kernel Obj`)**:
   - 모든 비즈니스 엔티티는 `core.kernel.Obj` 를 상속받습니다.
   - 스키마리스 WAL 저장소(`Store`)에 JSON-KV 형태로 영구 보존되므로 DDL 마이그레이션이 필요 없습니다.
   - 스스로 저장(`save()`), 조회(`get()`, `find()`), 삭제(`delete()`), 이력 로깅(`log()`)을 수행합니다.

---

## 3. Resilient UX 및 알림 배너 표준

브라우저 기본 `alert()` 사용을 금지하며, `Bass.updateAppAlert` 4색 배너를 준수합니다:
- ⚠️ **황색 (`warning`)**: 이미 처리됨 / 중복 실행 방지 / 비어 있음 등 현실 안내.
- ⚖️ **주황색 (`diff`)**: 입력 금액과 요금 간 차액(`difference`) 실시간 안내.
- ❌ **적색 (`error`)**: 엔티티 부재(`NotFound`), 권한 부족, 시스템/격리 오류.
- ✅ **녹색 (`success`)**: 정상 처리 완료 및 다음 행동 안내.

버튼 클릭 시 반드시 `Bass.withLock(btn, async () => { ... })` 을 사용하여 **이중 클릭 차단 및 에러 시 버튼 상태 복원**을 보장해야 합니다.

---

## 4. 공식 운영 매뉴얼 (`manual.html`) 표준

- 모든 앱의 프론트엔드 루트에 번들리스 `manual.html` 이 반드시 존재해야 합니다.
- 상단에 `[🖨️ 매뉴얼 인쇄 / PDF 저장]` 버튼을 두고 `@media print` A4 고대비 흑백 인쇄를 지원해야 합니다.
