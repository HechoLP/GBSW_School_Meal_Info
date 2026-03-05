# GBSW Smart Cafeteria Dashboard

실시간 급식실 혼잡도 + 급식/알레르기 정보 + 특식 투표를 제공하는 팀프로젝트용 웹 서비스입니다.
사용자 알레르기/평점/투표는 SQLite DB(`data/app.db`)에 저장되며, 식단 평점은 일자별로 자동 분리됩니다.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

`.env` 파일이 없어도 서버는 `.env.example` 값을 자동으로 읽어 실행됩니다.

## 같은 네트워크 임시 공유

같은 Wi-Fi/LAN에서 다른 기기가 접속하려면:

```bash
npm run dev:lan
```

서버 실행 로그에 표시되는 `http://192.168.x.x:3000` 주소로 접속하면 됩니다.

Google 로그인까지 쓰려면 Google Cloud OAuth에 아래 URI를 등록하세요.
- `http://localhost:3000/auth/google/callback`
- `http://서버IP:3000/auth/google/callback`

## PWA(앱처럼 설치)

- 상단 `앱으로 추가` 버튼 또는 브라우저 메뉴로 설치할 수 있습니다.
- Chrome/Edge: 주소창의 설치 버튼 또는 `앱으로 설치`.
- Safari(macOS/iOS): 공유 메뉴에서 `Dock에 추가` 또는 `홈 화면에 추가`.
- 설치 후에는 독립 창(standalone)으로 실행됩니다.

## Google 로그인(권장)

공식 운영 시 투표/평점/알레르기 설정은 Google 로그인 기반으로 동작합니다.

`.env`에 아래 값을 설정하세요.

- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
  - `auto` 권장: 접속한 호스트 기준으로 자동 계산(예: `http://현재호스트:3000/auth/google/callback`)
  - 고정값도 가능(예: `http://localhost:3000/auth/google/callback`)
- 선택: `GOOGLE_ALLOWED_DOMAIN` (학교 도메인 제한)

Google OAuth 값이 비어 있으면 로그인 기능은 자동 비활성화됩니다.

`redirect_uri_mismatch`가 나오면 Google Cloud 콘솔의 **승인된 리디렉션 URI**에
실제 콜백 주소(`http://호스트:3000/auth/google/callback`)를 정확히 추가하세요.

상세 세팅/파일 설명은 `PROJECT_SETUP.txt`를 확인하세요.
기존 데모 파일은 `legacy-demo/`에 보존되어 있습니다.
