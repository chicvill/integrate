# MQnet n8n AI 워크플로우 자동화 가이드

`apps/n8n`은 금융 입출금 알림 분석, 구글 시트 연동, 자기주도학습(SelfStudy) AI 멘토링 등을 노코드/로우코드로 자동화하는 n8n 워크플로우 패키지입니다.

---

## ⚡ 기본 정보
* **로컬 웹 UI 접속**: [http://localhost:3000](http://localhost:3000)
* **Cloudflare 외부 도메인**: `https://n8n.chicvill.store`
* **작업 디렉토리**: `D:\Workstation\Test-n8n`
* **DB 파일**: `D:\Workstation\Test-n8n\database.sqlite`

---

## 📦 포함된 워크플로우 템플릿 (`workflows/`)

### 1. 농협/은행 입금 이메일 파싱 & 구글 시트 자동화
* **파일명**: `workflows/nonghyup_deposit_workflow.json`
* **주요 기능**:
  * 은행 입금 알림 이메일 실시간 수신 및 파싱
  * 입금자명, 금액, 거래일시 추출
  * Google Sheets 및 로컬 Excel(`nonghyup_deposits.xlsx`)에 자동 기입

### 2. SelfStudy AI 메타인지 멘토 & 학습 트래커
* **파일명**: `workflows/selfstudy_ai_mentor_workflow.json`
* **주요 기능**:
  * 매일 아침 8시 자동 학습 스케줄러 트리거
  * 학생 공부 일기 및 질문 수신 Webhook (`POST /webhook/selfstudy-feedback`)
  * **Google Gemini 2.5 AI Agent**를 통한 3단계 맞춤형 메타인지 조언 생성
  * Google Sheets 실시간 학습 로그 기록 및 클라이언트 JSON 응답

---

## 🚀 n8n에서 워크플로우 가져오기 (Import) 방법
1. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속
2. 좌측 메뉴에서 **Workflows** 클릭 ➡️ 우측 상단 **`Add workflow`** 클릭
3. 우측 상단 `...` (더보기 메뉴) ➡️ **`Import from File`** 클릭
4. `D:\Workstation\integrate\apps\n8n\workflows\` 폴더의 `.json` 파일을 선택하면 즉시 워크플로우가 로드됩니다.
5. 상단 우측의 **`Active`** 스위치를 켜면 백그라운드 자동화가 가동됩니다.
