# 🏢 부동산 원룸 임차료 관리 시스템 (Rent App) 개발·운영·배포 가이드

29개실(101호, 201~605호, 701~703호) 규모의 다가구/원룸 임대차 전문 관리 SaaS 및 독립 패키지 애플리케이션입니다.

---

## 📑 1. 개발 및 빌드 (Development)

- **프론트엔드 모듈 경로:** `apps/rent/frontend/js/` (`state.js`, `modals.js`, `ui.js`, `api.js` 등)
- **백엔드 서비스 경로:** `apps/rent/backend/services/` (`rent_service.py`, `payment_service.py` 등)
- **번들 빌드:**
  프론트엔드 JS 수정 후 브라우저 호환 및 로컬 실행을 위해 반드시 번들을 재생성합니다:
  ```bash
  py scripts/build_rent_bundle.py
  ```
- **문법 검사:**
  ```bash
  py -m py_compile apps/rent/backend/schemas.py apps/rent/backend/services/rent_service.py
  ```

---

## 🚀 2. 실행 모드 (Execution Modes)

### 모드 A: 중앙 SaaS 모드 (포털 연동)
- 중앙 게이트웨이 기동: `run.bat` (Port 9000)
- 접속 URL: `http://localhost:9000/rent/` (또는 운영 서버: `http://34.31.10.12/rent/`)

### 모드 B: 단독 실행 모드 (Standalone Local)
- 단독 러너 실행:
  ```bash
  py apps/rent/standalone_runner.py
  ```
- 접속 URL: `http://localhost:8000/`

---

## ☁️ 3. 중앙 클라우드 서버 배포 (GCP Sync)

GCP VM(`34.31.10.12`)에 최신 코드 및 DB 무손실 동기화 배포:
```powershell
powershell -File scripts/sync_rent_patch.ps1
```
- 서버 DB(`integrat.db`) 자동 백업 ➡️ 코드 핫패치 ➡️ 컨테이너 재기동 ➡️ 테이블 검증 일괄 수행.

---

## 📦 4. 고객 판매/납품용 단독 패키지 추출 (Export)

개인 건물주 또는 전용 클라우드 고객에게 납품할 자립형 솔루션 패키지 추출:
```bash
py scripts/export_app.py --app rent --zip
```
- **산출물:** `dist/rent_standalone.zip`
- **고객 사용법:** 압축 해제 후 `START.bat` 더블클릭 ➡️ 관리실 PC 폐쇄망 인트라넷 즉시 가동.
- **업데이트:** `UPDATE.bat` 더블클릭 ➡️ 기존 계약/장부 데이터 보존된 채 10초 만에 갱신.

---

## 📖 5. 공식 사용자 운영 매뉴얼
- 웹 브라우저에서 `manual.html` 열기 (상단 `[🖨️ 매뉴얼 인쇄 / PDF 저장]` 버튼 제공).