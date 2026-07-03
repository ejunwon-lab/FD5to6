---
name: reference-webfetch-vs-curl-headless
description: 헤드리스 Claude CLI의 WebFetch는 Naver 등 robots-disallow 도메인에서 차단됨 — GH Actions 리포트는 Bash curl로 fetch (2026-07-03 확정)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6ade5fc8-882b-4614-ba01-41392846c241
---

GH Actions 헤드리스 Claude CLI에서 "사이트 차단" 보고가 오면 **층위를 갈라 진단**: 서비스 차단 ≠ 러너 IP 차단 ≠ WebFetch 도구 차단.

- 2026-07-03 실측: KR 리포트 "Naver 차단 14일차"의 실체는 **WebFetch 도구 계층 차단**(robots.txt/봇 정책 추정). 같은 러너에서 **Bash curl은 Naver 전부 200**.
- 진단 도구: `.github/workflows/diag-egress.yml` (dispatch 전용, 소스별 HTTP+본문 head 실측) — 재사용할 것.
- 처방: market-report 프롬프트들은 Naver·뉴스·Yahoo를 **Bash curl**(브라우저 UA, `finance.naver.com`은 `iconv -f euc-kr`, Yahoo 429 시 sleep 재시도)로 fetch. 죽은 URL: 한경 `/finance`(404), 인포맥스 articleList(빈 응답 — RSS `rss/allArticle.xml` 사용).
- 헤드리스 에이전트에 "env 있으면 호출해라" 판단 맡기지 말 것 — 6/28 주간 리포트가 env 주입돼 있는데 "미설정" 오판. 결정적 fetch는 **워크플로 pre-fetch step → 파일 → 에이전트 Read** 구조로 ([[project-market-report-pipeline]] 참조).

**Why**: 에이전트의 "차단" 보고를 IP 문제로 오진하면 GAS/KIS 프록시 대공사로 빠짐 — 실제론 프롬프트 한 줄(curl 전환)이 정답이었다.
**How to apply**: 리포트 파이프라인에서 fetch 실패 이슈가 오면 ① diag-egress dispatch ② curl 뚫리면 프롬프트를 curl로 ③ curl도 막히면 그때만 프록시/공식 API 검토.
