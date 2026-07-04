# Changelog

## 2026-06-21
- 주간 리포트(일요일 13:00 KST) 신규 — 지난주 리캡(시장+포트 균형) + 새주 계획, 텔레그램+이메일. 평일 daisy-chain 패턴 복제(일요일 cron 2개 + 체인 13:0x 창 + reseed cron) + WEEK 파일 멱등.
- weekly-prompt.md — 상세 기여도 분석(일자별 5거래일 + 종목별 주간%×비중→포트기여%, 견인/잠식/보합), 모든 퍼센트 % 명시·pp 금지, 원화 절대액 금지.
- GAS v23 — portfolioMetrics에 dailyReturns(일별 총자산변화율%) 추가 → 주간 일자별이 d5와 정합.
- GAS v24 — series·recentReturns에 _isTradingDateStr 필터 → 비거래일 행 제외, d5/d20 거래일 창 정합(일일 KR 리포트 d5 잠재버그도 교정). errors.md 2026-06-21.
- dry_run 게이트 3회 통과(run 27898684208): 주간 +7.29% = 일자별 합 = d5 = 벤치 동일창.
- docs: 설계노트, 세션문서, code-map·api-reference(dailyReturns 스키마) 갱신.

## 2026-07-03
- Naver 차단 14일 해소 — 실체는 WebFetch 도구 계층 차단(러너 curl은 200, diag-egress.yml 실측). kr-prompt Naver·뉴스 Bash curl 전환 + 죽은 URL 교체. dry_run 게이트 통과(거래대금 45.5조·업종·수급 복원).
- 주간 리포트 GAS pre-fetch step — 6/28 "환경변수 미설정" 오판 클래스 제거. dry_run 통과(HTTP=200, 일자별 실값).
- us-prompt 인포맥스 RSS 교체 + WebFetch 실패 시 curl 폴백.
- 무음 실패 알림 — market-report 3 job 생성 실패 텔레그램 경고+빨간 run, telegram-push 체인 사망 알림.
- 데스크 표시규칙 위반 3건 수정(M/k 축약 제거, Winners/Losers 종목명 메인) + shortKRW 제거, Pages 배포.
- 전반 점검(에이전트 3 + 로컬) — web 34/34·tsc 클린 확인, GAS 죽은 코드·환율 fallback 불일치·웹 드리프트 등 발견 목록화.
- /design-check 첫 적용 — 진단이 가설(IP 차단)을 뒤집어 GAS/KIS 대공사 회피. errors.md 2건, memory 1건(WebFetch vs curl).

## 2026-07-04
- 텔레그램 푸시 "오늘 +0원" 원인 확정(KIS 전면 실패 시 carry-forward 무단서) — v25: 푸시에 ⚠️ 미갱신 단서 라인.
- web-desk 모바일 11건(카드 종목명 잘림 해소 등) + 오늘 TOP 상승/하락 2칸 + kst 시계 Asia/Seoul 고정.
- 시트 백업 로컬 자동화 — GAS backupData(v26)+backup_sheets.py(재시도)+launchd 주1회+설치 스크립트. backups/ gitignore.
- 리포트 private repo 분리(FD5to6-reports) — 워크플로 docs/reports 경로 checkout(deploy key), 프롬프트 3종+kr-theses도 _config/ 이전. dry_run 2회 통과.
- 히스토리 재작성(filter-repo) — 리포트·프롬프트·논리 전 히스토리 purge, force push, fresh clone 검증 0건. run.sh 자기복구(다른 맥 폴더 삭제 불필요).
- desk 배포 2회·GAS 배포 2회(v25·v26) 전부 검증 통과.
