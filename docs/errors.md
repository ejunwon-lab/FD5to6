# 에러 로그

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

### GAS 지표 대부분 0 반환
- **증상**: 참고지표_히스토리에서 KOSPI/KOSDAQ 외 모두 0
- **원인 1**: 미국선물 심볼 `ES=F`, `NQ=F`는 GOOGLEFINANCE 미지원
- **원인 2**: 상품 선물 `CL=F`, `GC=F`는 GOOGLEFINANCE 미지원
- **원인 3**: KIS 해외지수 API 미검증으로 SPX/NDX 등 실패 가능
- **해결**: ES/NQ → Yahoo Finance API로 변경. CL/GC → `NYMEX:CL1!`, `COMEX:GC1!`로 변경. SPX/NDX/DJI/SOX → gfSymbol fallback 추가
