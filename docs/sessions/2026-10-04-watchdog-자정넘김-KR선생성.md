# 2026-10-04 — watchdog 실패 메일 → cron 자정 넘김 수리

## 계기
사용자가 Gmail에 매일 쌓이는 `Run failed: Watchdog (automation healthcheck)` 메일을 제보.

## 진단 (실측)
- watchdog schedule run의 실제 실행 시각을 KST로 변환 → 8/28부터 00:06~05:05(익일). success는 토요일 새벽 실행분뿐.
- 로그: 평일 "푸시 0건·시트 stale·US 없음", 일요일 "WEEK 없음" — 전부 "막 시작된 날"을 검사한 오탐.
- 부수 발견(실결함): 10/1 새벽 로그의 "✅ KR 리포트 커밋됨"이 단서 → KR 백업 cron이 자정 넘어 전일 데이터로 다음 날짜 파일 생성 → 당일 17:0x 정규 실행 skip. 리포트 repo 커밋 시각 전수 대조로 9건 확정.
- 정상 확인: 푸시 체인, US 리포트(매 거래일 08시대), market-report 최근 run 전부 success.

## 완료
- `/design-check` 통과 후 구현·배포(dd4db85): 리포트 창 가드, watchdog 대상일·dedup·커밋 시각 검사, 체인 dispatch.
- 자동 검증: 창 판정 16케이스, `--print-target` 3건, 로컬 과거일 재현(10/1 🔴·9/28 ✅·10/4 ✅), 러너 dry_run 2건.
- 문서: 설계노트·errors.md(2026-10-04)·code-map·pending.

## 결정
- 원 설계의 "daisy-chain 무수정" 원칙 완화 — market-report dispatch로 검증된 동일 패턴, `|| true` 격리 안.
- 10/2(금) 마감 KR 리포트 수동 재생성은 보류(사용자 미요청 — 파일 날짜가 실행일로 찍히고 텔레그램 발송됨).

## 잔여
pending.md "watchdog 정시화 + 리포트 창 가드" 항목 참조 (세션 내 예약 점검 3회: 10/4 21:33·10/5 21:37·10/6 08:13 — 세션 종료 시 소멸).
