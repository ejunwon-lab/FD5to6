# 2026-06-03 시장 리포트 자동화 — GitHub Actions로 최종 정착

## 배경

5/28~6/2 동안 claude.ai routines + Cloudflare Worker로 시장 리포트 자동 발송 인프라를 시도했으나, routine 환경(Anthropic 샌드박스)의 outbound allowlist가 너무 좁아 **모든 외부 우회 시도가 실패**. 6/3에 GitHub Actions로 완전 전환하여 자동화 정착.

## 진단 확정 (routine 환경 한계)

routine 환경에서 *실제로 시도하고 받은 응답*:

| Endpoint | 결과 |
|---|---|
| `script.google.com` (GAS doPost) | ❌ 403 Host not in allowlist |
| `*.workers.dev` (Cloudflare Worker) | ❌ 403 host_not_allowed (Cloudflare 진입 단계 차단) |
| `api.telegram.org` (Telegram Bot API) | ❌ 403 |
| `finance.yahoo.com` | ❌ 403 |
| `github.com` (git clone) | ✅ |
| 한국 매체 (인포맥스·한경·매경·머니투데이) | ✅ |
| Stooq.com | ✅ |

routine은 **TLS Inspection CA**(`O=Anthropic; CN=sandbox-egress-production TLS Inspection CA`)로 모든 outbound가 가로채지고, 일부 host만 통과. **어떤 코드 수정으로도 우회 불가** 확정.

→ routine 자체에서 외부에 결과를 내보내는 것은 git push 외에는 사실상 불가능. routine 분석 + GAS polling 같은 분업도 *git push 인증 PAT 필요* + *PAT 박은 prompt가 또 다른 위험*. 

## 채택 — GitHub Actions

`anthropics/claude-code-action`은 cron schedule을 공식 지원하고 Pro/Max 구독자는 `claude setup-token`으로 1년 OAuth token을 발급해 비용 0으로 활용 가능. 이 모든 사실을 공식 문서 3차 검증:

1. `code.claude.com/docs/en/authentication`: `claude setup-token`으로 발급, Pro/Max 지원, `CLAUDE_CODE_OAUTH_TOKEN` env로 인증
2. `code.claude.com/docs/en/headless`: `claude -p`에서 `--allowedTools` 로 WebFetch/Bash/Read/Write 사용 가능
3. `code.claude.com/docs/en/github-actions`: cron schedule + `prompt` input 예시 명시
4. Support article: Max 5x 월 $100 / Max 20x 월 $200 Agent SDK credit (2026-06-15부터). 우리 사용량 추정 $2~9/월 → 한도의 10% 이하

## 시행착오 4단계

이번 6/3 셋업 중 GitHub Actions 자체에서도 시행착오:

| 단계 | 실패 사유 | 해결 |
|---|---|---|
| 1. `claude-code-action@v1` 사용 | `Could not fetch an OIDC token` (`id-token: write` 권한 누락) | workflow `permissions:` 에 `id-token: write` 추가 |
| 2. 권한 추가 후 재실행 | `Claude Code is not installed on this repo` (GitHub App 미설치) | https://github.com/apps/claude 에서 FD5to6 repo에 App 설치 |
| 3. App 설치 후 재실행 | exit code 128 (9m 18s 동안 분석은 끝났으나 마지막 git 단계에서 fail. action의 내부 자동 git 작업이 cron 환경과 충돌 추정) | **action 자체를 폐기, Claude CLI 직접 호출로 전환** |
| 4. CLI 전환 (`0b4e658`) | ✅ 성공 | cron #4가 자동으로 6/3 KST 10:49에 US 리포트 commit (`3216feb`), 사용자 manual #5가 KR도 commit (`bc768c2`) |

## 최종 구성

```
.github/workflows/market-report.yml      cron 2개 + workflow_dispatch
.github/scripts/us-prompt.md             US 분석 prompt
.github/scripts/kr-prompt.md             KR 분석 prompt
.github/scripts/send_telegram.py         Telegram Bot API 발송 (Markdown→plain fallback)
docs/reports/{US|KR}-YYYY-MM-DD.md       리포트 영구 보존 (Market Report Bot author)
```

흐름:
1. cron 트리거 (KST 월~금 08:05 US / 17:05 KR)
2. `actions/checkout@v4` + `actions/setup-python@v5`
3. `curl https://claude.ai/install.sh | bash`로 Claude CLI 설치
4. `claude -p "$(cat prompt.md)" --allowedTools "WebFetch,Bash,Read,Write" --max-turns 25 --model claude-sonnet-4-6` 실행
5. Claude가 한국 매체·Stooq fetch + 분석 + `docs/reports/...md` Write
6. `send_telegram.py`가 두 chat_id에 sendMessage (Markdown 실패 시 plain fallback)
7. `git commit -m "{US|KR} report YYYY-MM-DD [skip ci]" && git push`

인증: `CLAUDE_CODE_OAUTH_TOKEN` (Max 구독, 비용 0). secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `TG_BOT_TOKEN`, `TG_CHAT_IDS`.

## 검증 결과

- Run #4 (cron, 2026-06-03 01:44Z = KST 10:44): ✅ SUCCESS, US-2026-06-03.md commit, Telegram 두 분 도착
- Run #5 (manual, both): ✅ SUCCESS (6m 4s), KR-2026-06-03.md commit, Telegram 두 분 도착
- 리포트 형식: M7 + Top Movers + 보유 포트 의견(유지/관망/비중확대/비중축소) + 약자 한국어 풀어쓰기 모두 정상
- US 리포트의 분석 품질 예: "MRVL +32.47%, HPE +19.47% AI 하드웨어 폭등", "MSFT·GOOGL 유상증자·소프트웨어 우려로 -4% 하락", "AVGO 비중확대 — ASIC·이더넷 스위칭 독점력 부각"

## 정리

- claude.ai routines 2개 (`trig_01ScfNHCSDXQ12eACkixYt2H` US, `trig_0174SG5s9pSCG5D5GPMTN9Me` KR) → `enabled: false` 설정 완료. 중복 발송 방지
- Cloudflare Worker는 *워치→Telegram→GAS webhook* 흐름용으로 그대로 유지 (한국 IP 경로, 정상 동작)
- GAS의 `_tgHandleMarketReportPost`, `tgFlushReportQueue`, `tgSetupReportQueueTrigger` 등 시장 리포트 큐 함수는 *수동 발송용*으로 유지 (사용자 시트 메뉴 클릭)
- Telegram Bot API 직접 호출만 활성 운영 인프라

## 다음 운영

- **6/4 (수) KST 08:05**부터 매 거래일 자동 발송 시작
- 사용자 작업 0
- 비용 0 (Max OAuth, GitHub Actions 무료 한도)
- 운영 위치:
  - 실행 결과: `https://github.com/ejunwon-lab/FD5to6/actions`
  - 리포트 이력: `docs/reports/` (날짜별 파일)
  - prompt 수정: `.github/scripts/{us,kr}-prompt.md`
  - 발송 시각 변경: `.github/workflows/market-report.yml` 의 `cron`

## 주요 commits

- `c35cd8b` GitHub Actions 인프라 초기 구축
- `7f392ab` id-token: write 추가
- `0b4e658` action → CLI 직접 호출 전환 (진짜 fix)
- `3216feb` 첫 자동 cron 성공 — US-2026-06-03.md
- `bc768c2` 첫 manual 검증 KR — KR-2026-06-03.md
