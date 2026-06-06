# 2026-06-06 — 텔레그램 푸시 GitHub Actions 이전 + 시장 리포트 데이터 개편

## 배경
6/5 장중 텔레그램 손익 푸시가 11:14 이후 끊김. "마이그레이션 탓?" 의심에서 출발.

## 1. 텔레그램 푸시 장애 진단
- Apps Script 실행 로그: `tgPushPnL`이 `10:45·11:07·11:13` 후 **11:13~14:45(3.5h) 발화 부재**, `scheduledHourlyUpdate`도 동일 구간 누락. 에러 아님 — *발화 자체 없음*.
- **원인 확정**: GAS time-based 트리거의 best-effort 특성(정시 발화 미보장, 플랫폼 사정으로 수시간 누락). 마이그레이션·코드 변경·휴장 오판정·락 전부 무관(각각 배제 검증).
- 고장난 건 GAS '트리거'지 '웹앱'이 아님 — 웹앱은 요청 구동이라 정상(`ㄱㄱ`이 증거).

## 2. 해결 — GitHub Actions = 신뢰 시계, GAS = 요청 구동 워커
- GAS `doPost`에 `action=pushPnL` 분기 + `_tgHandlePushPost`(secret 검증 → `tgPushPnL()` 호출). push_safe로 배포, deployment v9에 반영 확인.
- `.github/workflows/telegram-push.yml` — 장중(KST 월~금 09:05~15:45 `:05/:25/:45`) GAS 웹앱 호출. 휴장/장외는 `tgPushPnL` 자체 게이트로 skip.
- 구 GAS 트리거 3개 OFF(사용자 🔕).
- **버그**: 워크플로 curl에 `-X POST` → GAS 302 리다이렉트를 POST로 따라가 echo가 405. `-X POST` 제거로 해결(errors.md 2026-06-06).
- **검증(직접)**: `gh workflow run` → `HTTP 200 {"success":true}` + `ㄱㄱ`로 실제 손익 도착.

## 3. 시장 리포트 "반드시 도착" 안전망
- `market-report.yml`: 40분 간격 2회 예약(US 08:02/08:42, KR 17:02/17:42) + 체크아웃 시 오늘 파일 있으면 skip(중복 방지). 한 틱 누락돼도 창 안 도착.

## 4. 리포트 데이터 수집 전면 개편
- **정정**: 대량 "미수집"은 *Naver 차단이 아니라* JS렌더 페이지를 WebFetch가 못 긁은 것 (Naver 전부 HTTP 200). 진단 워크플로(`_data-probe`)로 미국 IP에서 소스 검증.
- **US** (`us-prompt.md`): **Yahoo v8 chart JSON**(`^GSPC ^NDX ^DJI ^SOX ^VIX DX-Y.NYB ^TNX` + M7 + 섹터 XL* 11종 + AVGO). 등락률 = `(regularMarketPrice−chartPreviousClose)/chartPreviousClose×100`. Top Movers·이슈는 한국 매체(einfomax). → **VIX·SOX·US10Y 미확보 해결**(dry-run 검증).
- **KR** (`kr-prompt.md`): 지수·거래대금 = Naver 모바일 API(`/index/{KOSPI|KOSDAQ}/basic` + `/integration`의 `대금`백만원), 보유 16종 = `/stock/{code}/basic`(영숫자 ETF·코스닥 코드 모두 작동), Top Movers = `/stocks/up|down`, KOSPI200·환율 = Yahoo(`^KS200`·`KRW=X`), 수급·업종 = 서버렌더 페이지(WebFetch). 전 엔드포인트 미국 IP 200·필드 확인.
  - **버그**: `/stock/{code}/integration`엔 현재가 필드 없음 → `/basic`으로 수정(실제 API 응답 확인).
- `market-report.yml`에 `dry_run` 입력 추가(테스트 시 발송·commit 스킵).

## 5. 마이그레이션 깨진 툴체인 복구
- `python3 -m pip install --user requests`, `npm i -g @google/clasp@2.4.2`(v3은 clasprc 형식 불일치), `clasp login`(사용자), `push_safe.py`를 clasp v2 `{"token":...,"oauth2ClientSettings":...}` 형식 대응.

## 검증 (직접 수행)
- 텔레그램 푸시 배선: `gh`로 워크플로 실행 → `{"success":true}` ✓
- US 리포트: dry-run 생성 → VIX/SOX/US10Y 등 전부 실수치, Send/Commit skipped ✓
- KR 엔드포인트: 프로브로 미국 IP 200·필드 전부 확인 ✓ (전체 리포트는 6/6 현충일이라 6/8 월 실작동에서 최종확인)

## 남은 것 (Claude 몫, 2026-06-08 월)
- 텔레그램 푸시 첫 자동 작동(`:05/:25/:45`만, 구 트리거 부재) + Actions 그린
- KR 리포트 실작동 — 수급·업종(서버렌더) WebFetch 추출 + 전체 채움

## 교훈 (메모리화)
- 내가 할 수 있는 건 내가 한다(`gh`·`curl`) — 떠넘기기 전 점검, 검증 후 핸드오프 ([[feedback_self_verify_before_handoff]])
- GAS 웹앱 POST는 `-X POST` 금지 (errors.md)
- 용어 "텔레그램 푸시"(워치 푸시 아님), 호칭 "주인님"
