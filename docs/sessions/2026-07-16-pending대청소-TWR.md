# 2026-07-16 — pending 대청소 · TWR 입금왜곡 보정 · % 셀 버그 · 위생 묶음

## 1. pending 대청소 (증거 실측)

2026-05월 stale 항목 10건을 실측으로 닫음:
- 트리거 생존: 대시보드 "마지막 갱신 17:32 · 정상" + *현재가_이력* 당일 행 → 17:30/장중 :30 트리거·UrlFetchApp 권한 검증
- 주간 리포트 pre-fetch: run 29179140896 로그 `pre-fetch: HTTP=200 success=true dailyReturns=true` + WEEK-07-05·07-12 존재
- 리포트 private 분리 ①: FD5to6-reports 매 거래일 커밋 실측
- K/L/M 수식 안내: v28 KIS_SKIP 자가치유가 대체 / 데스크 UI 검증 4건: 후속 기능이 그 위에 쌓임(암묵 검증) / 삼성 카톡 포맷: 7/14 확보
- 부수: git-filter-repo가 지운 upstream 추적 복구(세션 시작 pull WARN 원인), GitHub GC 요청 🔴 격상

## 2. TWR 입금 왜곡 보정 (v29) — 설계 게이트 첫 실전 적용

- 사용자 결정: 옵션 ①+②. `/design-check` 노트 `docs/plans/2026-07-16-TWR-입금왜곡보정.md` (원장 소비자 7종 전수 조사 포함)
- 구현: `NS.FLOW_TYPES`(입금/출금) + `updatePositionFromLedger` 명시 skip + `_appendTradeRow` flow 분기(멱등: 날짜+구분+증권사+계좌+금액) + `getPortfolioMetrics` read-time 보정(`r_adj=(Q−F−V_prev)/V_prev`, 비거래일 롤포워드) + `suspect` 플래그(|dRate|≥3% & flow 없음) + weekly-prompt 해석 지침(private repo push)
- negative 테스트 3건 통과(bad_broker·amount_required·bad_type)

## 3. 🎁 % 셀 타입 비대칭 버그 발견·수정 (v30 읽기, v31 쓰기)

- TWR 실측 중 발견: `_trFmtPct` 부호 % 문자열을 Sheets가 **음수만 분수 numeric으로 auto-parse**(+ 접두는 텍스트) → 읽기에서 음수 날 100배 축소 → **d5 +8.04%가 실제 -4.45%** (6/28 주간 리포트 +4.9% 왜곡의 진범 — "6/23 대규모 입금"은 오진, 그날은 실제 시장 폭락일. 버그 재현 복리 = 정확히 +4.91%)
- v30: 읽기 `_mPctVal`(numeric→×100) — dailyReturns(S)·recentReturns(AC)·전일변동률(AF)
- v31: 쓰기 근본 수정 — `_trFmtPct` numeric 분수 반환 + `_trPctFormat` 서식. 설계 `docs/plans/2026-07-16-Trend-pct-numeric.md`. errors.md 기록

## 4. 신한만기 기록시차 소급 교정

- 시장/기록 요인 분해(Σ수량×가격변동 vs 투자중 diff 잔차)로 d20 창 22구간 전수 감사: 18구간 잔차 0(6/23·7/2 폭락도 순수 시장), 예외 4건 전부 설명(7/7 대기반영·7/9 보유현황 제거·7/14 ISA 동시반영 무왜곡·7/15 예금 자가치유 소액)
- 원장 flow 행 2건 소급(7/7 입금·7/9 출금, "내부이동 기록시차 보정" 메모) → 실측: 7/9 `-5.78→+2.06 flowAdj:true`(수기 검산 일치), d20 복리 검산 일치
- 운영 원칙: 내부 이동은 같은 날 양쪽 반영(7/14 ISA가 모범) or flow 행 기록

## 5. 위생 묶음 일괄 처리 (①~⑤)

- ① 드리프트: desk 로케일 en-US→ko-KR 전면, `position52w` desk 공용화+web AnalysisPage 인라인 대체. kst 라벨은 기수정 확인(TopBar Asia/Seoul)
- ② format.test.ts 시각 고정(vi.setSystemTime) 계산 케이스 — web 54통과
- ③ save.sh 트레일러 모델 무관화, deploy 2종 npm ci, **desk vitest 신설**(accountType 8케이스)+배포 테스트 step
- ④ code-map: emailKillSwitch_OFF 표기 분리, cloudflare-worker jsonResponse 등재 → check_stale 클린
- ⑤ Trend.js % numeric 전환(위 3절, v31)

## 남은 확인 (pending 등재)

- 내일 첫 updateAllNew 후: *보유현황* 정상(flow 행 포함 첫 재계산) + *추이 기록* % 셀 표시/타입 + POST dailyReturns
- 다음 음수 마감일: web/iOS 전일 수익 표시(AF 수정 클라 검증)
- 이번 일요일 주간 리포트 = TWR·파싱 수정의 첫 실전
