# ⚡ MQnet Canonical SaaS Template
> **표준 규격:** MQnet SaaS Application Development Guide (`NEW_APP_DEVELOPMENT_GUIDE.md`) 준수  
> **핵심 철학:** **Zero Build Step 번들리스 Vanilla JS/CSS**, **완전 분리형 FastAPI 백엔드**, **NoCacheStaticFiles 캐시 방어**, **공통 통합 인증(`/shared/ui/auth.js`) 내장**

MQnet 통합 플랫폼의 표준 풀스택 SaaS 골격 템플릿입니다.  
신규 앱 생성 시 복잡한 빌드 도구 의존성 없이 즉시 실행 및 배포 가능한 완벽한 프로덕션 규격을 제공합니다.

---

## 🌟 핵심 아키텍처 원칙

1. **빌드 프리(Zero Build Step) 번들리스 프론트엔드**:
   - `npm install`이나 `npm run build` 없이 브라우저 네이티브 ES Module (`import`/`export`) 기반으로 동작.
   - 코드 수정 즉시 브라우저 새로고침만으로 변경사항이 100% 반영되는 초고속 개발 워크플로우.
2. **정적 캐시 고착 원천 차단 (Cache Busting & NoCacheStaticFiles)**:
   - 중첩 `@import`를 금지하고 `index.html`에서 직접 `<link>` 태그와 버전 쿼리(`?v=1.0`) 로드.
   - 단일 게이트웨이(Port 8000/9000)에서 `NoCacheStaticFiles`를 통해 정적 파일 서빙.
3. **표준 데이터베이스 & 비동기 워커 코어**:
   - `shared.core.base_database.Base` 상속 SQLAlchemy ORM 모델 내장 (게이트웨이 기동 시 자동 테이블 생성).
   - CPU/IO 집약적 작업(AI 분석, 미디어 처리)은 `ThreadPoolExecutor`를 통해 비동기 이벤트 루프 차단(Blocking) 방지.
4. **동적 API Base URL 결정 (`getApiBase`)**:
   - 단독 실행(`http://localhost:{PORT}`), 서브패스(`http://domain/{APP_ID}`), 서브도메인(`{APP_ID}.domain`) 모두 소스 수정 없이 자동 적응.
5. **통합 인증 (`MQnetAuth v2.0`) 연동**:
   - `/shared/ui/auth.js` 모듈과 연동하여 로그인/회원가입 모달 및 JWT 로컬스토리지 자동 주입.
6. **다중 매장 / 멀티 테넌트 (Multi-Branch) 기본 지원**:
   - 상단 헤더의 지점 셀렉터(`branchSelector`)를 통해 실시간 매장별 데이터 분리 및 즉시 전환.
   - `AppBranch` 모델 및 `GET /branches`, `POST /branches`를 통한 신규 가맹점/지점 1-클릭 등록.
   - 모든 항목은 `branch_id` 기반으로 지점별 독립 관리 또는 본사 통합 관제 지원.


---

## 📁 표준 프로젝트 구조

```text
templates/saas-template/
├── backend/
│   ├── __init__.py
│   ├── config.py              # BaseConfig 상속 (APP_ID, PORT, STORAGE_DIR)
│   ├── main.py                # 단독 로컬 실행용 FastAPI 엔트리포인트
│   ├── schemas.py             # Pydantic v2 입출력 데이터 모델
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py        # Base, get_db, SessionLocal 세션 팩토리
│   │   └── models.py          # SQLAlchemy 테이블 모델 (Base 상속)
│   ├── routers/
│   │   ├── __init__.py
│   │   └── main_router.py     # prefix="" 로 정의된 핵심 API 라우터
│   └── services/
│       ├── __init__.py
│       └── core_service.py    # 비즈니스 로직 및 ThreadPoolExecutor 워커
└── frontend/
    ├── index.html             # 메인 UI 구조 (CSS/JS 직접 링크, 캐시 버스팅)
    ├── style.css              # 앱 기본 스타일
    ├── css/
    │   ├── variables.css      # 디자인 토큰 (네온 다크, 글래스모피즘, 폰트)
    │   ├── layout.css         # Grid/Flexbox 컨테이너 및 뷰포트 배치 (flex-shrink:0 방어)
    │   └── components.css     # 버튼, 모달, 카드, 뱃지 등 UI 컴포넌트
    ├── app.js                 # 프론트엔드 메인 엔트리포인트 (초기화 및 모듈 바인딩)
    └── js/
        ├── api.js             # getApiBase() 기반 백엔드 통신 모듈 & X-App-ID 헤더
        ├── state.js           # 전역 반응형 상태 저장소
        ├── ui.js              # DOM 렌더링 및 UI 유틸리티
        └── modals.js          # 팝업 및 조작 모달 제어
```

---

## 🚀 빠른 시작 (Local Run)

### 1. 단독 백엔드 + 프론트엔드 실행
```bash
# 워크스페이스 루트에서 실행
py -3.14 -m uvicorn templates.saas-template.backend.main:app --port 8015 --reload
```
- 웹 대시보드: [http://localhost:8015](http://localhost:8015)
- API Swagger 문서: [http://localhost:8015/docs](http://localhost:8015/docs)
- 시스템 상태 조회: [http://localhost:8015/api/status](http://localhost:8015/api/status)

---

## 🛠️ 새 SaaS 앱 생성 (CLI Scaffolding)

이 표준 템플릿을 기반으로 새로운 독립 SaaS 서비스를 생성하려면 아래 명령어를 실행합니다:

```bash
# 예시: 스마트 펫케어 앱 생성
py -3.14 scripts/create_app.py --id petcare --name "스마트 펫케어" --icon "🐾" --category "iot" --port 8016
```
- 생성 완료 즉시 `apps/petcare/` 디렉토리가 구성되며, 별도의 빌드 과정 없이 바로 게이트웨이 또는 단독으로 실행 가능합니다.
