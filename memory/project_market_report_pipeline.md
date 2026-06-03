---
name: project-market-report-pipeline
description: 시장 리포트 자동 발송 — GitHub Actions + Claude CLI + Telegram (2026-06-03 정착)
metadata: 
  node_type: memory
  type: project
  originSessionId: 204c496f-c665-47e6-be47-475cd82b1134
---

매 거래일 자동 발송되는 시장 리포트 시스템 (2026-06-03 정착, 운영 중).

**흐름**: GitHub Actions cron (KST 월~금 08:05 US / 17:05 KR) → `claude -p` CLI (Max OAuth) → 한국 매체·Stooq WebFetch + 분석 → `docs/reports/{US|KR}-YYYY-MM-DD.md` Write → Telegram Bot API 직접 발송 (두 chat_id) → git auto-commit

**구성**:
- `.github/workflows/market-report.yml` — cron 2개 + workflow_dispatch
- `.github/scripts/us-prompt.md`, `kr-prompt.md` — 분석 prompt
- `.github/scripts/send_telegram.py` — Markdown→plain fallback 발송
- `docs/reports/` — 영구 이력 (Market Report Bot author)

**secrets** (GitHub repo Settings → Actions secrets):
- `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`로 1년 발급, Max 구독 비용 0)
- `TG_BOT_TOKEN`, `TG_CHAT_IDS` (콤마 구분)

**Why**: routine 환경(Anthropic 샌드박스)이 GAS·Worker·Telegram API 모두 차단([[feedback-routine-sandbox-limits]]). 어떤 우회도 불가. GitHub Actions는 일반 인터넷 IP라 모든 API 호출 가능. Max OAuth로 비용 0. 5/28~6/2 routine·Worker proxy 시도 모두 실패 후 6/3 GitHub Actions로 전환 → 첫 cron 자동 실행 성공(`3216feb`).

**How to apply**:
- 시장 리포트 형식·내용 변경 시 → `.github/scripts/{us,kr}-prompt.md` 편집 후 commit. 다음 cron부터 자동 반영
- 발송 시각 변경 시 → workflow YAML의 cron 식 (UTC 기준)
- 일시 정지 → Actions 페이지 → workflow 우상단 ··· → Disable
- 즉시 1회 실행 → Actions → Run workflow (type us/kr/both)
- 보유 종목 변경 시 → prompt md의 "보유 종목" 섹션
- claude.ai routines 2개(US/KR)는 `enabled: false`로 disable — 중복 발송 방지. 재활성화 금지
- GAS 측 `_tgHandleMarketReportPost` / `tgFlushReportQueue`는 *수동 발송용*으로만 유지 (시트 메뉴 즉시 발송)
- 모니터링: `https://github.com/ejunwon-lab/FD5to6/actions` Market Report (US/KR) 워크플로우 결과
- 2026-06-15부터 Max 5x 구독자는 월 $100 Agent SDK credit 별도 풀로 카운트(현재 사용량 추정 $2~9/월, 한도 안)
