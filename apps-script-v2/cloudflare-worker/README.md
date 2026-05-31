# Cloudflare Worker — 두 가지 용도

이 Worker는 **POST body에 따라 두 가지 경로**로 동작합니다 (단일 endpoint, 단일 인증).

## (A) Telegram webhook → GAS doPost proxy
- 워치/사용자 → Telegram bot → 이 Worker → GAS doPost
- GAS의 302 redirect를 Telegram이 못 따라가는 간헐 실패를 Worker가 spec 준수 fetch로 우회
- 분기 조건: body가 JSON이 아니거나 `action` 필드 없음

## (B) routine 시장 리포트 → Telegram Bot API 직접 발송 ★ 2026-05-31 추가
- claude.ai routine → 이 Worker → Telegram Bot API → 사용자 채팅
- **이유**: claude.ai routine 환경 IP가 GAS에서 403 차단됨 (Google anti-abuse). Cloudflare 미국 PoP의 outbound IP도 같이 차단. Worker가 GAS 우회 불가 → Telegram Bot API 직접 호출이 유일한 해결
- 분기 조건: body가 JSON + `action == "addMarketReport"`
- 부수효과: 시트 *시장리포트_큐* 자동 적재 없음 (Telegram 채팅이 이력)

## 설치 (one-time, ~20분)

### 1단계: Cloudflare 계정
- https://dash.cloudflare.com/sign-up 에서 무료 가입 (이메일만)
- 2FA 켜기 권장 (계정 보안)

### 2단계: Worker 생성
1. 대시보드 → **Workers & Pages** → **Create application** → **Create Worker**
2. 이름 입력 (예: `tg-portfolio-proxy`) → **Deploy**
3. 배포 후 → **Edit code** → 좌측 `worker.js` 내용 전체 삭제
4. `apps-script-v2/cloudflare-worker/worker.js` 의 내용을 그대로 복사 → 붙여넣기
5. 우상단 **Save and deploy**
6. Worker URL 메모 (예: `https://tg-portfolio-proxy.<your-account>.workers.dev`)

### 3단계: 환경 변수 설정
1. Worker 상세 페이지 → **Settings** → **Variables and Secrets**
2. **Add variable** 두 개 추가, 둘 다 **Encrypt** 체크:

| Variable name | Value | 어디서 얻나 | 용도 |
|---|---|---|---|
| `SECRET` | GAS의 `TG_WEBHOOK_SECRET` 값 (32자 hex) | GAS 에디터에서 `tgShowSecret` 함수 실행 후 로그 확인 | (A)·(B) 공통 인증 |
| `GAS_URL` | GAS /exec URL (query string 없이) | GAS의 "배포 관리"에서 활성 deployment의 URL 복사 | (A) GAS forward |
| `TG_BOT_TOKEN` | Telegram 봇 토큰 (`1234:ABC...`) | GAS Properties의 `TG_BOT_TOKEN` 또는 BotFather에서 받은 값 | (B) Telegram 발송 |
| `TG_CHAT_ID` | chat ID 단일 또는 콤마 구분 리스트 (`123,456`) | GAS Properties의 `TG_CHAT_ID` 또는 `tgListChatIds` 실행 결과 | (B) Telegram 발송 |

3. **Save and deploy**

### 4단계: GAS에서 Worker URL 등록
GAS 에디터 → `Telegram.js` 열고:

1. `tgSetWorkerUrl` 함수 → 파라미터 자리에 Worker URL 입력 후 ▶ 실행
   - 또는 직접 Properties에 `TG_WORKER_URL` 추가
2. `tgInstallWebhook` 함수 ▶ 실행
   - 로그에 `mode: Worker (Cloudflare)` 표시되면 성공
   - "✅ webhook 등록 응답: Webhook was set" 확인

### 5단계: 검증
1. 텔레그램에서 "갱신" 또는 "ㄱㄱ" 전송 → 응답 즉시 도착 확인
2. 연속 5~10회 빠르게 전송해도 모두 응답 오는지 확인 (이전엔 간헐적 실패였음)

## 운영

### Worker 상태 확인
- Cloudflare 대시보드 → 해당 Worker → **Logs** (실시간) 또는 **Metrics** (요청 수, 에러율)
- GAS 측은 `tgWebhookInfo` 함수로 Telegram webhook 상태 확인

### Worker URL 변경 시
- 새 Worker 배포 후 URL 바뀌면 → GAS에서 `tgSetWorkerUrl('새URL')` + `tgInstallWebhook` 재실행

### Worker 모드 끄기 (직접 GAS 모드로 복귀)
- GAS에서 `tgClearWorkerUrl` 실행 → `tgInstallWebhook` 재실행
- 직접 GAS 모드는 fallback. 평소엔 Worker 모드 권장

### Secret 회전
1. GAS에서 새 secret 생성 후 `TG_WEBHOOK_SECRET` Property 갱신
2. Cloudflare Worker의 `SECRET` env 변수도 동일하게 갱신
3. `tgInstallWebhook` 재실행 (Telegram에 새 secret_token 등록)

## 비용
- 무료 티어: 10만 req/일, CPU 10ms/req
- 실제 사용량: 하루 수십 req → 무료 한도의 0.1% 미만
- 결제 정보 등록 불필요

## 문제 해결

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| Telegram에서 메시지 보내도 응답 없음 | Worker URL이 GAS Properties에 잘못 입력 | `tgWebhookInfo` 출력의 `url`이 Worker URL인지 확인 |
| Worker 로그에 `forbidden` 다수 | `SECRET` env값과 GAS `TG_WEBHOOK_SECRET` 불일치 | 양쪽 동기화 |
| Worker 로그에 `upstream error` | GAS URL 오타 또는 deployment 비활성 | `GAS_URL` env값 확인, GAS "배포 관리"에서 활성 deployment 점검 |
| Worker 로그에 `worker misconfigured` | env 변수 누락 | `SECRET`, `GAS_URL` 둘 다 설정됐는지 확인 |
