# 설계 노트 — Trend.js % 셀 쓰기 근본 수정 (문자열 → numeric 분수 + 숫자서식)

2026-07-16. `/design-check` 산출물. 오전에 잡은 % 셀 타입 비대칭 버그(errors.md 2026-07-16)의 **발생원 차단**. 매일 트리거 경로(`updateAllNew` → `logToTrendSheet`) = G-2 위험 변경.

## 설계 요지

`_trFmtPct(n)`이 `'+5.04%'` 문자열 대신 **numeric 분수(n/100)** 를 반환하고, 쓴 range의 % 셀에 `setNumberFormat('+0.00%;-0.00%;+0.00%')` 적용 → 화면 표시는 기존과 동일(`+5.04%`/`-7.08%`/`+0.00%`), 저장 타입은 항상 numeric으로 통일.

- `_trFmtNum`(콤마 문자열)은 **불변** — 콤마 숫자 문자열은 부호 무관 대칭으로 auto-parse되어 버그 클래스가 아님. 최소 diff 원칙.
- 과거 행은 혼합 그대로 → 읽기 `_mPctVal`은 계속 유지 (numeric×100 / 텍스트 parseFloat 양쪽 처리).

## % 셀 전수 지도 (쓰기 지점)

| 섹션 | 행 쓰기 | % 오프셋 → 열 | 미러 |
|---|---|---|---|
| (A) 업데이트별 | `updStartCol=2`(B), 11칸 | +4·+7·+10 → **F·I·L** | `B2:L2` |
| (B) 일별 | `dStartCol=14`(N), 6칸 | +5 → **S** | `N2:S2` |
| (C) 수익 | `pStartCol=21`(U), 12칸 | +4·+8·+11 → **Y·AC·AF** | `U2:AF2` |
| (C) AH/AI 캐시 | `(2, pStartCol+13, 1, 2)` | 2번째 → **AI2** | — |

## 1. 외부 동작 가정 + 근거

- setValues에 number를 주면 auto-parse 없이 numeric 그대로 저장, setNumberFormat은 표시만 바꿈 → **[사실]** Sheets 기본 동작 + 기존 코드가 원장에 `#,##0` 동일 패턴 사용(NewSystem.js:424).
- 숫자서식 `'+0.00%;-0.00%;+0.00%'`은 양수/음수/0에 각각 `+5.04%`/`-7.08%`/`+0.00%` 표시 = 기존 문자열 표기와 동일 → **[사실 — 배포 후 시트 화면으로 재확인]**.
- % 셀의 프로그램 소비자는 전부 `_mPctVal`/typeof 분기(v30) → numeric 호환: dailyReturns(S)·recentReturns(AC)·`_mFindPrevDayProfitChange`(AF) → **[사실]** v30에서 이 목적으로 이미 전환.
- `newMobileGetProfitHistory`는 U(날짜)+AD(금액 idx 9)만 사용, % 안 읽음 → **[사실]** grep: `entries.push({date, totalProfit: toN(row[9])})`.
- AH/AI 캐시(% = AI2)는 현재 프로그램 소비자 없음(AJ/AK 백업 제거 때 U열 직접 검색으로 대체) → **[사실]** MobileAPI·Telegram·Dashboard·NewSystem grep 0건. 표시용 서식만 적용.
- `_trFmtPct` 호출처는 Trend.js 11곳뿐(타 파일 0) → **[사실]** grep.
- 읽기(v30) 먼저 → 쓰기(이번) 나중 순서라 **무중단 마이그레이션**: 어느 시점 배포돼도 양쪽 타입 모두 소화.

## 2. 과거 부류 (errors.md)

- **2026-07-16 % 셀 비대칭** — 이번 변경이 그 근본 수정. 함정 회피: 읽기 파서를 먼저 배포(v30)해 두고 쓰기를 바꿈.
- **2026-06-10 tgPushPnL 부분갱신 stale** — 갱신 순서·호출 경로는 불변(값 타입만 변경). 부분갱신 경로는 logToTrendSheet 자체를 안 부름.
- **비거래일 행 계열** — 행 배치(upsert·날짜 탐색) 로직 무수정.

## 3. 추론 가능 vs 실환경 전용

- 머리로 거름: 타입 호환(위 소비자 전수), 표시 형식 동등성, 호출처 완결성, F=문자→숫자 전환의 walk-through.
- 실환경에서만: ⓐ 다음 `logToTrendSheet` 실행 후 실제 셀 타입·표시 ⓑ 그 뒤 POST dailyReturns 값 정상 여부 → 다음 자동 트리거(내일 09:30) 또는 사용자 ⚡ 후 **백업 덤프 + POST 실측**으로만 판정.

## 4. 검증 방법

- 자동(지금): `push_safe.py` node --check. walk-through:
  - dRate=-7.08 → `_trFmtPct` → **-0.0708 (number)** → S열 numeric, 서식 표시 `-7.08%` → 이후 `_mPctVal(-0.0708)`=×100=**-7.08** ✓ (기존: 문자열 '-7.08%' → auto-parse 운, 읽기는 동일 -7.08 — 값 불변, 타입만 통일)
  - dRate=+5.04 → **0.0504 (number)** → 표시 `+5.04%`, 읽기 +5.04 ✓ (기존: 텍스트 '+5.04%' — 값 불변)
  - 0 → 0 (number) → 표시 `+0.00%` = 기존 '+0.00%' ✓
- 자동(다음 쓰기 후): `backup_sheets.py` 덤프 → *추이 기록* 오늘 행 S·Y·AC·AF가 **전부 numeric 분수**(±무관) + POST `portfolioMetrics` dailyReturns 오늘 값이 시트 표시와 일치.
- 사용자: 내일 아침 시트 *추이 기록* 상단 2행·오늘 행의 % 셀들이 평소처럼 `+X.XX%` 표시인지 (깨진 소수 표시 `0.0504` 보이면 서식 누락 보고).

→ **게이트: 통과** — 소비자 전수 확인, 읽기-먼저 순서로 무중단, 실환경 검증 2단계 예약. 코딩 시작.
