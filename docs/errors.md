# 에러 로그

---

## 2026-07-03

### KR 리포트 "Naver 차단 14일차" — 러너 IP 차단이 아니라 WebFetch 도구 계층 차단
- **증상**: 6/19경부터 KR 리포트 에이전트가 Naver 접근 실패 지속 보고("차단 N일차"). 거래대금 "—", 업종 강세/약세·종목 수급 미수집, 급락(7/2 -7.89%) 원인 뉴스 확인 불가, 종목 자동선별 degrade.
- **진단**: ① 로컬(한국 IP) curl 200 → Naver 정상 ② **diag-egress.yml로 러너에서 실측 → curl은 Naver 전 엔드포인트 200 + 실데이터** (IP 차단 가설 기각) ③ 남는 층위는 Claude CLI **WebFetch 도구**뿐 — robots.txt/봇 정책 차단 추정(Naver는 robots 전면 disallow). 부수 발견: 한경 `/finance` 404(죽은 URL), 인포맥스 articleList 빈 응답(RSS는 정상), **Yahoo는 러너에서 429 잦음**(KOSDAQ 주간% 런별 변동의 원인).
- **해결**: kr-prompt·weekly-prompt에서 Naver·뉴스·Yahoo fetch를 **WebFetch → Bash curl**로 전환(브라우저 UA, finance.naver.com은 `iconv -f euc-kr`, Yahoo 429 시 sleep 재시도). 뉴스는 검증된 URL로 교체(종목뉴스 `m.stock.naver.com/api/news/stock/{code}`·인포맥스 RSS·매경). GAS/KIS 확장은 불필요해져 취소. 설계: `docs/plans/2026-07-03-naver-차단-우회.md`.
- **교훈**: "차단"의 층위를 갈라야 한다 — **서비스 차단 ≠ IP 차단 ≠ 도구(WebFetch) 차단**. 에이전트가 "차단"이라 보고해도 같은 러너의 curl이 뚫리는지부터 실측(diag-egress.yml 재사용). 진단을 코딩 앞에 둔 덕에 GAS marketSnapshot·KIS TR 대공사(설계 노트의 A-2a·2b 전체)가 불필요함이 코딩 전에 판명 — `/design-check` 게이트의 실증 사례.

### 주간 리포트 "GAS 미접속(환경변수 미설정)" 오판 — env는 주입돼 있었음
- **증상**: 6/28 첫 주간 리포트가 dailyReturns를 "역산 추산값"으로 표기. 워크플로 로그엔 `GAS_WEB_APP_URL: ***` 주입 확인.
- **원인**: 에이전트가 env 유무를 스스로 판단하다 오판(정확한 내부 원인은 헤드리스 로그에 안 남음). 일일 KR은 같은 패턴으로 매일 성공 — 에이전트 판단 의존이 단일 실패점.
- **해결**: weekly job에 **pre-fetch step**(워크플로가 curl → `/tmp/weekly/gas_metrics.json` 저장, 로그엔 HTTP 코드·필드 유무만) 추가, 프롬프트는 파일 Read 1차 + env curl 폴백. 판단 개입 자체를 제거.
- **교훈**: 헤드리스 에이전트에게 "env 있으면 해라"는 판단을 맡기지 말고, **결정적 단계는 워크플로 step으로 끌어올려** 결과 파일만 넘긴다.

## 2026-06-21

### d5/d20/dailyReturns가 비거래일 행에 밀려 5일·20일 창이 어긋남 (주간 리포트 dry_run에서 발견)
- **증상**: 주간 리포트 dry_run에서 **일자별 포트수익 합(월+4.18%…금0% 복리 ≈ +7.3%)** 과 **GAS `portfolioReturn.d5`(+2.98%)** 가 ~8%p 불일치. 같은 소스(일별추이 S열)인데 충돌.
- **원인**: *일별추이* 시트에 **비거래일 행(토 6/20, dRate≈0)** 이 끼어 있었음(주말 수동 업데이트 — errors.md 2026-05-17 "비거래일 행 누적" 계열). `getPortfolioMetrics`의 `series.slice(-5)`가 행 기준이라 [6/16,17,18,19,**6/20토**]를 잡아 **월요일(+4.18%) 탈락** → d5 과소. 검산: (1.073)/(1.0418)−1 ≈ +2.98% = 관측 d5와 정확히 일치.
- **해결 (v24)**: series·recentReturns 빌드 루프의 날짜 형식검사(`/^\d{4}-\d{2}-\d{2}$/`)를 **`_isTradingDateStr(d)`** (주말 getDay 0/6 + 휴장일 Set)로 교체 → 비거래일 행 제외, `slice(-5/-10)`가 '최근 N**거래일**' 보장. walk-through: 6/20 드롭 → slice(-5)=6/15~19, d5 +2.98%→**+7.29%**. **일일 KR 리포트 d5도 동시 교정**(이전엔 주말 행 있을 때 매번 한 칸 밀림).
- **교훈**: 시계열 `slice(-N)`은 "최근 N행"이지 "최근 N거래일"이 아니다 — 비거래일 행이 끼면 창이 통째 밀린다. **거래일 필터를 데이터 진입점에 둬야** d5·창 기반 지표가 안전. dailyReturns에 **날짜를 동반**시킨 덕에 에이전트가 Mon~Fri를 골라 자가교정·발견했음(날짜 없는 opRatePct였으면 못 잡음).

### 주간 지수 변화율 range=5d가 월요일을 누락해 과소표시 (같은 dry_run)
- **증상**: 주간 리포트가 KOSPI 주간 +5.93%로 표기(실제 +11.4%). 내 포트 d5(전주 금요일 기준)와 창이 달라 벤치 비교가 사과-오렌지.
- **원인**: Yahoo `range=5d` = 5개 종가 [6/15c…6/19c]. 첫↔끝 = **6/15 종가→6/19 종가**라 6/15(월) 당일 +5.2% 등락이 base에 흡수돼 빠짐. d5는 "최근 5거래일 수익"이라 6/12(전주 금)→6/19 구간(월요일 포함).
- **해결**: weekly-prompt 1-A를 `range=1mo` + **주간% = (close[-1] − close[-6]) ÷ close[-6]** (전주 금요일 종가 base)로. d5와 동일창 → 벤치 비교 정합. (재dry_run KOSPI +11.4%.)
- **교훈**: "주간 변화율"은 base가 **전주 마감 종가**여야 d5(5거래일 수익)와 같은 창. `range=5d` 첫값은 이번 주 월요일 종가라 월요일 수익을 빠뜨린다.

## 2026-06-12

### addTrade 멱등 체크가 전량매도 후 중복 POST에서 작동 안 함 (스모크 중 발견·수정)
- **증상**: 카톡 매매 `action=addTrade` 스모크에서, 전량매도 1건 기록(성공) 직후 **동일 건 재POST가 `already:true`(멱등 skip)가 아니라 `category_required` 에러**로 떨어짐.
- **원인 1 (순서)**: `_appendTradeRow`가 **분류 룩업/`category_required`를 멱등 체크보다 먼저** 실행. 전량매도로 *보유현황* 행이 사라지자 분류 룩업이 실패→`category_required`로 빠져 멱등 체크에 도달 못 함. (중복 기록은 안 됨 — append 전 차단됐을 뿐 멱등 경로 미작동.)
- **원인 2 (날짜 타입)**: 순서를 고친 뒤에도 여전히 실패. *거래_원장* 날짜 셀이 **문자열이 아니라 Date 값**으로 저장돼 있어 dedup의 `String(r[0]) === dateStr`('2026-06-12') 비교가 영구 불일치.
- **해결 (v16)**: ① 멱등 체크를 분류 룩업보다 **앞으로** 이동. ② 날짜 비교를 `r[0] instanceof Date ? formatDate(...) : String(r[0]).trim()`로 양쪽 견고화. 재검증: 동일 주문번호(6396) 재POST → `already:true, row:110`(중복 0).
- **교훈**: 멱등 키 체크는 **다른 모든 게이트(존재 룩업·검증)보다 먼저** 와야 한다(중복은 "이미 처리됨"이지 "입력 부족"이 아님). + 시트 셀 타입(Date vs String)을 비교 전에 정규화. errors.md:203 update_id 멱등 계열.

### ⚠️ 환경 클럭 불일치 — 로컬 vs GAS 서버 날짜 1일 차
- **증상**: 카톡 거래 기록 시 GAS `Utilities.formatDate(new Date())`가 **2026-06-12**를 반환. 같은 시각 로컬 Mac `TZ=Asia/Seoul date`·GitHub Actions 타임스탬프는 **2026-06-11**. memory currentDate는 2026-06-12.
- **영향**: "날짜 미지정 → 받은 날" 기본값이 GAS 서버 기준이라, 기록 날짜가 로컬 인식과 1일 다를 수 있음. 거래일 의존 로직(리포트·휴장판정)은 모두 GAS 기준이라 내부 일관성은 유지.
- **대응**: 날짜 민감 기록은 사용자에게 날짜 확인. 미해결(환경 특성) — 기록만.

---

## 2026-06-09

### GitHub Actions schedule도 best-effort — 텔레그램 푸시 21회 중 2회만 실행
- **증상**: 6/8·6/9 거래일에 텔레그램 푸시가 듬성듬성. cron `5,25,45 0-6 * * 1-5`(KST 09:05~15:45, 거래일당 21회 예상)인데 `gh run list --workflow=telegram-push.yml` 전체 기록이 6건뿐 — 6/8 schedule 2건(`04:57Z`·`09:53Z`), 6/9 2건(`04:19Z`·`08:05Z`), 나머지는 수동.
- **결정적 단서**: 실행 시각이 격자(`:05/:25/:45`)·윈도우(UTC 00:05~06:45)에서 벗어남. `09:53Z`는 cron 최대시각 06:45Z를 3시간 초과 → GitHub이 누락분을 지연·coalesce 실행한 흔적. 2 거래일 연속 ~2/21 = 우연 아님.
- **원인**: **GitHub Actions `schedule` 이벤트도 best-effort** — 정시 발화 보장 없음, 고부하 시 지연·드롭. [[feedback_routine_sandbox_limits]] 계열의 "외부 스케줄러 신뢰성" 문제.
- **함정 (중요)**: 2026-06-05 errors에서 *GAS 트리거 best-effort* 문제의 해결책으로 GitHub Actions를 "신뢰 시계"로 도입했는데, **그 GitHub Actions cron이 같은 종류의 누락**을 보임. 즉 best-effort 스케줄러를 다른 best-effort 스케줄러로 바꾼 것.
- **해결 (2026-06-09, F 구조 채택)**: 프레임 전환 — "21번 정시 외부 시계 찾기" → **"외부 의존을 21→1로 줄이기".** GitHub은 "잡 시작"만 담당하고, 잡 내부 `sleep` 루프가 5분마다 GAS `pushPnL` poke. 루프 내부 sleep은 OS 시계라 정시(실측 run 27202390183으로 증명). 카덴스·휴장·중복은 GAS `tgPushPnL`의 **18분 dedup**(`tg_lastPushEpoch`)이 단일 권위로 결정 → ~20분. redundancy 3종(중복 시작 틱·2 shift·겹치는 잡)으로 시작 드롭·6h 상한·러너 사망 흡수, GAS dedup이 겹침 무해화. **연결 위험 0**(GitHub→GAS는 입증, PoP 403은 ANYONE_ANONYMOUS라 stale). 설계: `docs/plans/2026-06-09-텔레그램-스케줄러-신뢰성.md`. **잔여 실측(6/10)**: GitHub의 일일 *시작* 적중 + 6h 루프 사망 빈도.
- **함정 회피 (Cloudflare)**: "Cloudflare cron으로 교체" 후보는 errors.md 2026-05-31 **PoP IP→GAS 403** 전례 때문에 *연결 게이트* 미통과 위험 → best-effort(견딜만)를 0건 전달(치명)과 맞바꾸는 함정. F는 연결 입증된 GitHub을 유지하므로 이 함정 회피.
- **🔴 6/10 실측 결과 — 시작 드롭 발생**: 6/10(수) 09:41 KST에 telegram-push가 **종일 미발화**(market-report는 같은 schedule인데 00:20Z 발화 → 워크플로별 확률적 드롭). 원인: 시작 틱 4개가 **2시각(09:00·09:03, 12:30·12:33)에 몰려** GitHub이 아침 윈도우 통째 드롭 시 전멸. **수정 (2026-06-10)**: cron을 `0,20,40 0-6 * * 1-5`(20분 간격 전 시간대 spread) + 루프 120분으로 변경 → 한 윈도우 드롭돼도 다음 틱이 ~20분 내 시작, 잡 1개가 6틱분 겹쳐 커버(연속 5드롭까지 공백 0). 당일은 수동 dispatch로 복구. **그래도 GitHub은 best-effort라 아침 장시간 드롭 시 첫 푸시 지연 가능** — 완전 정시는 Cloudflare Worker cron(인증 필요)으로만.
- **🔴 6/10 밤 추가 실측 — spread도 반증 → daisy-chain 전환**: spread 수정 push(00:48Z) 이후 잔여 schedule 틱 **18개 중 2개만 발화**(`05:15Z`·`09:02Z`, 둘 다 격자 이탈 지연 발화) — "다음 틱 ~20분 내 시작" 전제 자체가 이 repo에서 성립 안 함. 같은 날 market-report(저빈도 cron 4개)는 전부 발화(단 1.5~3.8h 지연) → **고빈도 cron일수록 통째 드롭** 패턴. **해결 (2026-06-10 밤)**: **daisy-chain** — 각 run이 120분 루프 후 종료 직전 `gh workflow run`으로 다음 run self-dispatch(workflow_dispatch는 GITHUB_TOKEN 재귀방지의 명시 예외 + 이벤트 구동이라 6/8~10 드롭 실측 0건). `concurrency` group이 체인 증식 차단(잉여 run은 pending 1개로 수렴), cron은 체인 사망 시 재시드 백업으로 강등 → **정상상태 best-effort 의존 0회**. GAS v13: poke 응답에 `result`(sent/skip-dedup/skip-offhours…) 에코 — GitHub 로그만으로 발송/스킵 적중률 측정. 완전 정지는 `gh workflow disable`(run 취소만으론 cron이 재시드). 설계: `docs/plans/2026-06-10-텔레그램-daisy-chain.md`.
- **교훈**: "스케줄 cron이 있다" ≠ "정시에 돈다". GAS든 GitHub든 무료 스케줄러는 발화 보장 없음 — 도입 후 **실행 로그로 적중률을 측정**해야 신뢰성 주장 가능. 측정 없는 "잘 됨"은 추측. + best-effort 시계를 못 고치겠으면 **의존 횟수 자체를 줄여라**(N번 정시 → 1번 시작 + 내부 정시 루프 → 체인이면 0번).

### 텔레그램 푸시 손익이 +0원/직전값 — tgPushPnL이 부분 갱신만 해 추이기록 AD2가 stale (2026-06-10)
- **증상**: 6/10 장중 텔레그램 손익 푸시의 *합계*가 +0원(또는 직전값). 사용자가 시트에 들어가니(=전체 갱신 발생) 제대로 계산됨.
- **원인**: `tgPushPnL`이 속도 위해 **부분 갱신**(`updateNewPriceHistory` + `updatePositionFromLedger`)만 함. 그런데 푸시가 표시하는 *합계*(`_tgFormatPnL`→`newMobileGetPortfolio`의 `trendTotalProfit`)는 **추이기록 AD2**(MobileAPI.js:69)에서 옴 → AD2는 `logToTrendSheet`가 쓰는데 그건 **`updateAllNew`에만** 있음(Main.js:113). 부분 갱신은 `logToTrendSheet`·`updateFxRates`를 건너뛰어 AD2·환율이 stale → 합계가 0/직전값. (오늘 손익 `dayChangAmount`는 `computeStockMetrics`가 `updatePositionFromLedger` 끝(NewSystem.js:631)에서 갱신돼 정상이었음 — 그래서 합계만 틀림.)
- **해결 (2026-06-10)**: `tgPushPnL`·`tgRefreshAndPush`를 부분 갱신 대신 **`updateAllNew()`**(시간 트리거·⚡버튼과 동일 전체 경로) 호출. `logToTrendSheet`는 시간 트리거가 이미 하루 8회 부르는 idempotent 함수라 푸시(~22회)도 안전. v11 배포(push_safe + API로 버전 고정 배포 v10→v11). dedup(18분)으로 빈도는 동일.
- **교훈**: "푸시가 X를 갱신한다" ≠ "푸시가 보여주는 값 Y가 X에서 온다". 표시 필드의 *실제 출처 시트*를 역추적해야 함. 부분 갱신 최적화는 표시 값이 그 부분에서만 오는지 확인 후에만. walk-through(합계←AD2←logToTrendSheet←updateAllNew)가 이걸 잡음.

### `git push 2>&1 | tail -1`이 push 실패를 가림 — dry_run이 옛 코드로 돎 (2026-06-10)
- **증상**: KR 리포트 새 프롬프트를 commit·push했다고 믿고 dry_run 검증했는데 **옛 형식**이 생성됨. 본문이 직전 리포트와 동일.
- **원인**: 커밋 명령을 `(git push -q 2>&1 | tail -1 || fallback)`로 작성. **파이프의 exit code는 마지막 명령(`tail`)의 것** → `git push`가 non-fast-forward로 *거부돼도* `tail` 성공(0)이라 `|| fallback`이 안 돌고 "pushed"가 찍힘. origin/main은 옛 커밋 그대로 → 워크플로가 옛 prompt 체크아웃.
- **검증**: `git rev-parse origin/main` ≠ 로컬 HEAD, `git show origin/main:파일 | grep -c 신규문자열` = 0으로 확정.
- **해결**: push는 파이프 없이 `git push origin main; echo "exit=$?"`로 **실제 exit code 확인**. 또는 `set -o pipefail`. 원격 반영은 **fetch 후 origin/main 내용 직접 grep**으로 검증(주장 검증 절차).
- **교훈**: "커밋·push 했다"는 사실 주장 → 같은 턴에 `git rev-parse origin/main` + 원격 파일 grep으로 검증. 파이프로 감싼 git 명령의 exit code 신뢰 금지.

### KR 시장 리포트 2차 run push 충돌 + cron ~4.5h 지연
- **증상**: 6/8 KR 리포트 run `27138650428` 실패 — `git push` rejected (`! [rejected] main -> main (fetch first)`).
- **원인**: 2회 안전망(`2 8`/`42 8` UTC = 17:02/17:42 KST)이 둘 다 GH 스케줄러 지연으로 `12:38Z`/`12:47Z`(21:38/21:47 KST)에 **~4.5h 늦게**, 9분 차로 거의 동시 실행. 1차(`27138171789`)가 파일 커밋하기 전에 2차도 "파일 없음"으로 판단해 재생성·push → 1차가 먼저 push해 2차 rejected. 리포트는 1차가 정상 전달·커밋(사용자 영향 없음).
- **해결**: 미적용. 후보 — push 직전 `git pull --rebase` 재시도, 또는 파일존재 dedup 체크를 push 직전으로 이동. 근본은 위 GH 스케줄러 지연과 동일 뿌리.
- **교훈**: 안전망 2회 실행 설계는 "둘이 시간상 떨어진다"를 전제로 하는데, 스케줄러 지연이 그 간격을 0으로 만들면 레이스. 멱등 보장(파일 락·push 재시도)을 시각 간격에 의존하지 말 것.
- **🟡 6/9·6/10 연속 지연 (2026-06-10 기록)**: 양일 모두 US cron(23:02/23:42Z)이 00:11~01:51Z(+1~2h), KR cron(08:02/08:42Z)이 11:22~11:55Z(**+3.3~3.8h**) 발화 — KR 리포트가 17:02 예정인데 **~20:50 KST 도착**. "40분 2회" 안전망은 *드롭*은 막지만 *지연*은 못 막음(둘 다 같이 밀림). 장 마감 직후 의사결정 지원이라는 목적 대비 가치 저하. **후속 후보**: telegram-push daisy-chain(6/10 도입)이 검증되면 같은 메커니즘으로 정시화 — 예: 체인 run이 17:02 KST 통과 시 market-report를 dispatch. 체인 1+ 거래일 실측 후 결정.

## 2026-06-06

### GAS 웹앱에 `curl -X POST`로 호출 시 HTTP 405 + Drive "페이지 없음"
- **증상**: GitHub Actions가 GAS 웹앱 `action=pushPnL` 호출 시 `HTTP 405` + `<title>Page Not Found</title> Sorry, unable to open the file at this time` (Google Drive 에러 HTML). GET은 `오류: 다음 스크립트 함수(doGet)를 찾을 수 없습니다`(=URL 정상, 익명 접근 OK, doGet만 없음).
- **원인**: GAS 웹앱은 POST→**302 리다이렉트**→`script.googleusercontent.com/.../echo`로 결과 회수. `curl -L -X POST`는 `-X POST`가 **리다이렉트까지 POST로 강제** → echo 엔드포인트가 POST 거부 → 405 + Drive 페이지. doPost 자체는 초기 요청에서 이미 실행됨(결과만 못 받음).
- **해결**: `-X POST` **제거**. `--data`만 쓰면 초기 요청은 POST(doPost 실행), `-L`은 302를 GET으로 따라가 결과 회수. → `curl -sS -L --data '{...}' -H 'Content-Type: application/json' "$URL"` → `HTTP 200 {"success":...}`.
- **검증**: 더미 secret POST → `{"success":false,"error":"forbidden"}`(URL·라우팅·새 코드 다 정상 확인). [[feedback_gas_curl_diagnosis]] 계열.
- **교훈**: GAS 웹앱 POST는 절대 `-X POST` 쓰지 말 것. Drive "페이지 없음"은 *URL 오류*처럼 보이지만 실제론 *리다이렉트 메서드* 문제일 수 있음 — GET으로 URL 생존 먼저 확인.

## 2026-06-05

### 텔레그램 푸시가 11:14 이후 종일 끊김 — GAS 시간 트리거 best-effort 누락
- **증상**: 장중 텔레그램 손익 푸시가 11:14에 마지막으로 오고 14:45까지 안 옴. "마이그레이션(halcyon→halcyon_m1) 때문?" 의심.
- **오답 후보 (전부 배제)**: ① 마이그레이션 — GAS·GitHub Actions 둘 다 클라우드라 로컬 사용자명 무관 ② 코드 변경 — Telegram.js 5/28 이후 무변경 ③ 휴장 오판정 — 방금 메시지 와서 `_mIsTradingDay()`=true 확정 ④ 락 경합 — 그럼 실행 로그에 짧은 Completed 찍혀야 함 ⑤ 권한/KIS — `ㄱㄱ` 수동 푸시 정상.
- **결정적 진단 (Apps Script 실행 로그)**: `tgPushPnL` 실행이 `10:45·11:07·11:13` → **11:13~14:45 약 3.5h 완전 부재** → `14:45·15:07·15:13` 재개. 에러율 0%. **`scheduledHourlyUpdate`도 같은 구간 누락**(`11:26`→`14:56`). 즉 그 시간 *모든 시간 트리거가 발화 자체를 안 함* (실패도 skip도 아닌 부재).
- **원인 확정**: **GAS time-based 트리거는 best-effort** — Google이 정시 발화를 보장하지 않고 플랫폼 사정에 따라 수십 분~수 시간 지연·누락. 무거운 트리거(우리 푸시는 매 회 KIS 전체 갱신해 22~83초)일수록 취약. 자동 복구됨.
- **해결 (2026-06-06)**: 시간 트리거 폐기 → **GitHub Actions가 신뢰 시계**가 되어 GAS 웹앱 `action=pushPnL`(`_tgHandlePushPost`→`tgPushPnL`)을 20분마다 호출. GAS 웹앱은 *요청 구동*이라 트리거 누락과 무관(ㄱㄱ가 증거). 시장 리포트는 40분 간격 2회+중복방지로 창 안 도착 보장. 구성: `telegram-push.yml`, `market-report.yml` 개정.
- **교훈**:
  - GAS 트리거 안 돌 때 = 트리거 페이지 "마지막 실행"·에러율만 보지 말고 **실행(Executions) 로그에서 그 시간 발화 *부재* vs *실패* 구분**. 부재면 GAS 플랫폼 누락(코드 무관).
  - 고장난 건 GAS '트리거'지 GAS '웹앱'이 아님 — 신뢰 가능한 외부 cron(GitHub Actions)이 웹앱을 부르면 트리거 불안정성 우회.
  - "최근 안 오던 게 방금 왔다" = 결정적 단서. 결정론적 원인(휴장 등) 배제됨 → 간헐/누락 계열로 좁힘.

## 2026-05-29

### claude.ai routine → Cloudflare Worker도 차단됨 (Anthropic 샌드박스 TLS Inspection 차단 — 최종 진단)
- **증상**: routine이 Worker URL POST 시 `HTTP 403 Host not in allowlist` + Cloudflare 헤더 `x-deny-reason: host_not_allowed`. Worker 코드의 IP 검사 없는데도 403.
- **결정적 진단**: routine 환경에서 curl verbose 로그 분석 → TLS 인증서 issuer `O=Anthropic; CN=sandbox-egress-production TLS Inspection CA`
  - 즉 Anthropic 샌드박스가 **모든 HTTPS outbound를 TLS Inspection proxy로 가로챔**
  - **Cloudflare가 그 Anthropic proxy IP를 anti-abuse로 차단** → 모든 Worker 진입을 *Worker 실행 전*에 거부
- **원인 확정**:
  - GAS 차단(어제 1차 진단) + Worker 차단(오늘 2차 진단) 둘 다 동일 메커니즘
  - Worker 코드 어떻게 수정해도 무용 — Cloudflare 진입 단계에서 403
  - "Worker proxy로 우회" 가설은 *PoP IP 문제*로 추측했으나 실제론 *Anthropic sandbox egress CA 자체*가 차단 대상
  - 한국 IP 노트북 curl은 일반 IP라 통과 — 미국 routine 환경만 차단
- **해결 (2026-05-31 최종 채택)**: **routine이 Telegram Bot API를 직접 호출**. Telegram API endpoint(`api.telegram.org`)는 Anthropic 샌드박스 통과 가능 (직접 검증). Worker·GAS 모두 거치지 않음
  - routine prompt에 BOT_TOKEN + CHAT_IDS 박음 + Python urllib로 sendMessage (Markdown → fallback plain text)
  - 시트 *시장리포트_큐* 자동 적재 X — Telegram 채팅이 이력. 시트 큐는 사용자 수동 발송용으로만 유지
  - Worker proxy는 Telegram→GAS webhook(워치 손익) 용으로 그대로 유지 (그건 한국 IP 경로라 정상)
- **추가 발견 — 데이터 수집 단계**: Yahoo Finance도 routine 환경 IP를 403 차단. **한국 경제매체(인포맥스·한경·매경·머니투데이)의 '뉴욕증시 마감' 종합 기사**가 routine 환경에서 통과하는 깨끗한 소스. Stooq.com이 raw 숫자 백업.
- **교훈**:
  - claude.ai routine은 일반 클라이언트가 아닌 *Anthropic 샌드박스 환경*에서 실행. 그 환경의 outbound는 Anthropic TLS Inspection proxy를 거침. 일부 anti-abuse 시스템(Cloudflare, Google, Yahoo 등)이 그 proxy IP를 차단
  - **"내 호출은 OK인데 routine은 fail" 패턴 시 = outbound proxy 차이 우선 의심**. UA·헤더·코드보다 먼저
  - Web automation에서 *우회 가능한 endpoint*: 명확히 공개 API + IP/UA 검사 약한 곳 (Telegram Bot API 등)
  - 가설 검증 시 routine 환경에서 *curl -v* 또는 *TLS 인증서 검증*이 결정적 — 우리는 7차 시도 후에야 발견

### Cloudflare PoP IP가 GAS Web App에서 차단 — Worker → GAS 우회 영구 불가 (확정)
- **증상**: routine → Worker URL POST → Worker가 GAS forward 시도 → `HTTP 403 Host not in allowlist`. User-Agent 명시·헤더 정리 등 어떤 코드 수정으로도 우회 불가.
- **원인 (확정)**:
  - Worker는 *호출자에 가장 가까운 Cloudflare PoP*에서 실행되며, fetch outbound는 그 PoP의 IP에서 나감
  - routine은 미국 (Anthropic 서버)에서 호출 → Worker가 미국 PoP에서 실행 → 미국 outbound IP로 GAS 호출 → **Google anti-abuse가 차단**
  - 사용자 한국 노트북 curl 호출 → Worker가 서울 PoP에서 실행 → 한국 IP로 GAS 호출 → 정상 통과
  - 같은 Worker 코드인데 *실행 PoP에 따라* GAS 응답이 다름. PoP·outbound IP는 강제 변경 불가
- **시도한 fix들 (모두 실패)**: User-Agent를 Mozilla로 변경, Accept 헤더 추가, redirect follow 명시 — IP 문제라 헤더 무관
- **해결 (2026-05-31 채택)**: Worker가 routine 시장 리포트 요청을 받으면 **GAS 대신 Telegram Bot API 직접 호출**. Telegram API는 모든 IP 허용 → 미국 PoP에서도 정상 발송. 시트 자동 적재는 포기 (Telegram 채팅이 이력)
- **부수 영향**:
  - Worker는 두 가지 경로 분기: body action이 `addMarketReport`면 Telegram 발송, 그 외(워치 webhook 등)는 기존 GAS forward
  - 워치 손익 알림(워치→Telegram→Worker→GAS)은 한국 IP 경로라 그대로 작동
  - 시트 *시장리포트_큐* 큐 시스템은 *사용자 수동 발송용*으로만 유지 (메뉴 즉시 발송)
- **교훈**:
  - **Cloudflare Workers의 fetch egress IP는 *호출자 위치 따라 결정* 되고 강제 변경 불가**. 지역 기반 차단 우회 옵션은 유료 (Static Egress IP) 또는 다른 인프라(GCP/AWS 한국 region) 셋업
  - "Host not in allowlist" 응답은 Google App Engine/Apps Script anti-abuse의 표준 메시지. *우리 측 코드·설정 모두 정상이어도 IP 만으로 차단됨*
  - 인프라 진단 시 "내 호출은 되는데 다른 곳 호출은 안 됨" 패턴은 **outbound IP 차이를 먼저 의심** (UA·헤더보다 우선)

### routine이 prompt 무시하고 가이드 파일의 옛 URL 사용 → "Worker가 IP 차단"으로 오진단
- **증상**: routine prompt에 Worker URL + "GAS 직접 호출 금지" 명시했는데도 1차 update 후 run에서 또 403 받음. routine 보고: "Cloudflare Worker가 routine IP를 차단"
- **원인**:
  - routine이 `docs/market-report-routines.md` Read 후 가이드의 GAS URL(`script.google.com/.../exec`)을 사용 — prompt Step 4의 Worker URL을 무시
  - 받은 403의 응답 본문은 `"Host not in allowlist"` ← **GAS가 응답하는 문자열**. Worker는 secret 불일치 시 `'forbidden'` 응답하므로 다름
  - 즉 routine이 호출한 곳은 GAS이고, 그것을 Worker 탓으로 잘못 진단·보고
- **검증**: 로컬에서 같은 Worker URL로 curl POST → 200 OK · 시트 적재 정상. Worker는 IP allowlist 없음 (worker.js 코드에 `request.headers.get` secret 검증만 있음)
- **해결**: routine prompt 강화 — (a) "절대 규칙" 섹션 맨 위에 GAS URL 금지 명시, (b) "가이드 Read 권장 안 함, prompt 절대 우선", (c) 가이드 파일 자체도 Worker URL로 갱신해 충돌 제거, (d) 실패 보고 시 *실제 호출한 URL* 명시 의무화
- **교훈**:
  - **routine prompt가 외부 파일을 Read하게 두면 prompt vs 파일 충돌 발생 가능**. self-contained 권장. 가이드 Read는 보조 정도로만
  - **routine의 실패 진단 보고를 곧이곧대로 믿지 말 것** — Claude가 자기가 한 행동을 잘못 분석할 수 있음. 응답 본문·실제 호출 URL을 명시하라고 prompt에서 강제
  - 응답 403의 본문 문자열이 어느 layer에서 왔는지(Worker `'forbidden'` vs GAS `"Host not in allowlist"`) 비교가 layered proxy 디버깅의 결정적 단서

### claude.ai routines → GAS Web App 403 "Host not in allowlist"
- **증상**: claude.ai routine 환경에서 `script.google.com`에 GET/POST 모두 403 "Host not in allowlist" 응답. GAS doPost 도달 전 Google 인프라 차원 거부. 어제 등록한 시장 리포트 routine 2개가 리포트 작성 후 POST 단계에서 실패
- **원인**: claude.ai routine 실행 컨테이너(Anthropic 클라우드)의 IP 대역이 Google Apps Script Web App의 allowlist에 없음. **GAS 코드·인증·oauthScopes 모두 무관** — Anthropic IP 자체 차단. routine 외 환경(로컬·Cloudflare·일반 인터넷)에선 정상 동작
- **해결**: 기존 Cloudflare Worker (`apps-script-v2/cloudflare-worker/worker.js`)를 routine → GAS proxy로 재사용. Worker는 globally distributed라 Google allowlist에 포함된 IP에서 forward. Worker 코드 변경 0줄 — 이미 단순 forward 구조 (헤더 검증 후 body 그대로 GAS로). routine 프롬프트의 POST URL을 GAS `/exec`에서 Worker URL로 변경 + `X-Telegram-Bot-Api-Secret-Token` 헤더 추가하면 끝
- **교훈**:
  - **claude.ai routine은 GAS Web App을 직접 호출할 수 없다.** 우회 proxy (Cloudflare Worker 등) 필수
  - 이미 있는 Telegram Worker proxy를 다른 용도(시장 리포트 적재)로도 재사용 가능 — 같은 인증 체계 + 단순 forward 구조 덕분
  - 새 외부 시스템에서 GAS doPost를 호출하는 모든 경우 같은 문제 가능성 — IP allowlist 차단을 우선 의심

### "You do not have permission to call UrlFetchApp.fetch. Required permissions: http"
- **증상**: 시트 ⚡ 전체 업데이트 또는 트리거 실행 시 마지막 갱신 실패 메시지에 `Required permissions: http`. 시각 09:13에 발생 (정규 트리거 슬롯 아님 — 사용자 수동 클릭 추정)
- **원인**: `appsscript.json`에 `oauthScopes`가 명시되어 있지 않으면 GAS가 스코프를 *자동 추론*. 평소엔 작동하나 **새 deployment 생성·권한 동의 흐름 리셋 시 추론 스코프에서 `script.external_request`(UrlFetchApp 권한)가 누락되는 경우 발생**. 2026-05-28 시장 리포트 큐 인프라 추가로 새 deployment 생성한 것이 트리거
- **해결**: `appsscript.json`에 `oauthScopes` 명시 (`spreadsheets`·`script.external_request`·`script.scriptapp`·`calendar.readonly`·`userinfo.email`) + `push_safe.py` 재배포 + 사용자가 Apps Script 에디터에서 UrlFetchApp 호출 함수 1회 실행해 권한 재승인
- **교훈**:
  - 새 deployment 생성 시 권한 동의 흐름이 리셋될 수 있음. `oauthScopes` 명시는 GAS 프로젝트 기본값으로 둘 것
  - "Required permissions" 메시지가 보이면 스코프 누락 또는 동의 만료 — `appsscript.json` 점검이 first stop

---

## 2026-05-28

### `deploy-web.yml` 수동 trigger 후 `/desk/` 폴더 통째로 삭제 (404)
- **증상**: web (PWA) 만 배포했는데 `https://ejunwon-lab.github.io/FD5to6/desk/` 가 404. desk hash 자체가 fetch 안 됨
- **원인**: `peaceiris/actions-gh-pages@v4` 의 *기본 동작*은 `publish_dir` 내용으로 gh-pages 브랜치 *전체 덮어쓰기*. `deploy-web-desk.yml` 은 `keep_files: true` + `destination_dir: desk` 로 desk/ 하위만 갱신·기존 보존인데, `deploy-web.yml` 은 *둘 다 없이* gh-pages 루트 덮어쓰기 → desk/ 폴더 통째 삭제
- **해결**:
  - `deploy-web.yml` 에 `keep_files: true` 추가 → 향후 web 배포 시 desk/ 등 서브 deployment 보존
  - `deploy-web-desk` workflow 수동 trigger (`gh workflow run deploy-web-desk.yml --ref main`) → `/desk/` 복원
- **참고 사고 (별건)**: `peaceiris/actions-gh-pages@v4` action 다운로드가 `codeload.github.com` 일시 장애로 3회 fail. 30~60분 두고 재시도하니 회복. *GitHub 인프라 일시 장애 패턴* — 같은 commit SHA가 캐시 미스되면 가끔 발생, 시간 두고 재시도가 정답

---

## 2026-05-26

### 시계열 그래프에 주말·공휴일이 표시되는 문제 (errors.md 2026-05-17 같은 패턴 확장)
- **증상**: 대시보드/데스크 차트 (equityCurve·IndicatorHistory·priceHistory) X축에 토·일·공휴일이 그대로 노출되어 시각 노이즈 + Benchmark 차트 등에서 date 매칭 어긋남
- **원인**: GAS 응답에서 비거래일 행을 drop하지 않음. 2026-05-17에 *현재가_이력*은 처리됐지만 다른 시계열 endpoint는 미처리
- **해결**: 3개 시계열 endpoint에 `_isTradingDateStr(dateStr)` (Holidays.js의 *휴장일* 시트 + 토/일 체크) filter 추가 — 시트는 그대로, 응답에서만 drop
  - `newMobileGetProfitHistory` (추이 기록 → equityCurve)
  - `newMobileGetIndicatorHistory` (참고지표_히스토리)
  - `newMobileGetStockDetail` priceHistory (안전망)
- **영향**: 4개 클라이언트 (web-desk·web·iOS·Telegram) 모두 자동 혜택. *추이 기록* 시트 자체는 보존 → 데이터 손실 0

---

## 2026-05-23

### Telegram webhook 간헐 실패 — Telegram이 GAS 302 redirect를 안 따라감 (Cloudflare Worker proxy로 해결)
- **증상**: webhook URL·access·doPost 모두 정상인데 "ㄱㄱ" 메시지에 *간헐적으로만* 응답. `getWebhookInfo`에 `last_error: Wrong response from the webhook: 302 Moved Temporarily`. pending_update_count 누적
- **원인**: GAS Web App POST는 항상 `googleusercontent.com/macros/echo?user_content_key=...`로 302 redirect 응답. Telegram의 webhook 전송 클라이언트가 이 redirect를 *때때로* 안 따라감 → 302를 final response로 간주해 에러 기록 → backoff
- **확정 진단**:
  - Python urllib·Node fetch·CF Workers fetch (WHATWG fetch spec 준수) → POST → 302 follow → 200 + 'forbidden'/'ok'
  - curl `-L --post302` → 405 `allow: HEAD, GET` (curl이 redirect target에 다시 POST 보내는데 그 endpoint는 GET만 허용 — **이게 진단 1시간+ 헛돌이의 원인**)
- **해결**: Cloudflare Worker proxy 도입
  - Telegram → Worker(secret_token 헤더 검증) → GAS /exec(redirect:'follow') → 200 → Telegram에 직결
  - Worker 코드 30줄, 무료 티어로 충분, 비용 0
  - 셋업: `apps-script-v2/cloudflare-worker/README.md`
- **추가 함정 — Cloudflare secret deploy gotcha**:
  - Settings에서 secret 추가하면 **새 version만 만들고 active deployment는 옛 버전 유지**. UI에 "deploy required" 알림 없음
  - 진단: Deployments 탭 → Version History에서 "Add secret: ..." version에 파란 막대(active) 없음 → 수동 promote 필요
  - 해결: 최신 version 우측 `···` → "Deploy this version"
- **교훈**:
  - **GAS Web App 디버깅에 curl 결과 단독 신뢰 금지**. Python urllib·Node fetch·등 spec 준수 클라이언트로 교차 검증 ([[feedback_gas_curl_diagnosis]])
  - Telegram webhook + GAS Web App 조합은 *간헐적으로 깨짐* — 신뢰성 필요하면 Cloudflare Worker 같은 proxy 필요
  - Cloudflare Workers: secret 변경 후 반드시 Deployments 탭에서 최신 version active 확인

---

### Telegram webhook 302/405 — appsscript.json `webapp.access: MYSELF`가 익명 POST 차단
- **증상**: webhook 등록은 성공("Webhook was set")하지만 Telegram에서 "갱신" 보내도 응답 없음. `getWebhookInfo`에 `last_error: Wrong response from the webhook: 302 Moved Temporarily` + `pending_update_count` 누적
- **검증**:
  - GET 익명 호출(시크릿 브라우저)은 정상 → "doGet 함수 없음" 페이지 (deployment 살아있음)
  - POST는 302 → googleusercontent.com/macros/echo → 405 `allow: HEAD, GET` (POST 차단)
  - **결정적 진단**: curl의 `--post302`는 redirect 처리에서 405를 보이지만, Python urllib(RFC 준수 redirect-following)로 같은 URL POST 치면 **200 + 'forbidden'** — doPost가 실제로 실행됨을 확인. 즉 deployment에 따라 다름
- **원인**: `appsscript.json`의 `"webapp": {"access": "MYSELF"}` — GAS Web App 배포 시 manifest의 access 값이 deployment에 캡쳐됨. UI에서 "모든 사용자"로 설정해도 deployment 메타데이터의 access는 manifest 값을 따라가는 비대칭 동작 (GET은 풀리지만 POST 라우팅은 manifest 우선)
- **해결**:
  1. `appsscript.json` → `"webapp": {"access": "ANYONE_ANONYMOUS", "executeAs": "USER_DEPLOYING"}` 로 변경
  2. push (manifest 갱신)
  3. **새 deployment 생성** ("새 배포" — 기존 편집 X). 기존 deployment는 만들어진 시점의 access 값에 묶여있어 변경 안 됨
  4. 새 URL을 Properties `TG_WEBAPP_URL`로 교체 후 `tgInstallWebhook` 재실행
- **부수 방어선** (이번에 함께 도입):
  - `tgInstallWebhook`이 자동 감지된 URL이 /dev면 거부, /exec만 사용 (`ScriptApp.getService().getUrl()`이 에디터 컨텍스트에서 /dev 반환하는 별개 함정)
  - `tgEnsureWebhookHealthy` — `getWebhookInfo`로 상태 점검 → 비정상 시 자동 재등록 (5분 throttle), 30분 트리거 + 모든 진입점 안전망
- **교훈**:
  - GAS Web App **익명 POST 필수** 시 `appsscript.json`의 `access: ANYONE_ANONYMOUS` 명시. UI 설정과 manifest 값이 어긋나면 POST만 미묘하게 차단됨
  - **GAS Web App 디버깅 시 curl은 신뢰 금지**. `--post302`나 default redirect 변환이 RFC와 다르게 동작해 405를 만들어내 진짜 원인을 가림. Python urllib·requests 같은 표준 클라이언트로 교차 검증
  - "head 코드와 deployment 코드 별개" 원칙이 *manifest*에도 적용됨 — manifest를 push해도 기존 deployment의 권한·실행 사용자 메타데이터는 안 바뀜. **새 deployment 생성 필수**

---

### Telegram webhook 무한 루프 — 무거운 갱신 + update_id 중복 미처리
- **증상**: Telegram 봇에 "갱신" 1번 보냈는데 봇이 손익 메시지 + "갱신중..." 무한 반복. 사용자가 "그만" 보내도 멈추지 않음
- **원인 1**: `tgRefreshAndPush`가 `newMobileUpdateAll()` 호출 → KIS 가격 + 보유현황 + 대시보드 + 추이 전체 갱신 → 30초+ 소요 → Telegram이 webhook 응답 못 받고 같은 `update_id`로 retry → GAS doPost가 또 처리 → 무한 루프
- **원인 2**: doPost가 `update_id`를 검사하지 않아 retry된 update를 새 메시지로 처리
- **원인 3 (별도 함정)**: Web App deployment는 *배포 시점의 코드*를 영구히 실행. `clasp push` 후 새 deployment를 만들거나 "배포 관리 → 신규 버전"으로 갱신해야 새 코드 반영. 시간 트리거(`tgPushPnL`)는 head 코드를 직접 실행하므로 무관
- **해결**:
  1. `update_id` 중복 제거 — PropertiesService에 마지막 처리한 ID 저장, 같으면 즉시 ok 반환
  2. `LockService.tryLock(1000)` — 동시 처리 차단
  3. 갱신 작업 경량화 — `updateNewPriceHistory` + `updatePositionFromLedger`만 (대시보드 렌더·`logToTrendSheet` 생략)
  4. `setWebhook` 옵션에 `max_connections:1`·`drop_pending_updates:true`
  5. 코드 수정 후 **"배포 관리 → 신규 버전"** 실행 (이 단계 누락이 1차 수정이 안 먹은 직접 원인)
- **교훈**:
  - GAS doPost가 외부 webhook을 받으면 retry 가능성 항상 고려 → update_id/event_id 같은 멱등 키 필수
  - Web App 코드 수정은 `clasp push`만으론 반영 안 됨. deployment 버전 갱신 또는 신규 deployment 필요. **head 코드(시간 트리거·`scripts.run`)와 deployment 코드(`/exec`)는 별개**
  - 외부에서 호출하는 webhook 핸들러는 응답 빠르게(<10초) 만들고, 무거운 작업은 트리거로 분리하거나 락으로 직렬화

---

## 2026-04-27

### iOS 콜드 런치 "더 이상 사용할 수 없음" — 번들 ID 변경 후 구 앱 잔존
- **증상**: 앱 아이콘 탭 시 "Finance를 더 이상 사용할 수 없음" 다이얼로그. Xcode 실행·앱 스위처 재개는 정상
- **원인**: 번들 ID 변경(`com.jun` → `com.junwon`) 시 Xcode가 새 앱만 설치하고 구 앱은 삭제하지 않음. 홈 화면에 두 개의 Finance 앱이 생겨, 탭하던 아이콘이 만료된 구 앱이었음
- **해결**: 기기에서 구 앱 직접 삭제
- **교훈**: 번들 ID 변경 시 빌드 전에 기기에서 기존 앱 먼저 삭제 안내 필수

### iOS 서명 설정 누락 — XcodeGen 재생성 시 CODE_SIGN_STYLE 유실
- **증상**: 콜드 런치 실패 (위 에러와 복합)
- **원인**: XcodeGen 재생성 시 project.yml에 없던 `CODE_SIGN_STYLE = Automatic`이 pbxproj에서 삭제됨. DEVELOPMENT_TEAM도 이전 Mac 팀 ID(44DWWF283N) 잔류
- **해결**: project.yml에 `CODE_SIGN_STYLE: Automatic`, `DEVELOPMENT_TEAM: 3N9UDPW4BP` 명시
- **교훈**: XcodeGen 재생성 전 서명 설정이 project.yml에 모두 명시되어 있는지 확인

---

## 2026-04-24

### NavigationStack + PageTabViewStyle 충돌
- **증상**: 앱 실행 시 까만 화면, "Layout requested for visible navigation bar... nested navigation controllers" 로그
- **원인**: PageTabViewStyle 내부 뷰에 NavigationStack을 중첩하면 iOS가 충돌
- **해결**: 모든 뷰에서 NavigationStack 제거. `.navigationTitle`, `.toolbar` 대신 커스텀 헤더 VStack 사용
- **교훈**: PageTabViewStyle과 NavigationStack은 함께 쓸 수 없음

### pull-to-refresh CancellationError
- **증상**: 화면을 당겼다 놓으면 "Cancelled" 에러 메시지 표시
- **원인**: SwiftUI refreshable이 취소될 때 CancellationError를 throw하는데 일반 catch에서 에러로 처리됨
- **해결**: `catch is CancellationError { }` 별도 분기로 무시. `guard !isLoading` 추가로 중복 호출 방지

### Color(.separator) 컴파일 에러
- **증상**: "No exact matches in call to initializer"
- **원인**: SwiftUI의 `Color(.separator)`는 특정 버전에서 모호한 오버로드
- **해결**: `Color(UIColor.separator)`로 변경

### _IS_MOBILE_CALL 전역변수 중첩 호출 덮어쓰기
- **증상**: 앱에서 "Cannot read properties of null (reading 'alert')" 에러
- **원인**: `mobileUpdateAll()` → `runFullUpdate()` → `updateReferenceIndicators()` → `mobileGetReferenceIndicators()` 중첩 호출 시, 내부 함수의 `finally { _IS_MOBILE_CALL = false }` 가 외부 호출의 `true` 상태를 덮어씀. 이후 `runFullUpdate()`에서 `ui = null` 인데 `ui.alert()` 호출
- **해결**: `mobileGetReferenceIndicators()` 시작 시 `_prevMobileCall` 에 현재 값 저장, `finally` 에서 `false` 대신 저장값으로 복원
- **교훈**: 전역 플래그를 여러 함수가 공유할 때 중첩 호출 시 덮어쓰기 위험. 항상 이전 값을 저장·복원하는 패턴 사용

---

## 2026-04-26

### iOS 앱 타기기 설치 시 서명 에러 (0xe8008016)
- **증상**: `The executable was signed with invalid entitlements` — 설치 실패
- **원인**: `Info.plist`의 `CFBundleIdentifier`가 `com.jw.fd5to6finance`로 하드코딩되어 있었고, 코드사인은 `com.jun.fd5to6finance`로 서명 → 불일치
- **해결**: `CFBundleIdentifier`를 `$(PRODUCT_BUNDLE_IDENTIFIER)`로 변경. `project.pbxproj` 및 `BackgroundNetworkSession.swift`의 구 번들 ID도 함께 수정
- **교훈**: Info.plist의 CFBundleIdentifier는 반드시 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로 지정해야 빌드 설정과 일치함

---

## 2026-04-27 (2)

### 모바일 앱 갱신 실패 — KIS 토큰 만료 시 재발급 실패
- **증상**: 모바일 앱에서 업데이트 시 "토큰 익스파이어" 에러. 시트에서 직접 "가격 갱신" 후에는 모바일이 정상 동작
- **원인**: KIS Access Token 24시간 만료 시, Apps Script API 실행 컨텍스트에서는 토큰 재발급이 간헐적으로 실패. 시트 직접 실행은 성공하여 Properties에 저장 → 이후 모바일은 유효 토큰 사용
- **해결**: 매일 오전 8:30 `runFullUpdate` 자동 트리거 등록 (`setupDailyTrigger()`). 장 시작 전 토큰을 사전 갱신하여 모바일 호출 시 항상 유효한 상태 보장
- **교훈**: GAS를 Apps Script API로 호출할 때 외부 API 토큰 재발급이 실패할 수 있음. 직접 실행 컨텍스트와 차이가 있을 수 있으므로 시간 트리거로 사전 갱신하는 패턴이 안전

### iOS 번들 ID 불일치로 설치 실패 (0xe8008016) — 재발
- **증상**: 다른 폰에 설치 시 "The executable was signed with invalid entitlements" (0xe8008016)
- **원인**: `PRODUCT_BUNDLE_IDENTIFIER`를 `com.junwon.fd5to6finance`로 변경했으나, `Sources/Info.plist`와 `project.yml info.properties`의 `CFBundleIdentifier`가 `com.jw.fd5to6finance`로 하드코딩 → 코드서명과 불일치
- **해결**: `Sources/Info.plist`의 `CFBundleIdentifier`를 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로 변경. `project.yml`의 `info.properties`에서 `CFBundleIdentifier` 항목 제거 후 XcodeGen 재생성
- **교훈**: `CFBundleIdentifier`는 항상 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로만 지정. 번들 ID 변경은 `project.yml`의 `PRODUCT_BUNDLE_IDENTIFIER` 한 곳만 수정

---

### GAS 지표 대부분 0 반환
- **증상**: 참고지표_히스토리에서 KOSPI/KOSDAQ 외 모두 0
- **원인 1**: 미국선물 심볼 `ES=F`, `NQ=F`는 GOOGLEFINANCE 미지원
- **원인 2**: 상품 선물 `CL=F`, `GC=F`는 GOOGLEFINANCE 미지원
- **원인 3**: KIS 해외지수 API 미검증으로 SPX/NDX 등 실패 가능
- **해결**: ES/NQ → Yahoo Finance API로 변경. CL/GC → `NYMEX:CL1!`, `COMEX:GC1!`로 변경. SPX/NDX/DJI/SOX → gfSymbol fallback 추가

---

## 2026-05-17

### 대시보드 변동 라벨이 "최근"이어야 할 때 "오늘"로 표시 (iOS/웹)
- **증상**: 비거래일(일요일)에 대시보드가 "오늘 수익"으로 표시. 잠깐 정상("최근")이다가 다시 "오늘"로 바뀜. 금액도 금요일 수익이 아닌 0에 가깝게 나옴
- **원인**: `updateNewPriceHistory()`(NewSystem.js)가 거래일 여부를 확인하지 않고 *현재가_이력*에 오늘 날짜 행을 추가 → 주말에 업데이트 버튼을 누르면 비거래일 날짜 행이 누적됨. 그 결과 `priceAsOfDate`(마지막 행 날짜)가 비거래일 날짜가 되어 `decideChangeLabel`이 "오늘" 반환. `_mCalcExtras`의 변동 계산도 `주말가−금요일가≈0`으로 오염 ("작동하다 바뀜" = 캐시(정상)→fresh fetch(오염))
- **해결**: (A) `updateNewPriceHistory`에 `_mIsTradingDay()` 가드 추가 — 비거래일엔 행 미기록. (B) `priceAsOfDate`는 마지막 *거래일* 행을 역방향 스캔, `_mCalcExtras`는 비거래일 행 필터링 (`_isTradingDateStr` 헬퍼 추가). (C) 클라이언트 `decideChangeLabel`(changeLabel.ts/ChangeLabel.swift)이 비거래일이면 priceAsOfDate와 무관하게 "최근" 우선 판정
- **교훈**: 이력 시트에 거래일 데이터만 들어간다는 전제로 라벨/변동 로직이 설계됨. 시트에 쓰는 쪽에서 거래일 가드를 빠뜨리면 읽는 쪽 로직이 전부 어긋남. 데이터 소스 가드 + 읽기 측 강건화 양쪽 모두 필요

### 다계좌 보유 종목의 1주일/1달 손익이 항상 ─(빈칸)
- **증상**: *대시보드* 보유종목 현황에서 특정 종목(TIGER 차이나테크 TOP10, KODEX AI전력핵심설비 등)의 "1주일 손익"·"1달 손익"이 보유기간(11개월+)과 무관하게 계속 빈칸
- **원인**: Dashboard.js `_calcExtraColumns()`의 `txByCode`/`qtyAtDate`가 *거래_원장*을 **종목코드 단위로만** 합산. 손익 가드 `qtyAtDate(code) !== curQty`에서 `curQty`는 *보유현황* 행별 **계좌별 수량**이라, 같은 종목을 2개 이상 계좌에서 보유하면 `qtyAtDate(code)`(전 계좌 합계)와 영구 불일치 → `pnlAt`이 항상 null 반환. JUN & SOO 공동 포트폴리오라 다계좌 보유가 정상 케이스
- **해결**: `txByKey`를 `code||증권사||계좌` 단위로 키잉, `qtyAtDate(key, …)`로 계좌별 판정. (`pctAt` 기반 m1/m3/m6/y1 %는 수량 가드가 없어 원래 정상이었음)
- **교훈**: *보유현황*은 (종목,증권사,계좌) 행 단위인데 원장 집계를 코드 단위로 하면 다계좌 종목에서 어긋남. 집계 키 granularity를 소비처(curQty)와 일치시켜야 함
- **후속**: 다계좌 수정 후에도 랩 계좌(미래애셋 종합_랩 등 기간 내 거래 잦은 계좌)는 수량 변동 가드(`qtyAtDate !== curQty`)에 걸려 계속 빈칸. `pnlAt`을 **정확한 기간 손익**(오늘 평가금액 − N일전 평가금액 − 기간 내 순매수금액)으로 교체 → 수량이 변해도 올바른 값, 가드 제거. 수량 불변 종목은 결과 동일. 원장 read 8→10열 확장(금액 열 사용)

### 비거래일에 buildDashboard 시 보유종목표 확장 컬럼 전부 빈칸
- **증상**: 주말·공휴일에 *대시보드* 갱신하면 당일 등락·당일/1주/1달 손익 컬럼이 전 종목 ─
- **원인**: Dashboard.js `_calcExtraColumns`·`_calcTodayProfit`이 "오늘 날짜 행"이 없으면(`todayIdx===-1`) 즉시 빈 결과 반환. `updateNewPriceHistory`에 거래일 가드가 생긴 뒤로는 비거래일에 *현재가_이력* 오늘 행이 아예 없어 항상 발동. `_mCalcExtras`(모바일)에는 fallback이 있었으나 Dashboard.js에는 없어 불일치
- **해결**: 두 함수에 `_mCalcExtras`와 동일한 fallback 추가 — 오늘 행 없으면 마지막 거래일을 today로, 그 직전 거래일을 prev로
- **교훈**: 같은 계산이 모바일·시트 두 곳에 따로 구현돼 한쪽만 보강되면 어긋남. 계산 로직 단일화 필요(감사 #4)

### syncHolidays가 기념일(스승의 날 등)을 휴장일로 등록 → 거래일 오판
- **증상**: 휴장일 동기화 후 웹앱이 5/15(금)을 건너뛰고 priceAsOfDate·수익을 5/14(목) 기준으로 표시
- **원인**: `syncHolidays`가 구글 '대한민국 공휴일' 캘린더의 **모든 이벤트를 무필터로** *휴장일* 시트에 기록. 그 캘린더엔 스승의날(5/15)·어버이날 등 증시가 여는 '기념일'도 포함됨 → `_isKoreanHoliday`가 5/15를 휴일로 오판 → `_isTradingDateStr` 거짓 → 5/15 비거래일 취급
- **해결**: `syncHolidays`에 휴장일 이름 화이트리스트(`HOLIDAY_NAMES`) 추가 — 신정·설날·삼일절·어린이날·부처님오신날·현충일·광복절·추석·개천절·한글날·성탄절·대체공휴일·임시공휴일·근로자의날만 채택, 나머지 기념일 제외
- **교훈**: 외부 캘린더는 '공휴일'과 '기념일'을 섞어 제공함. 휴장일 = 공휴일이 아니라 '증시가 닫는 날'이므로 이름 기준으로 명시적으로 걸러야 함
