---
name: feedback-routine-sandbox-limits
description: claude.ai routines 환경은 outbound allowlist가 매우 좁아 자동화 인프라로 부적합. GitHub Actions가 정답
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 204c496f-c665-47e6-be47-475cd82b1134
---

claude.ai routines (scheduled remote agents)는 분석 작업엔 좋아 보이지만 *외부 API 자동 호출이 거의 불가능*. 시장 리포트 자동 발송처럼 *결과를 외부로 내보내야 하는 작업*엔 부적합. routine을 처음부터 후보로 고려하지 말 것.

**Why**: routine 환경(Anthropic 샌드박스)은 모든 HTTPS outbound가 TLS Inspection proxy(`O=Anthropic; CN=sandbox-egress-production`)를 거치고, 일부 host만 통과하는 allowlist 정책. 검증 결과 GAS·Cloudflare Worker·Telegram API·Yahoo Finance 모두 차단(`host_not_allowed`). 통과 확인: github.com clone, 한국 매체(인포맥스·한경·매경), Stooq. 어떤 코드 우회로도 해결 불가. 2026-05-28~6/2 시도 (errors.md 2026-05-31 참조).

**How to apply**:
- "Claude routine으로 자동 발송" 같은 요청이 오면 *Anthropic 샌드박스 외부 API 차단*을 먼저 명시하고 GitHub Actions를 1순위로 추천
- routine은 *내부 분석 결과를 사용자가 페이지에서 직접 보는* 용도로만 적합 (수동 작업)
- 자동화 표준은 **GitHub Actions + Claude Code CLI(Max OAuth)** 조합. `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` secret → `claude -p` headless. 비용 0 (Max 5x 월 $100 Agent SDK credit 한도 안)
- claude-code-action은 PR/issue 인터랙티브용. cron 자동화엔 *CLI 직접 호출*이 더 안정 (action은 내부 git 작업이 cron 환경과 충돌)
- 관련: [[project-market-report-pipeline]]
