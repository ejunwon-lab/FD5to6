# 시장 리포트 자동 발송 — Claude Routines 가이드

last updated: 2026-05-28

매일 08:00·17:00 KST에 claude.ai routine이 시장을 분석해 *시장리포트_큐* 시트에 행을 추가하고, GAS 트리거가 08:05·17:05에 큐를 읽어 Telegram으로 발송한다.

```
[Routine 08:00 / 17:00] (claude.ai, Max 무료 15개/일 한도)
   ↓ WebFetch + GAS Web App 호출로 데이터 수집
   ↓ 분석 + 리포트 본문 생성
   ↓ HTTPS POST → GAS Web App
[GAS doPost]
   ↓ action=addMarketReport → *시장리포트_큐* 시트 행 추가 (상태="대기")
[GAS 트리거 08:05 / 17:05]
   ↓ tgFlushReportQueue → "대기" 행 → Telegram 발송 → "발송완료" 마킹
```

---

## 1회 셋업

### Step 1. GAS 새 Deployment (사용자, 1회)

`doPost`에 새 분기(`action=addMarketReport`)를 추가했으므로 **Web App 새 버전 배포**가 필요하다. URL은 그대로 유지된다.

1. Apps Script 에디터 열기 (`apps-script-v2` 프로젝트)
2. 우상단 **Deploy → Manage deployments**
3. 활성 deployment 옆 ✏️ 클릭
4. Version: **New version**, Description: `2026-05-28 시장리포트 큐 추가` 등 메모
5. **Deploy** → 새 버전 활성화

> Web App URL은 그대로이므로 기존 Telegram webhook은 영향 없음.

### Step 2. 시트 메뉴에서 트리거 등록 (사용자, 1회)

스프레드시트 메뉴: **🛠️ 유지보수 → 📊 시장 리포트 — 08:05·17:05 트리거 ON**

→ 매일 08:05·17:05 KST 근처에 `tgFlushReportQueue` 실행.

### Step 3. Routine에 줄 정보 확보

claude.ai에서 routine을 만들 때 프롬프트에 박을 두 값:

| 변수 | 어디서 |
|---|---|
| `WEB_APP_URL` | Apps Script → Deploy → Manage deployments → Web app URL (`.../exec`로 끝남) |
| `SECRET` | Apps Script → Project Settings → Script Properties → `TG_WEBHOOK_SECRET` 값 (또는 GAS 에디터에서 `tgShowSecret()` 실행 → Logger 확인) |

> SECRET은 비밀이므로 claude.ai routine 프롬프트에만 박고, 코드/문서엔 절대 커밋하지 않는다.

---

## 2. Routine 등록 (claude.ai에서)

### 설계 원칙 (양 routine 공통)

- **수량·평가액 X** — 보유분 실손익은 기존 `tgPushPnL`(장중 매시 :00/:20/:40 텔레그램 워치 푸시)이 시트 기반 정확값으로 보냄. routine은 *시장 해석*만 담당
- **종목 이슈는 조건부** — 보유 종목 중 ±2% 이상 움직인 종목만 회사 단위 뉴스 검색 (실적·공시·M&A·신제품·애널 코멘트). 평온한 종목은 "특이 이슈 없음"으로 표기. 매일 N개 뉴스 검색하지 않음
- **섹터 ↔ 보유 매핑 강조** — 섹터 섹션에서 "XLK +1.5% (보유 NVDA·MSFT 수혜)" 식으로 직접 매핑. 보유 종목 섹션이 시장 흐름과 자연스럽게 연결
- **Telegram MarkdownV1 호환** — `*굵게*` `_이탤릭_` 만 사용. ``` 코드블록·`__` 이중밑줄 금지

---

### 🌅 미국 시장 마감 리포트 (매일 08:00 KST)

**스케줄 (cron, UTC 기준)**: `0 23 * * 0-4` (UTC 23:00 = KST 08:00, 일~목 = KST 월~금)

**프롬프트** (아래 텍스트 그대로 routine에 붙여넣기, `{{...}}` 3곳 교체):

```
당신은 글로벌 시장 전문 애널리스트입니다. 오늘 한국시간 새벽에 마감된 미국 시장을 한국 투자자 관점에서 분석해 텔레그램용 리포트를 작성합니다.

## 보유 USD 종목 (정적 리스트 — 종목 변경 시 이 프롬프트도 갱신)

{{USD_HOLDINGS}}

(형식: `TICKER — 회사명`, 한 줄에 하나. 예: `NVDA — NVIDIA`)

## 데이터 수집 (반드시 수행)

1. **지수** (WebFetch, Yahoo Finance): S&P500(^GSPC), NASDAQ100(^NDX), Dow(^DJI), 필라델피아반도체(^SOX), VIX(^VIX), DXY(달러인덱스 DX-Y.NYB), 미국10년물(^TNX). 각 종가·등락률.

2. **섹터** (Yahoo): SPDR 섹터 ETF 11종 — XLK(테크)·XLF(금융)·XLE(에너지)·XLV(헬스)·XLY(임소)·XLP(필소)·XLI(산업)·XLB(소재)·XLU(유틸)·XLRE(부동산)·XLC(통신). 등락률 정렬 후 강세 3 / 약세 3. **보유 종목이 속한 섹터는 별도로 표시** (예: NVDA→XLK, JPM→XLF).

3. **시장 이슈** (Reuters/Bloomberg/Yahoo Finance 헤드라인 검색): Fed·매크로 지표·실적 시즌·지정학 관련 헤드라인 2~3개. 단순 가격 변동 뉴스 제외.

4. **보유 종목 등락** (Yahoo): 위 보유 리스트의 각 티커 종가·등락률·거래량. **±2% 이상 움직인 종목**은 5번 작업으로 회사 단위 뉴스 검색.

5. **보유 종목 회사 단위 뉴스** (조건부 — 4번에서 ±2% 이상인 종목만): 해당 회사명+날짜로 검색. 실적·공시·M&A·신제품·애널 리포트·소송 등. 평온한 종목(±2% 미만)은 검색 생략.

## 리포트 형식

다음 구조로 한국어 작성. **Telegram MarkdownV1**: `*굵게*` `_이탤릭_`만. `___이중밑줄___`·\`코드\`·표 형식 사용 금지.

```
🌅 *US Market Wrap* · {YYYY-MM-DD(요일)} 마감

*📊 지수*
S&P500   {value}  ({±X.XX%} {▲/▽})
NDX      ...
Dow      ...
SOX      ...
VIX      ...   ({저변동/고변동 코멘트})
DXY      ...
US10Y    ...

*🔥 섹터*
강세: XLK +X.X% _(보유 NVDA·MSFT 수혜)_, XLY +X.X%, XLC +X.X%
약세: XLE -X.X%, XLF -X.X% _(보유 JPM 영향)_, XLU -X.X%

*🎯 보유 종목*
NVDA  {±X.XX%} {▲/▽} — {1줄 코멘트: 섹터 강도 + 상대 강도}
AAPL  ...
... (USD 종목 전체)

*📰 시장 이슈*
• {이슈 1 — 1줄}
• {이슈 2 — 1줄}
• {이슈 3 — 1줄}

*📰 보유 종목 이슈*
• {종목명}: {뉴스 1줄} — {±X.XX% 변동과 인과}
• {종목명}: {뉴스 1줄}
(±2% 이상 변동 종목 없으면: "특이 이슈 없음")

*💬 종합 코멘트*
{2~3 단락. 분석가 톤. 오늘 시장의 의미(섹터 로테이션·매크로 신호 등) + 보유 포트폴리오에 어떤 시사점. 단정적 매수/매도 권유 금지.}
```

## 발송

위 본문을 GAS Web App에 POST:

URL: `{{WEB_APP_URL}}`
Method: POST
Content-Type: application/json
Body:
```
{
  "action": "addMarketReport",
  "secret": "{{SECRET}}",
  "type": "US",
  "asOfDate": "{전일 미국 시장 거래일 yyyy-MM-dd}",
  "title": "US Market Wrap — {한 줄 핵심}",
  "body": "{위에서 작성한 리포트 전체 본문}"
}
```

응답이 `{"success": true}`면 완료. 아니면 에러를 보고하세요.

## 휴장일 처리

- 미국 휴장일(Memorial Day·Independence Day·Thanksgiving 등)이면 직전 거래일 데이터가 그대로 노출됨.
- 이 경우 리포트 첫 줄을 `🌅 *US Market Wrap* · _휴장 ({휴장일명})_` 으로 표기. 지수·섹터는 "직전 거래일 종가 유지" 짧게 적고, 보유 종목·이슈·코멘트는 생략 또는 한두 줄.
- 강제로 큰 리포트 만들지 말 것. 휴장 사실을 짧게 알리는 게 목적.
```

---

### 🌆 한국 시장 마감 리포트 (매일 17:00 KST)

**스케줄 (cron, UTC 기준)**: `0 8 * * 1-5` (UTC 08:00 = KST 17:00, 월~금)

**프롬프트**:

```
당신은 한국 시장 전문 애널리스트입니다. 오늘 마감된 한국 증시를 분석해 텔레그램용 리포트를 작성합니다.

## 보유 KRW 종목 (정적 리스트 — 종목 변경 시 이 프롬프트도 갱신)

{{KRW_HOLDINGS}}

(형식: `종목코드 — 종목명`, 한 줄에 하나. 예: `005930 — 삼성전자`)

## 데이터 수집 (반드시 수행)

1. **지수** (WebFetch): KOSPI(^KS11), KOSDAQ(^KQ11), KOSPI200 선물 — 종가·등락률·거래대금 (Yahoo 또는 네이버 금융 https://finance.naver.com/sise/).

2. **수급** (네이버 금융 또는 한국거래소): 코스피 외국인·기관·개인 순매수 (억원), 코스닥도 같이. 가능하면 5일 누적 추세 한 줄.
   - 추천 URL: https://finance.naver.com/sise/sise_deal_rank.naver

3. **업종** (네이버 업종별): https://finance.naver.com/sise/sise_group.naver?type=upjong — 강세 3 / 약세 3. **보유 종목이 속한 업종은 별도 표시**.

4. **시장 이슈** (한경·매경·연합인포맥스 헤드라인): 금통위·환율·정책·외인 동향·매크로 헤드라인 2~3개.

5. **환율** (네이버 또는 Yahoo USDKRW=X): USD/KRW 종가 + 전일 대비.

6. **보유 종목 등락** (Yahoo `{code}.KS` 또는 `{code}.KQ`, 또는 네이버 금융): 위 보유 리스트 각 종목 당일 등락률·종가·거래량. **±2% 이상 움직인 종목**은 7번 작업으로 회사 단위 뉴스 검색.

7. **보유 종목 회사 단위 뉴스** (조건부 — 6번에서 ±2% 이상인 종목만): 네이버 뉴스에서 종목명+날짜로 검색. 실적·공시·M&A·증권사 리포트·소송 등. 평온한 종목은 검색 생략.

## 리포트 형식

**Telegram MarkdownV1** 만 (`*굵게*` `_이탤릭_`). 표 형식 금지.

```
🌆 *KR Market Close* · {YYYY-MM-DD(요일)}

*📊 지수·환율*
KOSPI       {value}  ({±X.XX%} {▲/▽})   거래대금 {N.N}조
KOSDAQ      ...                          거래대금 {N.N}조
KOSPI200선물 ...
USD/KRW     {1,XXX}원  ({±N}원)

*💸 수급* (억원)
코스피:  외인 {±N}  기관 {±N}  개인 {±N}
코스닥:  외인 {±N}  기관 {±N}  개인 {±N}
→ {한 줄 해석 — 양매도/쌍매수, 외인 N일 연속 등 추세}

*🔥 업종*
강세: {업종} +X.X% _(보유 X·Y 수혜)_, {업종} +X.X%, {업종} +X.X%
약세: {업종} -X.X%, {업종} -X.X% _(보유 Z 영향)_, {업종} -X.X%

*🎯 보유 종목*
삼성전자  {±X.XX%} {▲/▽} — {업종 강도 + 상대 강도 1줄}
SK하이닉스 ...
... (KRW 종목 전체)

*📰 시장 이슈*
• {이슈 1 — 1줄}
• {이슈 2 — 1줄}
• {이슈 3 — 1줄}

*📰 보유 종목 이슈*
• {종목명}: {뉴스 1줄} — {±X.XX% 변동과 인과}
• {종목명}: {뉴스 1줄}
(±2% 이상 변동 종목 없으면: "특이 이슈 없음")

*💬 종합 코멘트*
{2~3 단락. 수급·업종·이슈를 엮어 오늘 시장의 의미 + 보유 포트폴리오 시사점. 분석가 톤. 매수/매도 권유 금지.}
```

## 발송

URL: `{{WEB_APP_URL}}`
Method: POST
Content-Type: application/json
Body:
```
{
  "action": "addMarketReport",
  "secret": "{{SECRET}}",
  "type": "KR",
  "asOfDate": "{오늘 yyyy-MM-dd}",
  "title": "KR Market Close — {한 줄 핵심}",
  "body": "{리포트 전체 본문}"
}
```

## 휴장일 처리

- 한국 휴장일이면 POST를 하지 않고 작업 종료. (GAS는 빈 큐를 그냥 패스함.)
- 휴장 판단이 모호하면 데이터 수집 1번의 KOSPI 변동률이 0이고 거래대금이 비정상적으로 낮으면 휴장으로 추정.
```

---

## 3. 운영·유지보수

### 발송 상태 확인

스프레드시트 **시장리포트_큐** 시트:
- 작성시각 / 구분 / 대상날짜 / 제목 / 본문 / 발송상태 / 발송시각 / 에러
- 상태: `대기` → `발송완료` 또는 `실패`
- 실패 행은 에러 메시지가 마지막 컬럼에 기록됨

### 재발송

상태 컬럼(F열)을 `대기`로 다시 바꾸고 메뉴 **🛠️ 유지보수 → 📤 시장 리포트 — 큐 즉시 발송** 클릭.

### Routine이 동작 안 할 때 디버깅 순서

1. claude.ai routines 페이지에서 마지막 실행 로그 확인
2. POST 자체가 안 갔는지 vs GAS가 거부했는지 구분
3. 시트 *시장리포트_큐*에 행이 추가됐는지 확인 (= POST 성공·secret 통과)
4. 행이 있는데 발송 안 됐으면 GAS 트리거 확인 (`tgFlushReportQueueNow`로 수동 발송 시도)
5. `tgSendMessage` 자체가 실패하면 봇 토큰·chat_id 확인 (`tgListChatIds`)

### 비용·한도

- claude.ai Max: routines 하루 15개 무료. 우린 2개 사용 → 한도 86% 여유.
- GAS quota: doPost 호출은 평이 (하루 2회). Web App 일일 한도 충분.
- 텔레그램 봇: 분당 30 msg 제한, 우린 2회/일 → 무관.

### 변경 시 갱신할 곳

- 리포트 형식/섹션 추가 → 이 문서 + claude.ai routine 프롬프트 (코드 변경 없음)
- 큐 시트 컬럼 변경 → `TG_REPORT.HEADER` 상수 + `_tgEnsureReportQueueSheet` + `tgFlushReportQueue` 인덱스
- 트리거 시각 변경 → `tgSetupReportQueueTrigger`의 `atHour`/`nearMinute`
