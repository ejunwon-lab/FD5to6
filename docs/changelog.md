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
- 웹앱 매도 복기 **전용 탭** 추가(`SoldTrackerPage`, 분석 오른쪽 "복기 ↺"). 정렬 pills(최근/차이/실현/경과/종목명 · 재탭 시 방향 토글, 해외 null 하단) + 요약 3칸 + 종목별 목록. 대시보드 카드는 요약 뷰로 유지. TabBar 5탭 확장. tsc·빌드 통과, GAS·데이터 무변경(기존 soldItems 재사용).
- **버그 수정**: KIS_SKIP(예금) 운용수익 오염. 우리은행 정기예금 행 평가금액 빈칸 + 손익 셀=전체집계 라이브 수식(73~74M) → 운용수익 왜곡(합계 손익 150M·55%). 원인: 예금은 KIS_SKIP이라 코드가 손익 재계산 없이 보존만 함(현재단가만 입력·평가금액 빈칸 방치). 해결(v28): `updatePositionFromLedger` KIS_SKIP 자가치유 — 평가 빈칸+현재단가>0 시 평가=현재단가×수량·손익=평가−매입 재계산 + 잘못된 집계 수식 복원 제외(`skipAutoFilled`), 펀드·보험(평가 채워짐)은 불변. **라이브 검증**: 예금 평가 [금액]·손익 [금액]·13.49% / 펀드·보험 4행 불변 / 합계 손익 150.4M(55%)→77.9M(28.64%) 정상화. 설계 `docs/plans/2026-07-15-KIS_SKIP-운용수익-자가치유.md`, errors.md 기록.

## 2026-07-16
- 웹 대시보드에서 매도 복기 카드 제거(전용 "복기" 탭으로 이전 완료), `SoldTrackerCard` 삭제.
- 계좌 유형별 "일반 투자" 증권사 계좌 단위 분리(삼성 종합/삼성 ISA/삼성 CMA, 미래는 단일계좌면 증권사명만) — `computeAccountTypeBreakdown` 수정, vitest 갱신. tsc·빌드 통과.
- **프라이버시 정리**: public repo(`ejunwon-lab/FD5to6`) 커밋 docs에 실제 원화 금액이 노출돼 있던 문제. (C) 앞으로 docs·응답에서 금액은 마스킹/비율로만 기록, 정확값은 로컬 시트·backups(gitignore)에만. (B) 기존 히스토리는 git-filter-repo로 금액 리터럴 스크럽(force push). 테스트 픽스처는 합성값으로 익명화.
- **프라이버시 2차**: 죽은 부트스트랩 함수 `importHistoricalTrades`(실제 과거 거래 80건이 코드에 하드코딩, 호출처 없음) 제거 + git-filter-repo로 전 히스토리에서 거래 행 리터럴 스크럽. node --check·vitest 49통과, GAS 재배포(죽은 함수 제거). 2차 force-push 필요.
- pending 대청소 — 2026-05월 stale 항목 10건을 증거 실측으로 닫음(트리거 생존·주간 pre-fetch 로그·리포트 커밋 실측), 🔴/🟡/⚪ 재구조화. filter-repo가 지운 upstream 추적 복구. GitHub GC 요청 격상.
- TWR 입금 왜곡 보정(v29) — 원장 `구분=입금/출금` 행 타입(addTrade 확장·멱등) + getPortfolioMetrics read-time 보정(`flowAdj`/`rawPct`) + `suspect` 플래그(|dRate|≥3%·flow 없음) + weekly-prompt 해석 지침. `/design-check` 설계 게이트 첫 실전 적용(원장 소비자 7종 전수 조사). negative 테스트 3건 통과.
- **% 셀 타입 비대칭 버그 발견·수정(v30·v31)** — `_trFmtPct` 부호 % 문자열을 Sheets가 음수만 분수 numeric으로 auto-parse → 음수 날 100배 축소, d5 +8.04%→실제 **-4.45%**. 6/28 주간 리포트 +4.9% 왜곡의 진범으로 확정("6/23 입금"은 오진 — 실제 시장 폭락일). v30 읽기 `_mPctVal`(S·AC·AF 3곳), v31 쓰기 근본 수정(numeric 분수+`_trPctFormat` 서식). errors.md·memory 기록.
- 신한만기 기록시차 소급 교정 — 시장/기록 요인 분해로 d20 창 22구간 전수 감사(예외 4건 전부 설명), 원장 flow 행 2건 소급(7/7 입금·7/9 출금) → 7/9 -5.78→+2.06 flowAdj 실측·d20 복리 검산 일치. 운영 원칙: 내부 이동은 같은 날 양쪽 반영 or flow 행.
- 위생 묶음 일괄 처리 — ①desk 로케일 ko-KR 통일·position52w 공용화(kst는 기수정 확인) ②format.test 시각 고정 계산 케이스(web 54통과) ③save.sh 트레일러 모델 무관화·deploy npm ci·desk vitest 신설(8케이스)+배포 테스트 step ④code-map 등재 2건(check_stale 클린) ⑤Trend.js % numeric 전환(/design-check 통과, v31).
- US 리포트 "매번 실패" 진단·수리 — 실체는 첫 dispatch만 실패(5회/9일, 체인 재시도로 리포트는 매일 도착). 원인: 에이전트 권한 승인 산문 이탈+파일명 오계산+턴 소진. 수리(3 job): `--permission-mode bypassPermissions`·max-turns 40·파일명 결정론화(DATE_KST 프롬프트 주입). `/design-check` 통과, dry_run 스모크 dispatch. 최종 판정은 내일 08:0x 라이브.

## 2026-07-20
- **자동화 watchdog 구축** — `watchdog.yml`(매일 21:10·22:10 KST, dedup·dry_run) + `scripts/watchdog_check.sh` 5종 대사(체인 생존·실발송 건수·휴장 판정·시트 신선도·리포트 커밋) → 텔레그램 매일 heartbeat. "실행 자체가 없는" 침묵 실패(6/5·6/9·7/9 공통 뿌리) 감시. 로컬 스모크 + 라이브 dry_run(run 29692244557) 통과 — 러너에서 GAS 도달·private 리포트 checkout·red 전환 실증. daisy-chain 무수정, 신규 secret 0.
- **pre-commit 금액·시크릿 스캐너** — `scripts/git-hooks/pre-commit`: 경로 차단(.env·Secret.js·backups·키파일)+시크릿 패턴(전 파일)+원화 금액 패턴(md만). 자가 테스트 8/8, 기존 파일 소급 false-positive 0. run.sh가 각 맥 자동 활성화(core.hooksPath). force-push 스크럽 2회 전과의 사전 차단 장치.
- **휴장일 권위 소스 전환** — 채택 기준을 이름 화이트리스트 → 구글 캘린더 DESCRIPTION '공휴일' 분류(공개 ics 280건 실측: 공휴일 205/기념일 75 정확 이분). **지방선거일 6/3 잠복 결함 발견**(화이트리스트 미매칭 — 제헌절 동일 클래스, errors.md 기록). desc 부재 시 화이트리스트 폴백 = 회귀 불가능 설계. `scheduledHolidaySync` 12월 게이트 제거 → 매월 25일. push_safe 배포. KRX 직접 연동은 검증 불가 리스크로 기각(설계 노트에 근거).
- **시트 타입계약 검증** — `scripts/check_sheet_types.py`: 백업 `_raw.json`에 5시트 계약 assert(% 문자열·주말/휴장일 행·비숫자 등 6클래스, 합성 테스트 전건 검출). `backup_sheets.py` 백업 직후 자동 실행. % 비대칭(7/16) 클래스 조기 검출 장치.
- **pending ⏰ 만기 추적** — `⏰YYYY-MM-DD` 태그 규약 + `scripts/check_pending_due.sh`(실행@ 자동) — 첫 실행에서 당일 만기 4건 즉시 표시.
- memory 강화 — Secret.js는 백업 제안·안내 포함 일절 금지(사용자 재확인) 반영·미러.
- 개선 아이디어 10건 총정리 — 2·3·5·9·1 구현 완료, 10(체인 재시드)은 watchdog으로 해소 종결, 7·8 보류, 4 점진, 6 작업 금지 확정.

## 2026-07-23
- **수익 계산 전수 감사 → 4건 수정** — ①히스토리 윈도 "최소 180거래일+전년 12/1 보장"(YTD 잠복 결함 제거) ②합계 수익률 분모 누적 투입원가로(매도 회수 원금 누락 과대 교정 — 4클라 % 하락 정상) ③데스크 Heatmap 윈도 첫 달 누적 부풀림 제거 ④EquityChart 기간 버튼 날짜 산술화. /design-check 통과, push_safe+gas_redeploy v33, web 54테스트·desk build 클린. errors.md 기록.
- 웹 "기간별 번 돈" → "기간별 수익" 라벨 변경 + 계산 로직 확인(확정+운용 diff — 실현 이미 포함).
- **데스크 모바일 반응형 1단계(Dashboard)** — MobileTabBar(하단 탭 6개, safe-area)·h-[100dvh] 셸·viewport-fit=cover + 홀딩스 기본 상위 9종목 접기(전체 보기 토글) + 필터바 모바일 2행화 + Holdings meta ₩M 축약 → 풀 숫자 교정. desk tsc·build·vitest 8/8.
- **웹 배포 7일 침묵 실패 복구** — 7/16 vitest 4 추가 시 lock 미재생성 + npm ci 전환 겹침 → CI만 "Missing @esbuild/*@0.28.1" 거부(로컬 npm 11은 통과라 재현 불가였음). lock 완전 재생성으로 복구, errors.md 기록.
- **데스크 홀딩스 카드 폴드(A안 2단)** — Web/Terminal 카드 접힘(헤더만)↔펼침(요약+상세, 중복 3필드 제거), 기본 데스크톱 펼침/모바일 접힘, "모두 접기/펼치기" 전역 토글(개별 클릭 오버라이드). Holdings 탭에도 자동 적용. tsc·build·vitest 8/8.
- 카드 접힘 헤더 2줄 컴팩트화 — 접힘 시 종목명|현재가 / 등락%·내 등락총액 2줄만(코드·기간·상세버튼·×수량 수식은 펼침 전용), 패딩 축소. 사용자 피드백 반영.
- **KPI 카드 표시 버그 5건 수정** — Today P&L "+₩-" 모순 표기·하락일 초록▲ 고정(tone 'up' 하드코딩) → 부호 기반 signTone, Total Return 동일 적용, 총자산 delta 무의미 ▲ 제거, Positions "N/N"→"N종목 + GAIN·LOSS·FLAT", 라벨 "주식"→"투자중", fmtKRW 음수 "-₩1,234" 표기.
- **데스크 신뢰성 정리 묶음** — TopBar 고정 pill("CONNECTED·KIS"/"KRX OPEN"/"NYSE PRE") → 실배선(DATA LIVE/SAMPLE·KRX/NYSE 개장 요일·시각 판정), ActivityFeed 무조건 더미 → 실현손익 최근 8건, Dividends 배지 '3' 삭제, Indicators "live"·Markets "LIVE" 라벨 실상태 연동, 죽은 코드 HoldingsTable.tsx 삭제, Placeholder 문구 현행화.
- 데스크 전수 분석 보고 — 가짜 데이터 노출 5곳·미구현 nav 4개·Phase A/B 완료 확인(잔여: 시장/섹터 도넛·Phase C 전체)·포맷 헬퍼 미사용 107곳. 로드맵 5단계 수립.
- **KIS Status 페이지 신설 (로드맵 ②)** — GAS `newMobileGetSystemStatus`(_buildDiag 재사용 + kis_carried_status, 금액·종목명 없는 진단 페이로드, scripts.run OAuth 전용) + 데스크 KisStatusPage(단축키 K: KIS 시세 carried/total·시스템 상태·지표 충족도 바·최근 이력/휴장일·Refresh). /design-check 통과, push_safe 배포.
- **모바일 2단계(로드맵 ③)** — Today 정렬/필터 컨트롤 가로 스크롤 한 줄(줄바꿈 제거)·updated 라벨 lg+만. Analysis·히트맵·벤치마크는 기대응 확인(구조 수정 불요).
- **Analysis Total Return 교정** — 곡선 diff(서버 윈도 내 수익으로 축소됨) → summary 전체 누적(대시보드 KPI와 동일 정의). 부수 발견: Sharpe·Vol·MDD 등 리스크 지표가 누적수익 곡선 %변화 기반이라 왜곡 — 일별 총자산 API 노출 필요, pending ⑥ 등재.
- **Analysis 리스크 지표 자산 기반 교정 (로드맵 ⑥)** — newMobileGetProfitHistory entries에 totalAsset(추이 기록 Q열) additive 추가 → 데스크 Sharpe·Volatility·Win Days·Best Day·MDD를 자산 시리즈 기반으로 교체(누적수익 분모 과대 제거, MDD 정의를 GAS getPortfolioMetrics와 통일). TWR 한계 명시(raw 자산 diff — 입출금일 왜곡 잔존). /design-check 통과, push_safe 배포.
- **포맷 로케일 통일 (로드맵 ④)** — 데스크 전 소스 107곳 `toLocaleString()` → `toLocaleString('ko-KR')` 일괄 지정 (브라우저 로케일 드리프트 제거). fmtKRW 전면 치환은 표기 회귀 위험 대비 이득 없어 제외.
- **로드맵 ⑤ 1차분** — ⓐPrice History 페이지(종목 리스트→가격 차트·매수/매도 마커·내 평균단가선·기간 KPI, 단축키 P) ⓑSettings 페이지(localStorage: 뷰모드·상위 N 접기·카드 폴드 기본값, 단축키 S) ⓒPhase C 3종: Drawdown underwater 차트(자산 시리즈)·분류 도넛·홀딩스 CSV 내보내기(BOM). 전부 클라이언트만 — GAS 무변경.
- **web-desk 테마 시스템 (Modern/Terminal)** — 모바일 가독성 개선(본문 Pretendard·보조 텍스트 대비 ≥4.5:1·소프트 팔레트·모바일 폰트 한 단계 상향·스캔라인 제거)을 Modern 테마로 신설, 기존 네온 룩은 Terminal 테마로 보존. 전 색상 CSS 변수화(`--c-*`) + 차트 하드코딩 hex 10파일 청소 + 도넛 시리즈 전용 검증 팔레트(`--c-s1~s7`). Settings 테마 전환(즉시 반영, 기본 Modern). tsc·build·vitest 8/8·팔레트 검증기 통과.
