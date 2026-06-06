# 시장 리포트 자동 발송 — GitHub Actions 가이드

last updated: 2026-06-06

매 거래일 KST 08:05(US)·17:05(KR)에 **GitHub Actions cron**이 Claude Code CLI(headless)를 실행해 시장을 분석하고, 리포트 파일을 만들어 **Telegram Bot API로 직접 발송**한다. claude.ai routine 방식은 폐기됐다 (맨 아래 "폐기된 접근" 참조).

```
[GitHub Actions cron]  .github/workflows/market-report.yml
   ↓ claude -p "$(cat .github/scripts/{us,kr}-prompt.md)"  (headless, Max OAuth 인증)
   ↓   --allowedTools WebFetch,Bash,Read,Write  --max-turns 25  --model claude-sonnet-4-6
   ↓ Claude가 웹 데이터 수집·분석 → docs/reports/{US|KR}-YYYY-MM-DD.md (KST 날짜) Write
   ↓
[파일 존재 확인]  docs/reports/{TYPE}-{KST날짜}.md 있으면 다음, 없으면(휴장/실패) 발송·커밋 스킵
   ↓
[Telegram 발송]  python3 .github/scripts/send_telegram.py <리포트파일>
   ↓   TG_CHAT_IDS의 각 chat_id에 sendMessage (Markdown → 400이면 plain text fallback)
   ↓
[git commit]  docs/reports/ 커밋·push ("US/KR report YYYY-MM-DD [skip ci]")
```

비용 0 (Anthropic Max OAuth). GAS·Cloudflare Worker·시트 큐를 경유하지 않는다.

---

## 구성 파일

| 파일 | 역할 |
|---|---|
| `.github/workflows/market-report.yml` | cron 스케줄 + 2개 job(us/kr) 정의. CLI 실행 → 파일 확인 → 발송 → commit |
| `.github/scripts/us-prompt.md` | US 리포트 프롬프트 (보유 종목·데이터 소스·형식·휴장 처리) |
| `.github/scripts/kr-prompt.md` | KR 리포트 프롬프트 (동일) |
| `.github/scripts/send_telegram.py` | 리포트 파일 → 두 chat_id에 발송. Markdown 실패 시 plain fallback |
| `docs/reports/{US\|KR}-YYYY-MM-DD.md` | 발송된 리포트 본문 (이력 영구 보존) |

## 스케줄 (cron, UTC 기준 — workflow의 `if`로 job 분기)

"반드시 창 안 도착"을 위해 각 리포트를 **40분 간격 2회** 예약. 1차 성공 시 `docs/reports/{TYPE}-{날짜}.md`를 commit → 2차는 체크아웃에서 그 파일을 보고 **guard로 skip**(중복 발송 방지). GH cron이 한 틱 누락돼도 도착.

| 리포트 | cron | KST | 비고 |
|---|---|---|---|
| US 1차 | `2 23 * * 0-4` | 월~금 08:02 | 전날 미국 마감 (일~목 UTC = 월~금 KST) |
| US 2차 | `42 23 * * 0-4` | 월~금 08:42 | 1차 누락 시 백업 |
| KR 1차 | `2 8 * * 1-5` | 월~금 17:02 | 당일 한국 마감 |
| KR 2차 | `42 8 * * 1-5` | 월~금 17:42 | 1차 누락 시 백업 |

> 첫 단계 `Skip if already sent today` guard는 **schedule 이벤트에만** 적용. `workflow_dispatch`(수동)는 guard 무시 → 항상 재생성·재발송.

수동 실행: GitHub **Actions → Market Report (US/KR) → Run workflow** → `type` 선택 (`us`/`kr`/`both`).

> **장중 텔레그램 손익 푸시**(별개 기능)도 같은 패턴으로 GitHub Actions가 구동한다 — `telegram-push.yml`이 20분마다 GAS 웹앱 `action=pushPnL`을 호출. GAS 시간 트리거 best-effort 누락(errors.md 2026-06-05) 회피. 상세는 `features.md` Telegram 봇 섹션 + `code-map.md`.

## GitHub Secrets (repo Settings → Secrets and variables → Actions)

| Secret | 내용 |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token`으로 발급한 Max OAuth 토큰 |
| `TG_BOT_TOKEN` | 텔레그램 봇 토큰 |
| `TG_CHAT_IDS` | 발송 대상 chat_id, 콤마 구분 (예: `123,456`) |

> SECRET·토큰은 GitHub Secrets에만. 코드·문서·프롬프트엔 절대 커밋하지 않는다.

---

## 리포트 형식·내용을 바꾸려면

**`.github/scripts/{us,kr}-prompt.md` 두 파일만 편집 후 commit.** 워크플로·발송 스크립트 변경 불필요.

각 프롬프트의 구조 (Step 1 데이터 수집 → Step 2 작성 → Step 3 휴장 → Step 4 파일 저장 → Step 5 stdout 보고):

**공통 설계 원칙**
- **수량·평가액 X** — 보유분 실손익은 장중 `tgPushPnL`(매시 :00/:20/:40 텔레그램 푸시)이 시트 기반 정확값으로 보냄. 리포트는 *시장 해석*만 담당
- **보유 종목 회사 뉴스는 조건부** — ±2% 이상 움직인 종목만 회사 단위 검색. 평온하면 "특이 이슈 없음"
- **Telegram MarkdownV1** — `*굵게*` `_이탤릭_`만. 데이터 표는 ``` 코드블록(monospace 정렬). 약자는 한국어 괄호로 풀어쓰기 (XLK→테크, VIX→변동성, DXY→달러인덱스, SOX→필라델피아 반도체)
- 발송은 프롬프트에서 하지 않음 — Claude는 파일 저장까지만, 발송은 다음 workflow step

**US** (`us-prompt.md`) — 보유: AVGO(브로드컴). 데이터는 한국 경제매체 '뉴욕증시 마감' 종합기사 우선(연합인포맥스·한경·매경·머니투데이), 백업 Stooq.com. 섹션: 지수 7종(S&P500·NDX·Dow·SOX·VIX·DXY·US10Y) → 섹터 강세3/약세3 → M7 → Top Movers → 시장 이슈 → 종합 코멘트 → 보유 포트 의견(유지/관망/비중확대/비중축소).

**KR** (`kr-prompt.md`) — 보유: 국내주식 5종(삼성전자·SK하이닉스·삼성전기·실리콘투·알테오젠) + ETF 11종. 데이터는 네이버 금융 위주. 섹션: 지수·환율 → 수급(외인/기관/개인 억원) → 업종 강세3/약세3 → Top Movers → 보유 국내주식 5종 → 보유 ETF 그룹별 → 시장 이슈 → 보유 종목 이슈 → 종합 코멘트 → 보유 포트 의견. ETF용 영숫자 코드(0047A0·0163Y0)는 네이버 `item/main.naver?code=` 사용.

> 보유 종목이 바뀌면 해당 프롬프트의 "보유 종목" 리스트도 같은 커밋에서 갱신.

---

## 운영·디버깅

### 정상 동작 확인
- 매 거래일 KST 08:05 / 17:05 직후 텔레그램에 리포트 도착 여부
- GitHub **Actions** 탭에서 해당 run의 job 로그 — `Generate report` → `found=yes` → `Send to Telegram` → `result: sent=N/N`
- `docs/reports/`에 그날 파일이 commit됐는지 (Market Report Bot author)

### 동작 안 할 때 순서
1. **Actions 탭에서 run이 트리거됐나** — cron이 안 돌면 GitHub 측 지연(분 단위 가능) 또는 워크플로 비활성(60일 무커밋 시 자동 disable)
2. **`Generate report` step 로그** — Claude CLI가 토큰 인증 됐나(`CLAUDE_CODE_OAUTH_TOKEN`), max-turns 안에 끝났나
3. **`Determine report file path` step** — `found=no`면 파일 미생성 = 휴장 또는 분석 실패. 같은 step의 `ls docs/reports/`로 확인
4. **`Send to Telegram` step** — `sent=0`이면 `send_telegram.py` 로그의 HTTP 코드 확인. 400=Markdown parse 실패(자동 plain fallback 시도), 401/403=토큰·chat_id 문제
5. **수동 재발송** — Actions → Run workflow → 해당 type 선택

### 휴장일
- 미국 휴장: 한국 매체가 "뉴욕증시 휴장" 언급 → 짧은 1줄 리포트 파일 저장 후 발송
- 한국 휴장: 파일 저장 안 함(stdout "휴장" 한 줄) → workflow가 `found=no`로 발송·커밋 스킵

### 비용·한도
- Claude: Max OAuth, headless 호출 비용 0. 하루 2회
- 텔레그램 봇: 분당 30 msg 제한, 2회/일 → 무관

### 변경 시 갱신할 곳
- 리포트 형식/섹션/보유 종목 → `.github/scripts/{us,kr}-prompt.md` (이것만)
- 스케줄 → `market-report.yml`의 cron 2개 + job `if` 조건
- 발송 로직(fallback·헤더) → `send_telegram.py`

---

## (참고) 폐기된 접근 — claude.ai routine → GAS 큐 → Telegram

2026-05-28에 처음 만든 구조: claude.ai routine이 08:00·17:00에 분석 후 GAS Web App에 POST → *시장리포트_큐* 시트 적재 → GAS 트리거(08:05·17:05)가 큐를 읽어 Telegram 발송.

**폐기 사유** (errors.md 2026-05-29·05-31): routine 실행 환경의 outbound allowlist 격리(Anthropic 샌드박스 TLS Inspection IP)로 `script.google.com`(GAS)·Cloudflare Worker·Telegram API가 모두 차단됨. Worker proxy 가설도 anti-abuse 차단으로 폐기. → 2026-06-03 GitHub Actions로 최종 전환.

**잔존물 (의도적 유지)**:
- claude.ai routine 2개는 `enabled: false`로 disable
- GAS *시장리포트_큐* 시트 + `_tgHandleMarketReportPost` doPost + `tgFlushReportQueue` + 메뉴 `📤 큐 즉시 발송`은 **사용자 수동 발송/재발송용**으로 유지 (한국 IP 경로라 정상 동작). 자동 cron은 GitHub Actions가 담당.
- Cloudflare Worker는 *Telegram → GAS webhook*(워치 손익 알림 `tgPushPnL`)용으로 그대로 유지
