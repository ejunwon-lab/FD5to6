# 설계 결정 기록

---

## 이메일 셀프발송 — 수신자 고정 + 5중 안전장치 (2026-06-20)
- **결정**: PB 리포트 이메일을 GAS `MailApp.sendEmail`로 발송하되 수신자를 `getEffectiveUser()` 소유자 본인에 **코드 고정**(요청 바디로 지정 불가). GitHub SMTP 대신 GAS — 인증 추가 0(기존 웹앱 재사용).
- **이유**: "해킹/오발송으로 아무데나 발송" 우려 → 수신자가 요청에서 안 오면 **제3자 발송이 구조적으로 불가능**. 남은 위험(본인 스팸폭주·임의내용·사고)은 5중 방어: killswitch·제목화이트리스트·일일상한6·주소마스킹·수신자고정. secret은 Claude가 안 가져 직접 발송 수단 없음(워크플로 guard 경로만).
- **단점**: consumer Gmail 쿼터 100/일(리포트 2통이라 무관), MailApp 신규 스코프 = 사용자 재승인 1회.

## 리포트 최근 추세 — operatingRate 대신 dRate (2026-06-20)
- **결정**: "최근 N일 수익률·벤치비교"를 누적 운용수익률(operatingRate) 대신 **일별 총자산 변화율(dRate) 복리누적**(portfolioReturn d5/d20)으로.
- **이유**: operatingRate는 매수 시 분모(매입원가) 변동으로 오염 → 시장성과와 매매효과 구분 불가. dRate는 현금↔주식(매매)엔 총자산 불변→0, 시장변동만 반영 → KOSPI/KOSDAQ N일 변화율과 **단위 일치 비교** 가능. 입출금일만 왜곡(단서 처리).
- **한계**: 입출금 완벽보정 불가(데이터 없음). TWR은 과한 복잡도라 미채택.

## 휴장일 = 직전 거래일 리뷰 (빈 메시지 폐지, 2026-06-20)
- **결정**: 휴장이어도 "휴장 한 줄"이 아니라 **직전 거래일 마감 기준 풀 PB 리포트** 생성(파일 필수). KR은 Naver 모호 시 Yahoo `^KS11`/`^KQ11`/`.KS` 폴백.
- **이유**: GAS 포트지표는 휴장 무관 최신이라 내 포트 점검은 항상 가능. 주말·공휴일에도 포트 현황·전망이 PB 가치. 빈 메시지는 정보 0. + 기존 프롬프트 모호로 LLM이 비결정적 처리(같은 토요일 두 dry_run이 다르게)하던 것 해결.

## GAS를 데이터 중간자로 사용
- **결정**: iOS가 KIS API를 직접 호출하지 않고 GAS를 통해 데이터를 받음
- **이유**: KIS API 인증 토큰·시크릿을 iOS 앱에 포함하면 보안 위험. GAS가 서버 역할을 하고 iOS는 Google 계정 인증만 사용
- **단점**: GAS 실행 시간 제한(6분), 응답 느림(10~60초)

## 참고지표 2시트 구조
- **결정**: `참고지표`(현재값 요약) + `참고지표_히스토리`(날짜별 누적) 분리
- **이유**: 요약 시트는 iOS가 빠르게 읽는 용도, 히스토리는 사용자가 구글 시트에서 추이를 볼 수 있도록
- **대안 검토**: 단일 시트(히스토리만) → iOS에서 최신 행 찾는 로직 복잡해져서 기각

## NavigationStack 제거
- **결정**: PageTabViewStyle 내 모든 뷰에서 NavigationStack 사용 안 함
- **이유**: iOS에서 PageTabViewStyle과 NavigationStack 중첩 시 크래시 발생
- **방법**: `.navigationTitle`, `.toolbar` 대신 커스텀 헤더 VStack으로 대체

## Yahoo Finance for 선물 데이터
- **결정**: ES=F, NQ=F 등 선물은 GOOGLEFINANCE 대신 Yahoo Finance API 사용
- **이유**: GOOGLEFINANCE가 선물 심볼을 지원하지 않음. Yahoo Finance는 인증 없이 호출 가능
- **위험**: Yahoo Finance API는 비공식 — 언제든 차단될 수 있음. KIS 해외선물 API가 검증되면 교체 고려

## KIS 해외지수 → GOOGLEFINANCE fallback
- **결정**: KIS 해외지수 API 실패 시 `INDEXSP:.INX` 등 GOOGLEFINANCE 심볼로 자동 보완
- **이유**: KIS 해외지수 API(HHDFS00000300)가 지수 조회에 실제로 동작하는지 미검증 상태
- **방법**: `_fillMissingWithGoogleFinance()` — gfSymbol 있는 항목은 자동 보완

## Named Range 기반 셀 참조
- **결정**: 시트 구조 변경에 취약한 하드코딩 셀 주소 대신 Named Range 사용
- **이유**: 시트에서 행/열을 추가하면 하드코딩 주소가 깨짐. Named Range는 드래그로 자동 추적
- **적용 범위**: ACTIVE_HEADER, ACTIVE_TOTAL, SOLD_HEADER, FX_USD, FX_GBP, TREND_OP_TOTAL, TREND_PEND_TOTAL

## pull-to-refresh 제거
- **결정**: 모든 탭에서 pull-to-refresh 제거
- **이유**: 실제로 당겨서 취소하면 CancellationError가 UI에 에러로 표시됨. GAS 호출이 30~90초 걸려서 당기기 UX와 맞지 않음
- **대체**: 대시보드 상단 버튼(번개·그리드·별) 으로 업데이트

## 2026-05-17 — 종목 지표를 *종목지표* 시트로 미리 계산 (E안)

- **결정**: 종목별 지표(당일등락·1주/1달 손익·1M~1Y%·52주)를 `computeStockMetrics`가
  한 번 계산해 *종목지표* 시트에 저장. 앱·대시보드는 `_readStockMetrics`로 읽기만 함.
- **이유**: 기존엔 `_mCalcExtras`(앱)·`_calcExtraColumns`·`_calcTodayProfit`(시트)이
  같은 계산을 따로 구현 → 한쪽만 수정되면 드리프트(감사 #1 버그가 그 사례).
  *보유현황*이 이미 "원장에서 미리 계산해 저장한 표"인 것과 동일한 패턴.
- **효과**: 계산 함수 3개 → 1개. 앱 응답 빨라짐(읽기만). 앱·시트 값 항상 일치.
  클라이언트(web/iOS) 영향 없음 — API 응답 구조 불변.
- **갱신 보장**: `updatePositionFromLedger` 끝에서 `computeStockMetrics` 호출 →
  모든 갱신 경로(updateAllNew·newMobileUpdate*·메뉴)가 통과. 읽기 시 시트 없으면 1회 자동 계산.

## 2026-05-25 — 데스크 표시 규칙: 숫자 풀 + 종목명 메인

- **결정**: 모든 UI에서 숫자는 풀 표시(`toLocaleString()`), 종목 표시는 종목명이 메인·종목코드는 보조
- **이유**: 사용자 명시 피드백 — 축약(`1.23억`·`456만`·`M/K`)은 정확 금액 파악을 방해. 한국 종목 6자리 코드는 그 자체로 의미 인지가 안 됨 → 종목명이 1차 단서
- **적용 범위**: web-desk 모든 컴포넌트 (Account P&L·ContributionBar·GainersLosersStrip·MarketHeatmap·HoldingCard Terminal·DashboardHoldings List·Ticker 등)
- **보장 장치**: memory 영구 저장 (`feedback_number_display`·`feedback_stock_name_primary`) → 향후 새 컴포넌트에 자동 적용

## 2026-05-25 — 데스크 단일 데이터 소스 (DataProvider Context)

- **결정**: `usePortfolio`·`useRealized`를 페이지마다 새 instance로 호출하는 대신, App 최상위 `DataProvider`가 1 instance로 모든 페이지에 공유
- **이유**: 페이지 unmount/mount 시마다 fetch 3건 중복 호출되던 문제 (사용자 발견). Provider 1개로 페이지 전환 시 fetch 0건
- **호환성**: 기존 hook 파일(`usePortfolio.ts`·`useRealized.ts`)을 re-export 1줄로 변경 → 모든 호출처의 import 경로 무변경
- **부가 효과**:
  - **prefetch**: 대시보드 1차 fetch 직후 `monthlyRealized` 백그라운드 prefetch → Activity 첫 진입 즉시 표시
  - **시간당 자동 백그라운드 재페치**: `setInterval(60 * 60 * 1000)` → GAS 09:30~16:30 매시 :30 자동 갱신과 매칭
  - **inflight 가드**: 동시 호출 방지

## 2026-05-25 — GAS 장중 자동 트리거: everyMinutes(30) + 핸들러 분 체크

- **결정**: 장중 매시 :30 트리거를 `everyHours(1) nearMinute(30)` 대신 `everyMinutes(30)` + 핸들러에서 분/시각/거래일 통과 조건 체크
- **이유**: `nearMinute`는 GAS 문서상 ±15분 슬랙 → "정확히 :30" 보장 불가. `everyMinutes(30)`은 ±2분 정확도
- **트레이드오프**: 컴퓨팅 트리거 호출은 더 많아지지만(매 30분 발화 → 09:30~16:30 외엔 즉시 return), GAS time-driven 한도 안에서 무시할 만한 비용
- **충돌 방지**: `LockService.tryLock(2000)` — tgPushPnL(매시 :00/:20/:40)·사용자 갱신과 겹치면 skip → 다음 30분 슬롯에서 복구

## 2026-05-25 — Holdings Account P&L (구 Exposure Matrix)

- **결정**: 시장 분류(KR/US) 매트릭스 → 계좌×(투자 원금/수익금/합계 평가) 구조로 재설계
- **이유**: 기존 KR/US 분류는 클라이언트가 종목코드 6자리 여부로 자체 분류(GAS는 market 필드 안 줌). 사용자가 보고 싶은 건 "이 계좌가 얼마 투자해서 얼마 벌었나"인데, 시장 분류는 사용자 의도와 불일치
- **이전 방식 보존**: 시장(KR/US) 정보는 종목 카드/리스트에서 그대로 표시. 다만 매트릭스 집계에서만 제외

## 2026-06-09 — 코딩 전 설계 게이트 (변경 전 ultrathink)

- **결정**: 위험 변경(배포 GAS·`.github/workflows/*`·권한·외부 API)은 **코딩하기 전에** `/design-check` skill로 설계+검증 노트(외부 동작 가정·errors 부류 검색·추론 가능 vs 실환경 전용 분리·검증 방법)를 작성하고 통과해야만 코딩 시작. CLAUDE.md "변경 전 설계 절차" + `.claude/skills/design-check/SKILL.md` + 산출물 `docs/plans/`.
- **이유**: 텔레그램 푸시 에러 5건 중 4건(302 redirect·MYSELF 권한·best-effort 스케줄러·update_id 루프)이 **코딩 전 추론·문서로 알 수 있었던 것**(errors.md 2026-06-09). 사후 검증(스모크·모니터링)보다 코딩 전 사고가 토큰·신뢰 둘 다 싸다 — 재작업 루프(디버깅→재코딩→재배포→재검증) 1회 ≫ 설계 1회. 텔레그램은 이 루프가 5번 돌았음.
- **한계 (정직)**: ultrathink는 추론 가능한 에러만 거른다. 실환경 전용(특정 IP 차단·실제 스케줄러 적중률)은 못 잡으므로 사후 스모크/실측과 보완 관계. 단 *우선순위*는 코딩 전 설계 — 과거 에러 대부분이 추론 가능했음.
- **2단계 전략**: 현재 CLAUDE.md 규칙 + skill(자율 적용). 다음 위험 변경에서 효과(코딩 전 에러 차단) 증명 후 PreToolUse hook으로 위험 경로 Edit 시 강제 게이트 추가. 자율 단계 자체가 "내가 절차를 지키는지"의 시험대.
- **트레이드오프**: 모든 변경에 적용하면 마비·토큰 낭비 → 트리거를 외부 의존 변경에만 좁힘(순수 함수·UI·문서 제외).

## 2026-07-23 — web-desk 테마 시스템 (Modern/Terminal 2테마, CSS 변수)

- **결정**: 모바일 가독성 개선(폰트·크기·컬러)을 하드코딩 교체가 아니라 **CSS 변수 기반 2테마**로 구현. `:root`=Terminal(기존 네온 원형 그대로), `[data-theme='modern']`=개선판. Settings에서 전환, 기본값 Modern.
- **이유**: 사용자가 "전부 개선하되 테마로 스위치 가능하게" 요청. 변수 캐스케이드라 전환 시 리마운트 불필요(차트 SVG의 `rgb(var())`도 즉시 갱신).
- **Modern 설계 근거**:
  - 폰트: JetBrains Mono는 한글 글리프가 없어 한글이 시스템 폴백으로 혼재 → 본문 Pretendard Variable(dynamic subset CDN), 숫자 정렬은 `.tabular`(tnum)로 유지
  - 텍스트 토큰: 전부 bg 대비 ≥4.5:1 검증(ink-faint 5.07:1 — 기존 terminal은 2.59:1로 WCAG 미달)
  - 차트 시리즈(`--c-s1~s7`): 텍스트 토큰과 분리 — 텍스트는 대비 기준, 면 채움은 다크 밴드(OKLCH L 0.48–0.67) 기준이 상충하기 때문. modern 시리즈는 dataviz 검증기 5체크 전부 통과(CVD ΔE 8.4·normal 19.3·대비 3:1)
  - 크기: 주력 스케일(10/11/12px)을 모바일(<640px)에서만 한 단계 상향(11/12/13px) — 양 테마 공통, 데스크톱 밀도 불변
  - CRT 스캔라인은 terminal+데스크톱에서만 (모바일·modern에선 노이즈)
- **규칙**: 이후 컴포넌트·차트에 raw hex 금지 — `rgb(var(--c-…))` 사용 (테마 전환이 못 따라감)
