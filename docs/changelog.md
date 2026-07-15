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

## 2026-07-09
- 신한정기예금(미래/퇴직IRP) 만기 정산 — 원장 매도 1행(단가 [금액]) → 실현손익 +[금액](+9.91%) 확정, 보유현황서 예금 제거. 사용자 수기입력 후 ⚡로 재계산, 라이브 덤프 검증.
- 대시보드 보유 종목 표에 종목명 반복 열(14열, 당일 등락률↔당일 손익 사이) 추가 — 20→21열. DB.COLS·컬럼너비·헤더·데이터행·합계행·색상/정렬/서식 인덱스·요약카드 span 일괄 시프트(Dashboard.js). node --check + 21열 정합 시뮬 통과, push_safe 배포, ⚡ 후 라이브 21열 렌더 확인(종목명 반복 일치, 뒤 컬럼 오염 없음).
- GAS 대시보드 요약 아래 "자산 배분"(투자중/대기중/총자산 + 노는돈%) + "계좌 유형별"(일반 투자/퇴직연금, 증권사별) 나란히 신설. 계좌 유형별은 대기중 포함=총자산 기준. 부분폭 제목 헬퍼(_dbSectionTitleSpan) 추가, _mGetCashReserve 재사용. 실데이터 검증(합계 [금액] = 자산배분 총자산 일치).
- 월별 확정수익 "월" 표기 버그 수정 — 실현손익 날짜 셀이 시트에서 Date로 반환돼 `String(Date).slice(0,7)`='Fri Feb'가 되던 것을 `_dbYmd`로 yyyy-MM 포맷(연도별 분리 + 시간순 정렬). Top/Bottom5 매도일도 yyyy-MM-dd. errors.md 기록.
- 자산 배분·계좌 유형별을 web(DashboardPage 카드 2개)·web-desk(HoldingsPage AccountTypePanel)에도 반영. GAS 변경 없이 API 기존 필드(cashReserve/nonStockAssets/holdings) 클라 계산(assetAllocation.ts / accountType.ts 순수함수 + vitest 9케이스 실수치 검증). web types.ts에 cashReserve/nonStockAssets 타입 추가. 양쪽 tsc 클린·빌드 통과. push 시 GH Pages 자동 배포.

## 2026-07-10
- web·desk 자산배분·계좌유형별 **라이브 배포 완료** — 7/9 push 후 GitHub Actions 광역 장애로 Pages 발행 빌드가 실패/정체돼 라이브 미반영이었으나, 복구 후 gh-pages 빈 커밋 재트리거로 빌드 성공. web(index-Vw5RVdpD)·desk(index-K19mHC7C) 라이브 실측 — 신기능 문자열(자산 배분/계좌 유형별/노는 돈) 확인. errors.md 기록.
- 대시보드 보유 종목 표 14열(반복 종목명) 중앙→**좌측정렬**. node --check + push_safe 배포.
- web 자산 배분 카드: 투자중에 **"일하는 돈"**(초록) 라벨 추가 — 대기중 "노는 돈"(주황)과 짝. tsc·빌드 통과, GH Pages 라이브 반영 실측(index-By_HFIev, 일하는 돈/노는 돈 확인).

## 2026-07-14
- 삼성증권 ISA 매도 4건 원장 자동 기록 (카톡 체결 → `post_trade.py`) — TIGER 반도체TOP10(504)·TIGER 차이나테크 TOP10(1367)·KoAct 코리아밸류업액티브(800)·KODEX AI반도체핵심장비(970), 전부 전량매도. GAS 응답 `beforeQty→afterQty:0`·`posFound:true` 4건 검증, 재덤프로 실현손익 확인(합계 +[금액]: +[금액]·+[금액]·+[금액]·+[금액]). 첫 삼성 카톡 → 계좌 매핑(`71528*****-14→ISA`, 국내ETF 매도 수수료 0.0042% 원장 실측)·삼성 포맷 memory 누적.
- `매매기록!`/`매매기록하자!` 명령어 트리거 고정 — 체결 카톡 붙여넣기 시 매수/매도 원장 기록 프로세스 자동 실행. CLAUDE.md 세션 키워드 표 + "매매기록!" 절차 섹션 추가, memory `feedback_trade_record_command` 신설.

## 2026-07-15
- 매도 종목 What-if 추적 + 기간별 번 돈 (v1) 구현·배포. 설계 `docs/plans/2026-07-15-매도추적-기간별번돈.md`.
  - **핵심 발견**: `updateNewPriceHistory`가 *거래_원장* 전체 코드 기준 → 판 종목도 매일 *현재가_이력*에 기록됨(백업 실측: 어제 4건·옛 매도·해외 MU 열 존재). → KIS 신규 호출·별도 append 시트 불필요, 기존 시트 파생으로 저위험 구현.
  - **GAS** `SoldTracker.js` 신설: `buildSoldTracker`(*실현손익*×*현재가_이력* 파생 → *매도추적* 시트, `updatePositionFromLedger` 말미 훅=모든 경로 통과) + `newMobileGetSoldTracker`(read, 16필드) + `_soldLatestPriceMap`·`_setupSoldTrackerSheet`. 국내만 what-if(해외 MU 가격 스케일 환율 미반영 불일치 [금액]≠[금액] → blank), 예금 코드 빈칸 자동 제외. NS.SOLD_TRACKER 추가.
  - **웹** `periodProfit.ts`(computePeriodProfits, 추이 AD diff=실현+평가, vitest 6케이스) + 대시보드 "기간별 번 돈" 타일 + `SoldTrackerCard`(매도 복기). **데스크** DataProvider `useSoldTracker` context + Activity `SoldTrackerPanel`.
  - **검증**: vitest 49통과·web/desk tsc·빌드 통과, node --check 11파일, walk-through(396500 안팔았다면 [금액]/실현 [금액]/차이 +[금액] ✓). **GAS 배포**: push_safe HEAD + gas_redeploy v27(고정 3배포·마커 확인). docs 4종(code-map·api-reference·architecture·features) 갱신.
  - 잔여: v2 곡선 소급(2026-01-11 이전 매도의 매도일~현재 일별 곡선 — 스냅샷은 전량 커버, KIS 일봉 소급은 효용 확인 후).
