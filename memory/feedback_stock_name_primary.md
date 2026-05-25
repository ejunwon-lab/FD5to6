---
name: stock-name-primary
description: "종목 표시 시 항상 종목명이 메인, 종목코드는 보조 (작고 흐리게)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9e7f391-3392-4162-9c42-001fe6a546bc
---

종목을 화면에 표시할 때 **종목명이 메인**, 종목코드는 보조 지표로만 작게/흐리게 노출.

**Why:** 사용자가 명시적으로 "종목코드를 자꾸 쓰는데, 종목코드는 보조 지표야. 무조건 종목명을 사용하도록 해"라고 지시. 한국 시장 코드(005930 등)는 그 자체로 의미 인지가 안 됨 — 종목명이 가독성·인지의 1차 단서.

**How to apply:**
- 카드/행/표 등에서 메인 라벨 = `h.name`. amber/font-medium/text-sm 이상.
- 종목코드(`h.symbol`)는 보조 — text-2xs·text-ink-faint·tabular 정도. name 아래나 우측 작게.
- 정렬·차트 축 라벨 등 공간이 좁아 한 줄이어야 하는 곳도 가능하면 name 우선, 코드는 truncate되더라도 name이 메인 자리.
- 이미 `IndicatorsPage` BigIndicator, `MarketHeatmap` Cell 등은 `ind.name || ind.symbol` 패턴 적용됨 — 같은 원칙 유지.
- 사용자가 "종목코드로 정렬해줘" 등 직접 지시하지 않는 한 코드 기반 정렬·필터도 가급적 name으로.

연관: [[number-display-full]]
