# 2026-06-10 (밤) — 종합 검토 → daisy-chain 전환 + Phase 2 게이트 통과

## 검토 (코드·배포본·실행 로그·문서 교차 검증)

**통과 확인**: GAS v12 고정 배포 3개에 portfolioMetrics·dedup 마커 실재(Apps Script API로 직접 grep) · getPortfolioMetrics 컬럼 매핑(보유현황 헤더 대조) · 해외종목 KRW 환산 일관성 · MDD 좌표(Trend.js dStartRow=5, Q열) · dedup walk-through(~20분 카덴스).

**발견 문제 → 조치**:
| # | 문제 | 조치 |
|---|---|---|
| P1 | spread 수정 후에도 schedule 18틱 중 2틱만 발화 (6/10 오후 실측) — F 구조 전제 붕괴 | **daisy-chain 전환** (아래) |
| P2 | market-report cron 6/9·6/10 +1.5~3.8h 지연 (KR 리포트 20:50 KST 도착) | errors.md 기록, 체인 검증 후 정시화 후보 |
| P3 | kr-prompt 2-C "데이터 연동 전" stale 모순 | 1-F 수치 사용으로 수정 |
| P4 | _kr_pipeline.md "자동선별은 Phase 2" stale 규칙 | Phase 2 활성으로 수정 |
| P5 | pending.md가 Phase 2a를 "미구현"으로 기술 (실제 배포 완료) | 갱신 |
| P6 | getPortfolioMetrics가 code-map·api-reference 미등재 | 등재 + last updated 갱신 |
| P7 | Phase 2 dry_run 게이트 미판정 | run 27282075067 완료 → **통과** (아래) |

## Phase 2 게이트 — 통과

dry_run 27282075067: 1-F GAS fetch 성공(MDD -17.4%) · 익스포저 44% holdings 합산 · **원화 절대액 0건**(본문 66줄 전수, 환율·시장수급만) · 가드레일이 기존 환각 목표가 제거. 6/11(목) 17시대 첫 실 스케줄 런부터 파이프라인 누적 시작.

## daisy-chain 전환 (설계: plans/2026-06-10-텔레그램-daisy-chain.md)

- `telegram-push.yml`: 각 run 120분 루프 → 종료 직전 self-dispatch. `concurrency`로 증식 차단, cron은 재시드 백업. 정상상태 best-effort 의존 0회.
- GAS v13 (push_safe + API로 고정 배포 3개 갱신, 마커 검증): ① `tgPushPnL` result 에코(sent/skip-*) — 로그만으로 적중률 측정 ② `getPortfolioMetrics` 현금성 비중(분모=보유+대기, MDD와 일치).
- **스모크 통과 23:47**: 시드 → poke `result:"skip-offhours"` 정확 → dispatch 성공(시도 1) → 후속 run **actor=github-actions[bot]** 생성·가동. 체인 라이브.
- push_safe "Protected on remote: none"은 표시 버그(원격 파일명 `Secret.gs` vs PROTECTED `Secret`) — 동작은 머지 방식이라 안전(HEAD에 Secret.gs 보존 확인). 코드 미수정(Secret 관련은 사용자 영역).

## 내일(6/11 목) 확인

- **사용자**: Telegram 09:00~09:05 첫 푸시 + ~20분 간격.
- Claude: run 로그 result=sent 횟수(≈21~22회) + 체인 연속성 + KR 리포트 신형식·파이프라인 누적.
