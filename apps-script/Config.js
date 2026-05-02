/**
 * Config.gs
 * 전역 설정 및 상수 관리
 *
 * [구조 변경 원칙]
 * - 행 범위: Named Range로 관리 (NAMED_RANGES 참조) → 시트에서 드래그만 하면 반영
 * - 열 위치: 헤더 텍스트 기반 동적 감지 (HEADER_TEXTS 참조) → 열 이동 시 자동 추적
 * - 셀 주소: Named Range로 관리 (FX_USD, FX_GBP 등)
 * - 동적 값이 필요한 곳: getTrackerColumns(ss), getNamedRange(ss, name) 사용
 */

const CONFIG = {
  // ── 시트 이름 ──────────────────────────────────────────────────────
  SHEET_NAMES: {
    TRACKER:           '투자수익 트래커',
    TREND:             '추이 기록',
    CHART:             '추이 그래프',
    TEMP:              'Temp',
    ANALYSIS:          '투자 분석',
    TRANSACTION:       '거래 입력',
    INDICATORS:        '참고지표',
    INDICATORS_HISTORY:'참고지표_히스토리'
  },

  // ── Named Range 이름 (구글 시트 → 데이터 → 이름이 지정된 범위) ────
  // 데이터 끝 행은 Named Range로 고정하지 않고 런타임에 자동 감지:
  //   운용중 데이터 끝 = ACTIVE_TOTAL 행 - 1
  //   매도완료 데이터 끝 = SOLD_HEADER 다음 행부터 A열 마지막 데이터 행
  NAMED_RANGES: {
    ACTIVE_HEADER:  'TRACKER_ACTIVE_HEADER', // 헤더 행 (고정)
    ACTIVE_TOTAL:   'TRACKER_ACTIVE_TOTAL',  // 합계 행 (고정)
    SOLD_HEADER:    'TRACKER_SOLD_HEADER',   // 매도완료 헤더 행(들) (고정)
    FX_USD:         'FX_USD',               // 환율 USD 셀
    FX_GBP:         'FX_GBP',               // 환율 GBP 셀
    TREND_OP_TOTAL:   'TREND_OP_TOTAL',     // 추이 기록 원천: 운용 합계 셀
    TREND_PEND_TOTAL: 'TREND_PEND_TOTAL',   // 추이 기록 원천: 대기 합계 셀
  },

  // ── 헤더 행 번호 (Named Range 미설정 시 폴백용) ───────────────────
  HEADER_ROW: {
    ACTIVE: 5,
    SOLD:   43,
  },

  // ── 헤더 텍스트 (getTrackerColumns() 에서 열 위치 동적 감지에 사용) ─
  HEADER_TEXTS: {
    CODE:          '종목코드',
    CATEGORY:      '분류',
    NAME:          '종목명',
    BUY_DATE:      '매입일',
    BROKER:        '증권사',
    ACCOUNT_TYPE:  '구분',
    STOCK_NAME:    '종목',       // H열(매입정보)·R열(현황) 공통 헤더
    QUANTITY:      '수량',
    UNIT_PRICE:    '단가',
    OP_BUY:        '운용 매입',
    FEE:           '수수료',
    CURRENT_PRICE: '현재 단가',
    OP_CURRENT:    '운용 현재가',
    OP_PROFIT:     '운용 수익',
    PROFIT_RATE:   '수익율',
    INVEST_DAYS:   '투자기간(일)',
    STATUS_CHANGE: '당일 등락',
    STATUS_PCT:    '당일(%)',
    STATUS_M1:     '1개월',
    STATUS_M3:     '3개월',
    STATUS_M6:     '6개월',
    STATUS_Y1:     '1년',
    STATUS_HIGH52: '52주 최고가',
    STATUS_LOW52:  '52주 최저가',
  },

  // ── 추이 기록 시트 구조 ────────────────────────────────────────────
  TREND: {
    START_COL:             2,
    DAILY_START_COL:       14,
    DAILY_START_ROW:       5,
    PROFIT_START_COL:      21,
    PROFIT_START_ROW:      5,
    PROFIT_CHART_START:    '2025-10-20', // 수익 차트 시작일
  },

  // ── 종목 코드 분류 ─────────────────────────────────────────────────
  CODES: {
    KOREA_ETF:        ['A0047A0', '0047A0'],
    NEW_ETF:          ['0091P0', '0048K0', '0053L0'],
    EXCLUDE_KEYWORDS: ['예금', '펀드', '연금', '퇴직', 'IRP']
  },

  // ── A~Z 범위 밖 고정 컬럼 (헤더 감지 범위 밖이라 수동 관리) ────────
  // TARGET: 목표가 입력 컬럼 (onEdit 트리거 대상)
  // DATE:   목표가 입력 날짜 자동 기록 컬럼
  EXTRA_COLS: {
    TARGET: 32, // AF열
    DATE:   28, // AB열
  },

  // ── 합계행 컬럼 (ACTIVE_TOTAL 행 내 셀 참조용, 열 문자) ──────────
  TOTAL_COLS: {
    OP_BUY:     'K',  // 운용 매입 합계
    OP_CURRENT: 'N',  // 운용 현재가 합계
    OP_PROFIT:  'O',  // 운용 수익 합계
  },

  // ── 확정 거래 컬럼 (매도완료 섹션, 열 문자) ──────────────────────
  CONFIRMED_COLS: {
    BUY:    'K',
    SELL:   'V',
    PROFIT: 'X',
  },

};

// ── 참고지표 정의 ─────────────────────────────────────────────────────
// source 종류:
//   'kis_domestic_index'  : KIS 국내지수 (KOSPI, KOSDAQ)
//   'kis_domestic_futures': KIS 국내선물 (코스피200 선물)
//   'kis_overseas_index'  : KIS 해외지수 (SPX, NDX 등)
//   'googlefinance'       : GOOGLEFINANCE 수식 (VIX, DXY, TNX 등)
//
// code: 소스별 조회 코드
//   KIS 국내지수: 0001(KOSPI), 1001(KOSDAQ), 2001(KOSPI200)
//   KIS 국내선물: 101W0000(코스피200선물 최근월물) 등
//   KIS 해외지수: .SPX, .IXIC, .DJI, .SOX, ES=F, NQ=F, CL=F, GC=F 등
//   GOOGLEFINANCE: 그대로 티커
const REFERENCE_INDICATORS = [
  // 한국시장 (KIS 국내지수)
  { key: 'KOSPI',  name: 'KOSPI',  category: '한국시장', source: 'kis_domestic_index', code: '0001' },
  { key: 'KOSDAQ', name: 'KOSDAQ', category: '한국시장', source: 'kis_domestic_index', code: '1001' },
  // 한국선물 (KIS 국내선물 — code 'NEAREST'는 런타임에 최근월물 자동 계산)
  { key: 'K200F', name: '코스피200선물', category: '한국선물', source: 'kis_domestic_futures', code: 'NEAREST', gfSymbol: 'KRX:KOSPI200' },
  // 미국시장 (KIS 해외지수 → 실패 시 GOOGLEFINANCE fallback)
  { key: 'SPX', name: 'S&P500',        category: '미국시장', source: 'kis_overseas_index', code: 'SPX', excd: 'NYS', gfSymbol: 'INDEXSP:.INX' },
  { key: 'NDX', name: 'NASDAQ100',     category: '미국시장', source: 'kis_overseas_index', code: 'NDX', excd: 'NAS', gfSymbol: 'INDEXNASDAQ:NDX' },
  { key: 'DJI', name: '다우존스',       category: '미국시장', source: 'kis_overseas_index', code: 'DJI', excd: 'NYS', gfSymbol: 'INDEXDJX:.DJI' },
  { key: 'SOX', name: '필라델피아반도체', category: '미국시장', source: 'kis_overseas_index', code: 'SOX', excd: 'NAS', gfSymbol: 'NASDAQ:SOXX', ySymbol: '^SOX' },
  // 미국선물 (Yahoo Finance → GOOGLEFINANCE fallback)
  { key: 'ES', name: 'S&P500선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'ES=F',  gfSymbol: 'INDEXSP:.INX' },
  { key: 'NQ', name: 'NASDAQ선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'NQ=F',  gfSymbol: 'INDEXNASDAQ:NDX' },
  // 상품 (Yahoo Finance → GOOGLEFINANCE fallback)
  { key: 'GC', name: '금',      category: '상품', source: 'yahoo_finance', ySymbol: 'GC=F',  gfSymbol: 'COMEX:GC1!' },
  { key: 'CL', name: 'WTI원유', category: '상품', source: 'yahoo_finance', ySymbol: 'CL=F',  gfSymbol: 'NYMEX:CL1!' },
  // 매크로
  { key: 'VIX', name: 'VIX',       category: '매크로', source: 'googlefinance', gfSymbol: 'INDEXCBOE:VIX' },
  { key: 'TNX', name: '미국10년물', category: '매크로', source: 'googlefinance', gfSymbol: 'TNX' },
  { key: 'DXY', name: '달러인덱스', category: '매크로', source: 'yahoo_finance', ySymbol: 'DX-Y.NYB', gfSymbol: 'CURRENCYCOM:DXY' },
  // AI/반도체
  { key: 'NVDA', name: 'NVIDIA',     category: 'AI/반도체', source: 'yahoo_finance', ySymbol: 'NVDA',  gfSymbol: 'NASDAQ:NVDA' },
  // 빅테크
  { key: 'AAPL', name: 'Apple',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'AAPL',  gfSymbol: 'NASDAQ:AAPL' },
  { key: 'MSFT', name: 'Microsoft', category: '빅테크', source: 'yahoo_finance', ySymbol: 'MSFT',  gfSymbol: 'NASDAQ:MSFT' },
  { key: 'GOOGL', name: 'Google',   category: '빅테크', source: 'yahoo_finance', ySymbol: 'GOOGL', gfSymbol: 'NASDAQ:GOOGL' },
  { key: 'META', name: 'Meta',      category: '빅테크', source: 'yahoo_finance', ySymbol: 'META',  gfSymbol: 'NASDAQ:META' },
  { key: 'AMZN', name: 'Amazon',    category: '빅테크', source: 'yahoo_finance', ySymbol: 'AMZN',  gfSymbol: 'NASDAQ:AMZN' },
  { key: 'TSLA', name: 'Tesla',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'TSLA',  gfSymbol: 'NASDAQ:TSLA' },
  // 중국시장
  { key: 'HSI', name: '항셍지수', category: '중국시장', source: 'yahoo_finance', ySymbol: '^HSI', gfSymbol: 'INDEXHANGSENG:HSI' },
];

// 하위 호환성 별칭
const SHEET_NAMES      = CONFIG.SHEET_NAMES;
const KOREA_ETF_CODES  = CONFIG.CODES.KOREA_ETF;
const NEW_ETF_CODES    = CONFIG.CODES.NEW_ETF;
