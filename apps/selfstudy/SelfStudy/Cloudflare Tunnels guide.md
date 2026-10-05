# 🌐 Cloudflare Tunnels를 활용한 로컬 PC 외부 서비스 개방 가이드

사용자님의 윈도우 PC에서 실행 중인 `SelfStudy` 플랫폼(백엔드 및 프론트엔드)을 전 세계 어디서든 학부모님과 수험생들이 접속할 수 있도록 만들어주는 가이드입니다.

이 방식을 사용하면 공유기 설정(포트포워딩) 없이도, 심지어 윈도우 방화벽이 켜져 있는 상태에서도 안전하게 서비스를 외부에 개방할 수 있습니다.

---

## 1단계: Cloudflare 가입 및 도메인 준비
Cloudflare Tunnels를 사용하려면 도메인(예: `my-selfstudy.com`)이 하나 필요합니다.

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) 사이트에 접속하여 무료 회원가입을 진행합니다.
2. 만약 보유하고 계신 도메인이 없다면 가비아(Gabia), 호스팅케이알 등에서 저렴한 도메인(예: `.shop`, `.com`)을 하나 구매한 뒤, 해당 도메인의 네임서버를 Cloudflare로 연결(등록)합니다.

## 2단계: 터널(Tunnel) 생성
1. Cloudflare Zero Trust 대시보드 좌측 메뉴에서 **Networks > Tunnels** 로 이동합니다.
2. **[Create a tunnel]** 버튼을 클릭합니다.
3. 커넥터 유형으로 **Cloudflared**를 선택하고 Next를 누릅니다.
4. 터널 이름(예: `SelfStudy-PC`)을 입력하고 **Save tunnel**을 클릭합니다.

## 3단계: 윈도우 PC에 cloudflared 데몬 설치
이제 사용자님의 윈도우 PC(서버 역할을 할 PC)에 Cloudflare 데몬을 설치해야 합니다.

1. Cloudflare 화면에 나타난 **Choose your environment**에서 **Windows**를 선택합니다.
2. 명령어 복사 박스에 제공된 명령어를 복사합니다. 대략 다음과 같은 형태입니다.
   ```powershell
   cloudflared.exe service install eyJh... (엄청나게 긴 암호화 토큰)
   ```
3. 사용자님의 PC에서 **Windows PowerShell을 '관리자 권한'으로 실행**합니다.
4. 복사한 명령어를 그대로 붙여넣고 엔터를 치면 데몬 설치가 완료됩니다.
5. Cloudflare 대시보드 화면 하단에 `Status: Active` 라고 불이 켜지면 PC와 Cloudflare 간의 비밀 터널이 성공적으로 뚫린 것입니다! **Next**를 누릅니다.

## 4단계: 퍼블릭 호스트명(라우팅) 설정
이제 외부 인터넷(도메인)으로 들어온 요청을 내 PC의 몇 번 포트로 넘겨줄지 정하는 단계입니다. 우리는 프론트엔드(5220)와 백엔드(8001)를 각각 연결해야 합니다.

### 첫 번째 라우팅: 프론트엔드 (학생/학부모 접속용)
1. **Public hostname** 탭에 다음을 입력합니다.
   * **Subdomain**: (비워두거나 `www` 입력)
   * **Domain**: 구매하신 도메인 선택 (예: `my-selfstudy.com`)
2. **Service** 탭에 다음을 입력합니다.
   * **Type**: `HTTP`
   * **URL**: `localhost:5220`
3. **Save hostname**을 클릭합니다.
👉 *이제 부모님들이 스마트폰에서 `https://my-selfstudy.com`을 입력하면 사용자님 PC의 React 화면이 뜹니다!*

### 두 번째 라우팅: 백엔드 API (데이터 통신용)
프론트엔드에서 데이터를 불러오려면 백엔드 서버도 외부에 열려 있어야 합니다.
1. 방금 만든 터널을 클릭하고 **[Edit]** -> **[Public Hostname]** 탭으로 가서 **[Add a public hostname]**을 누릅니다.
2. **Public hostname** 탭:
   * **Subdomain**: `api` (중요)
   * **Domain**: 구매하신 도메인 선택 (예: `api.my-selfstudy.com`)
3. **Service** 탭:
   * **Type**: `HTTP`
   * **URL**: `localhost:8001`
4. **Save hostname**을 클릭합니다.
👉 *이제 `https://api.my-selfstudy.com`을 통해 백엔드 데이터에 접근할 수 있습니다.*

## 5단계: 프론트엔드 환경변수 수정 및 빌드
지금까지 프론트엔드는 `http://localhost:8001`을 바라보고 통신했습니다. 이를 방금 만든 외부 도메인으로 바꿔주어야 합니다.

1. 프론트엔드 폴더(`SelfStudy\frontend`)에 `.env.production` 파일을 만들고 아래 코드를 넣습니다.
   ```env
   VITE_API_URL=https://api.my-selfstudy.com
   ```
2. 이제 터미널에서 기존의 `npm run dev` 대신 빌드 후 정적 서버로 실행해야 속도가 훨씬 빠르고 안정적입니다.
   ```bash
   cd c:\Users\USER\Desktop\Workstation\SelfStudy\frontend
   npm run build
   npx serve -s dist -p 5220
   ```
3. 백엔드 역시 터미널에서 실행해 둡니다.
   ```bash
   cd c:\Users\USER\Desktop\Workstation\SelfStudy\backend
   python main.py
   ```

---

🎉 **설정 완료!** 🎉
이제 사용자님의 PC가 켜져 있고 백엔드/프론트엔드 터미널이 실행 중이기만 하다면, 전 세계 어디서든 학부모님과 수험생들이 `https://my-selfstudy.com` 에 접속하여 완벽하게 작동하는 자기주도학습 플랫폼을 이용할 수 있습니다!
