# FD5to6 Finance iOS 앱 변경 내역

> 작성일: 2026-04-23

---

## 1. 당일 등락 % 오표시 수정

### 원인
KIS API `prdy_ctrt`(전일대비율)가 **소수형**(예: `0.1353` = 13.53%)으로 반환되는데,
기존 코드가 `× 100` 없이 `%`만 붙여 `"0.1353%"`로 시트에 저장.
이후 MobileAPI에서 `_round2(0.1353) = 0.14` → `"+0.14%"` 로 정보 손실.

### 수정 1 — `KIS_StockStatus.js`
`updateStockStatusQuick` 및 `updateStockStatusAuto` 두 곳에서:
```js
// Before
vPct = (info.changeRate || 0) + '%';

// After
vPct = ((info.changeRate || 0) * 100).toFixed(2) + '%';
```

### 수정 2 — `MobileAPI.js` (`_buildPortfolioJSON`)
시트에 이미 저장된 소수형 값 대응 (GAS 재배포 전 호환):
```js
// Before
const _changePctNum = typeof _rawChangePct === 'number'
  ? _rawChangePct * 100
  : toNumberLoose(_rawChangePct);

// After — 절댓값 ≤ 1.0이면 소수형으로 판단하여 × 100
const _rawNum       = typeof _rawChangePct === 'number'
  ? _rawChangePct : toNumberLoose(_rawChangePct);
const _changePctNum = Math.abs(_rawNum) <= 1.0 ? _rawNum * 100 : _rawNum;
```

### 수정 3 — iOS `PortfolioModels.swift` (근본 해결)
GAS 문자열에 의존하지 않고 숫자 필드에서 직접 계산:
```swift
// Holding struct에 computed property 추가
var dailyChangePct: Double {
    guard currentPrice > 0 else { return 0 }
    return change / currentPrice * 100  // KIS: prdy_ctrt = prdy_vrss / stck_prpr × 100
}
```

`HoldingCard.swift`에서 `holding.changePct` → `holding.dailyChangePct.pctFormatted` 로 교체 (4곳).

---

## 2. HoldingCard UI 개선

### 2-1. 단위 "원" 제거
`Extensions.swift`의 모든 포맷터에서 `원` 제거:
```swift
var krwFormatted: String { Int(self).formatted() }           // "[금액]"
var krwCompact: String   { ... "억" / "만" }                 // "1014만"
var krwCompactSigned: String { ... }                          // "+1014만"
```
`HoldingCard.swift`, `HoldingsView.swift` 내 수동 `원` 문자열도 모두 제거.

### 2-2. 정렬 탭 변경
| 변경 전 | 변경 후 |
|---------|---------|
| 수익률 / 수익금 / 평가금액 / 당일 등락 | 수익률 / 수익금 / 평가 금액 / 당일 등락 / **모든 정보** |

- **평가 금액**: 띄어쓰기 수정, 원래 2줄 레이아웃(평가금액 + 수익률)으로 복원
- **모든 정보** (`allInfo`): 3컬럼 레이아웃
  - 왼쪽: 종목명 + 코드
  - 중간: 수량 / 당일 등락액 + 등락%
  - 오른쪽: 평가금액 / 당일 총액 + % / 평가손익 + 수익률

### 2-3. 당일 등락 케이스 3줄 표시
```
+[금액] (+13.53%) × 35주      ← 주당 등락 + 비율 + 수량
+[금액]                     ← 총 등락액 (change × quantity)
+13.53%                        ← 비율 반복
```

---

## 3. 대시보드 합계 갱신 문제 해결

### 원인
대시보드 "합계 수익", "전일 대비" 등은 **추이 기록 시트**(U2:AF2)에서 읽음.
이 시트는 `logToTrendSheet()` 호출 시에만 갱신 → ✨ wand 버튼에서만 실행.

| 버튼 | 기존 동작 | 대시보드 갱신 |
|------|----------|-------------|
| ⚡ bolt | `updateStockStatusQuick` | ✗ |
| 🔲 grid | `updateStockStatusAuto` | ✗ |
| ✨ wand | `runFullUpdate` (전체) | ✓ |

### 해결 — `_logToTrendSheetLite(ss)` 신규 작성

`logToTrendSheet` 대비 ~70% 빠른 모바일 전용 경량 버전:

| 항목 | `logToTrendSheet` | `_logToTrendSheetLite` |
|------|------------------|----------------------|
| Section A (업데이트별 추이) | 컬럼 스캔 + 행 추가 | **생략** |
| Section B (일별 추이) | 컬럼 스캔 + 행 추가 | **생략** |
| Section C (수익 요약) | 셀 개별 읽기 × 3 | **배치 읽기 1회** |
| 쓰기 대상 | 히스토리 행 + 2행 | **U2:AF2 (2행)만** |

전일 대비 로직:
- 오늘 날짜가 이미 U2에 있으면 → `AD2 - AE2` = 어제 기준으로 역산
- 아니면 → `AD2` = 마지막 저장값 기준

```js
function mobileUpdateHoldingsFast() {
  ...
  updateStockStatusQuick();
  SpreadsheetApp.flush();
  _logToTrendSheetLite(ss);   // ← 추가
  SpreadsheetApp.flush();
  return JSON.stringify(_buildPortfolioJSON(ss));
}
// mobileUpdateHoldingsFull도 동일
```

### 최적화 — `_buildPortfolioJSON` 추이 시트 읽기
```js
// Before: getRange().getValue() 8회 개별 호출
trendTotalProfit = trendSheet.getRange(2, pCol + 9).getValue();
confirmedProfit  = trendSheet.getRange(2, pCol + 3).getValue();
// ... 6회 더

// After: 배치 1회
const tr = trendSheet.getRange(2, pCol, 1, 13).getValues()[0]; // U2:AG2
trendTotalProfit = toNumberLoose(tr[9]);
confirmedProfit  = toNumberLoose(tr[3]);
// ...
```

---

## 파일별 변경 목록

| 파일 | 변경 내용 |
|------|---------|
| `apps-script/KIS_StockStatus.js` | `changePct` 저장 시 `× 100` 추가 (2곳) |
| `apps-script/MobileAPI.js` | changePct 소수 처리, 추이 시트 배치 읽기, `_logToTrendSheetLite` 추가, bolt/grid에 lite 호출 |
| `ios/Sources/Models/PortfolioModels.swift` | `dailyChangePct` computed property 추가 |
| `ios/Sources/Features/Holdings/HoldingCard.swift` | `changePct` → `dailyChangePct.pctFormatted`, `allInfo` 케이스 추가, 원 제거 |
| `ios/Sources/Features/Holdings/HoldingsView.swift` | `allInfo` SortKey 추가, 정렬 로직 추가, 원 제거, 평가 금액 띄어쓰기 |
| `ios/Sources/Shared/Extensions.swift` | 포맷터에서 `원` 제거, `krwCompact` 단순화 |
