# GAS API 레퍼런스

last updated: 2026-04-25

iOS에서 `scripts.run`으로 호출하는 함수 목록.

---

## 포트폴리오

### `mobileGetPortfolio()`
현재 시트 데이터를 갱신 없이 읽어서 반환. 빠름(~3초).

```json
{
  "success": true,
  "updatedAt": "2026-04-25 10:00:00",
  "usdRate": 1380,
  "summary": { "totalBuy": 0, "totalCurrent": 0, "totalProfit": 0, ... },
  "byCategory": { "ETF": { "current": 0, "buy": 0, "profit": 0, "pct": 0, "profitRate": 0 } },
  "byAccount": { ... },
  "holdings": [ { "code": "...", "name": "...", ... } ]
}
```

### `mobileTriggerUpdate()`
가격 갱신 후 데이터 반환. 느림(30~90초).

### `mobileUpdateHoldingsFull()`
종목현황 전체 업데이트(KIS 개별 조회) 후 반환. 느림.

### `mobileUpdateHoldingsFast()`
종목현황 빠른 업데이트(배치 조회) 후 반환. 중간(10~30초).

### `mobileUpdateAll()`
통합 업데이트(가격+종목+추이+성과+그래프) 후 반환. 매우 느림(2~5분).

---

## 참고지표

### `mobileGetReferenceIndicators()`
지표 조회·저장 후 반환. 느림(GOOGLEFINANCE 대기 포함 ~15초).

```json
{
  "success": true,
  "updatedAt": "2026-04-25 10:00:00",
  "indicators": [
    {
      "key": "KOSPI",
      "name": "KOSPI",
      "category": "한국시장",
      "value": 2650.5,
      "change": 12.3,
      "changePct": 0.47
    }
  ]
}
```

**데이터 소스 우선순위:**
1. KIS API (국내지수·해외지수·국내선물)
2. Yahoo Finance (ES=F, NQ=F)
3. GOOGLEFINANCE (VIX, TNX, DXY, 금, WTI)
4. GOOGLEFINANCE fallback (KIS 실패 시 gfSymbol 있는 항목)

---

## 공통 에러 응답
```json
{ "success": false, "error": "에러 메시지" }
```
