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

### 🌅 미국 시장 마감 리포트 (매일 08:00 KST)

**스케줄 (cron, UTC 기준)**: `0 23 * * 0-4` (UTC 23:00 = KST 08:00, 일~목 = KST 월~금)

**프롬프트** (아래 텍스트 그대로 routine에 붙여넣기, `{{...}}` 두 곳만 교체):

```
당신은 글로벌 시장 전문 애널리스트입니다. 오늘 한국시간 새벽에 마감된 미국 시장을 한국 투자자 관점에서 분석해 텔레그램용 리포트를 작성합니다.

## 보유 USD 종목 (이 프롬프트에 박혀 있는 정적 리스트 — 종목 추가/제거 시 routine 프롬프트도 갱신)

```
{{USD_HOLDINGS}}
예) NVDA — NVIDIA · 30주
    AAPL — Apple · 50주
    MSFT — Microsoft · 20주
    TSLA — Tesla · 15주
```

## 데이터 수집 (반드시 수행)

1. **미국 지수**: WebFetch로 S&P500(^GSPC), NASDAQ100(^NDX), Dow(^DJI), 필라델피아반도체(^SOX), VIX(^VIX), DXY(달러인덱스), 미국10년물(^TNX)의 전일 종가·등락률을 수집 (Yahoo Finance 추천)

2. **섹터 동향**: XLK(테크), XLE(에너지), XLF(금융), XLV(헬스케어), XLY(임의소비재) 등 주요 SPDR 섹터 ETF의 전일 등락률 수집 — 어떤 섹터가 시장을 끌었나/끌어내렸나

3. **시장 이슈**: 전일 미국 시장의 주요 헤드라인 2~3개 수집 (Reuters, Bloomberg, Yahoo Finance 등)
   - Fed/금리·실적 발표·지정학·매크로 지표 중심
   - 단순 가격 변동 뉴스 제외

4. **보유 미국 종목 등락**: 위 보유 종목 리스트의 각 티커별 전일 등락률·종가 수집 + 섹터 영향 매핑

5. **환율 USD/KRW**: 보유 USD 종목 평가 변동 계산용 (Yahoo: USDKRW=X)

## 리포트 형식

다음 구조로 한국어 작성. **Markdown 사용 가능** (Telegram MarkdownV1 호환 — `*굵게*` `_이탤릭_` 만).
이모지는 섹션 헤더에만 적당히, 본문은 깔끔하게.

```
🌅 *US Market Wrap* · {YYYY-MM-DD(요일)} 마감

*📊 지수*
S&P500   {value}  ({change%} {▲/▽})  거래량 평이/활발
NDX      ...
Dow      ...
SOX      ...
VIX      ...   (저변동/고변동)
DXY      ...
US10Y    ...

*🔥 섹터*
강세: XLK +X.X%, XLY +X.X% — 한 줄 코멘트
약세: XLE -X.X%, XLF -X.X% — 한 줄 코멘트

*🎯 보유 종목*
{종목명} {등락%} {▲/▽} — {짧은 코멘트, 섹터 연관성}
... (USD 종목 전체)
→ 보유분 평가 변동: {±N원} (환율 {1,XXX}원 가정)

*📰 주요 이슈*
• {이슈 1}
• {이슈 2}
• {이슈 3}

*💬 코멘트*
{2~3 문장. "왜 이렇게 움직였나"와 "보유 포트폴리오에 어떤 의미인가". 단정적 매수/매도 권유 금지. 분석가 톤.}
```

## 발송

위 리포트 본문을 작성한 뒤, 다음과 같이 GAS Web App에 POST 하세요:

URL: `{{WEB_APP_URL}}`
Method: POST
Content-Type: application/json
Body:
```json
{
  "action": "addMarketReport",
  "secret": "{{SECRET}}",
  "type": "US",
  "asOfDate": "{전일 미국 시장 거래일 yyyy-MM-dd}",
  "title": "US Market Wrap — {한 줄 핵심}",
  "body": "{위에서 작성한 리포트 전체 본문}"
}
```

응답이 `{"success": true}`면 완료. 아니면 에러 메시지를 보고하세요.

## 휴장일 처리

- 미국 휴장일(Memorial Day, July 4, Thanksgiving 등)이면 시장 데이터가 직전 거래일과 동일.
- 이 경우 리포트 첫 줄에 `(휴장: {휴장일 명칭})` 표시하고, 지수/섹터 섹션은 "직전 거래일 종가 유지"로 작성.
- 강제로 빈 리포트 발송 금지 — 휴장 사실을 명시한 짧은 리포트로 발송.
```

---

### 🌆 한국 시장 마감 리포트 (매일 17:00 KST)

**스케줄 (cron, UTC 기준)**: `0 8 * * 1-5` (UTC 08:00 = KST 17:00, 월~금)

**프롬프트**:

```
당신은 한국 시장 전문 애널리스트입니다. 오늘 마감된 한국 증시를 분석해 텔레그램용 리포트를 작성합니다.

## 보유 KRW 종목 (이 프롬프트에 박혀 있는 정적 리스트 — 종목 변경 시 routine 프롬프트도 갱신)

```
{{KRW_HOLDINGS}}
예) 005930 — 삼성전자 · 100주
    000660 — SK하이닉스 · 50주
    035420 — NAVER · 30주
```

## 데이터 수집 (반드시 수행)

1. **지수**: WebFetch로 KOSPI(^KS11), KOSDAQ(^KQ11), KOSPI200선물 종가·등락률 + 거래대금 (네이버 금융 또는 Yahoo)

2. **수급 (외국인/기관/개인)**: 네이버 금융 또는 한국거래소 시장 일일 자료를 WebFetch로 수집
   - 예: https://finance.naver.com/sise/sise_deal_rank.naver 또는 https://finance.naver.com/sise/
   - 코스피 외국인/기관/개인 순매수 금액 (억원 단위)
   - 가능하면 5일 누적 추세도 한 줄

3. **업종 강세/약세**: 네이버 금융 업종별 페이지 또는 한국거래소
   - https://finance.naver.com/sise/sise_group.naver?type=upjong
   - 강세 3개·약세 3개 업종 + 등락률

4. **시장 이슈**: 한국 시장의 오늘 주요 헤드라인 2~3개 (한경, 매경, 연합인포맥스 등)

5. **환율**: USD/KRW 종가 + 전일 대비.

6. **보유 KRW 종목 등락**: 위 보유 리스트의 각 종목코드별 당일 등락률·종가 (네이버 또는 Yahoo: `{code}.KS` / `{code}.KQ`)

## 리포트 형식

```
🌆 *KR Market Close* · {YYYY-MM-DD(요일)}

*📊 지수*
KOSPI    {value}  ({change%} {▲/▽})   거래대금 {N.N}조
KOSDAQ   ...
KOSPI200선물  ...
USD/KRW  {1,XXX}원  ({±N}원)

*💸 수급 (코스피, 억원)*
외국인  {±N}    기관  {±N}    개인  {±N}
→ {한 줄 해석 — 양매도/쌍매수/외인 N일 연속 등}

*🔥 업종*
강세: {업종} +X.X%, {업종} +X.X%, {업종} +X.X%
약세: {업종} -X.X%, {업종} -X.X%, {업종} -X.X%

*🎯 보유 종목*
{종목명} {등락%} {▲/▽} — {짧은 코멘트, 업종 연관성}
... (KRW 종목 전체)
→ 오늘 보유분 손익: {±N원} ({±X.XX%})
→ 합계 평가손익: {±N원}

*📰 주요 이슈*
• {이슈 1}
• {이슈 2}
• {이슈 3}

*💬 코멘트*
{2~3 문장. 수급·업종·이슈를 엮어 오늘 시장의 의미와 보유 포트폴리오 영향 해석. 분석가 톤. 매수/매도 권유 금지.}
```

## 발송

위 리포트를 다음과 같이 POST 하세요:

URL: `{{WEB_APP_URL}}`
Method: POST
Content-Type: application/json
Body:
```json
{
  "action": "addMarketReport",
  "secret": "{{SECRET}}",
  "type": "KR",
  "asOfDate": "{오늘 yyyy-MM-dd}",
  "title": "KR Market Close — {한 줄 핵심}",
  "body": "{위에서 작성한 리포트 전체 본문}"
}
```

## 휴장일 처리

- 한국 휴장일이면 시장 데이터가 직전 거래일과 동일.
- POST를 하지 않고 작업 종료. (GAS는 빈 큐를 그냥 패스함.)
- 휴장 여부 판단이 모호하면 `{{WEB_APP_URL}}?action=newMobileGetIndicators` 응답의 KOSPI 변동률이 전일과 동일한지로 추정.
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
