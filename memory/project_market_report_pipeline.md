---
name: project-market-report-pipeline
description: 시장 리포트 자동 발송 — GitHub Actions + Claude CLI + Telegram (2026-06-03 정착)
metadata: 
  node_type: memory
  type: project
  originSessionId: 204c496f-c665-47e6-be47-475cd82b1134
---

매 거래일 자동 발송되는 시장 리포트 시스템 (2026-06-03 정착, 운영 중).

**원칙 (2026-06-06 확장)**: *GitHub Actions = 유일한 신뢰 시계, GAS = 요청 구동 워커*. GAS 시간 트리거는 best-effort라 수시간 누락됨([[feedback_telegram_push_naming]] 관련 errors.md 2026-06-05) → 텔레그램 발송 스케줄을 전부 GH Actions로 통일.

**흐름 (시장 리포트)**: GitHub Actions cron (US KST 08:02·08:42 / KR 17:02·17:42, 40분 간격 2회) → `claude -p` CLI (Max OAuth) → 한국 매체·Stooq WebFetch + 분석 → `docs/reports/{US|KR}-YYYY-MM-DD.md` Write → Telegram Bot API 직접 발송 (두 chat_id) → git auto-commit. **2회 시도 + 중복방지**(체크아웃 시 오늘 파일 있으면 guard로 skip)로 "창 안 반드시 도착" 보장. GH cron 한 틱 누락돼도 커버.

**흐름 (장중 텔레그램 푸시 = "워치 푸시" 아님)**: `telegram-push.yml` cron(KST 월~금 09:05~15:45 매시 :05/:25/:45) → GAS 웹앱 `action=pushPnL` POST(secret=`TG_WEBHOOK_SECRET`) → `_tgHandlePushPost`→`tgPushPnL`(거래일·시간·락 자체 게이트 + KIS 갱신 + 발송). **GAS `tgPushPnL` 시간 트리거 3개는 폐기**. 신규 secrets: `GAS_WEB_APP_URL`, `TG_WEBHOOK_SECRET`. 휴장/장외엔 tgPushPnL이 내부 skip(GH에 휴장 로직 중복 X).

**구성** (2026-07-04 private 분리 반영):
- `.github/workflows/market-report.yml` — cron + workflow_dispatch + 생성실패 텔레그램 경고
- **프롬프트 3종(us·kr·weekly)+`kr-theses.md` = private repo `FD5to6-reports`의 `_config/`** — 로컬 `docs/reports/_config/*.md` 편집 후 `git -C docs/reports push`. main repo엔 없음(보유 종목·논리 비공개화, 히스토리도 filter-repo로 purge됨)
- `.github/scripts/send_telegram.py` — Markdown→plain fallback 발송 (비민감, main 유지)
- `docs/reports/` — 영구 이력 = **private repo `ejunwon-lab/FD5to6-reports` clone**. 워크플로가 deploy key(`REPORTS_DEPLOY_KEY`)로 checkout·커밋. 로컬은 run.sh가 pull

**secrets** (GitHub repo Settings → Actions secrets):
- `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`로 1년 발급, Max 구독 비용 0)
- `TG_BOT_TOKEN`, `TG_CHAT_IDS` (콤마 구분)

**Why**: routine 환경(Anthropic 샌드박스)이 GAS·Worker·Telegram API 모두 차단([[feedback-routine-sandbox-limits]]). 어떤 우회도 불가. GitHub Actions는 일반 인터넷 IP라 모든 API 호출 가능. Max OAuth로 비용 0. 5/28~6/2 routine·Worker proxy 시도 모두 실패 후 6/3 GitHub Actions로 전환 → 첫 cron 자동 실행 성공(`3216feb`).

**How to apply**:
- 시장 리포트 형식·내용 변경 시 → `docs/reports/_config/{us,kr,weekly}-prompt.md` 편집 후 `git -C docs/reports push` (private repo). 다음 cron부터 자동 반영
- 발송 시각 변경 시 → workflow YAML의 cron 식 (UTC 기준)
- 일시 정지 → Actions 페이지 → workflow 우상단 ··· → Disable
- 즉시 1회 실행 → Actions → Run workflow (type us/kr/both)
- 보유 종목 변경 시 → prompt md의 "보유 종목" 섹션
- claude.ai routines 2개(US/KR)는 `enabled: false`로 disable — 중복 발송 방지. 재활성화 금지
- GAS 측 `_tgHandleMarketReportPost` / `tgFlushReportQueue`는 *수동 발송용*으로만 유지 (시트 메뉴 즉시 발송)
- 모니터링: `https://github.com/ejunwon-lab/FD5to6/actions` Market Report (US/KR) 워크플로우 결과
- 2026-06-15부터 Max 5x 구독자는 월 $100 Agent SDK credit 별도 풀로 카운트(현재 사용량 추정 $2~9/월, 한도 안)
