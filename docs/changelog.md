# Changelog

## 2026-06-21
- 주간 리포트(일요일 13:00 KST) 신규 — 지난주 리캡(시장+포트 균형) + 새주 계획, 텔레그램+이메일. 평일 daisy-chain 패턴 복제(일요일 cron 2개 + 체인 13:0x 창 + reseed cron) + WEEK 파일 멱등.
- weekly-prompt.md — 상세 기여도 분석(일자별 5거래일 + 종목별 주간%×비중→포트기여%, 견인/잠식/보합), 모든 퍼센트 % 명시·pp 금지, 원화 절대액 금지.
- GAS v23 — portfolioMetrics에 dailyReturns(일별 총자산변화율%) 추가 → 주간 일자별이 d5와 정합.
- GAS v24 — series·recentReturns에 _isTradingDateStr 필터 → 비거래일 행 제외, d5/d20 거래일 창 정합(일일 KR 리포트 d5 잠재버그도 교정). errors.md 2026-06-21.
- dry_run 게이트 3회 통과(run 27898684208): 주간 +7.29% = 일자별 합 = d5 = 벤치 동일창.
- docs: 설계노트, 세션문서, code-map·api-reference(dailyReturns 스키마) 갱신.
