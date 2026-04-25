# 설계 결정 기록

---

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
