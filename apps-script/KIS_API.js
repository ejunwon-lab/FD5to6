/**
 * KIS_API.gs
 * 한국투자증권 API 연동 모듈
 */
const KIS_API = {
  /**
   * 접근 토큰(Access Token) 발급 및 관리
   * - 유효기간이 남았으면 재사용, 없으면 재발급
   */
  getAccessToken: function() {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('KIS_ACCESS_TOKEN');
    const expiry = props.getProperty('KIS_TOKEN_EXPIRY');
    const now = new Date().getTime();
    // 토큰이 있고 유효기간이 1분 이상 남았으면 재사용
    if (token && expiry && now < Number(expiry) - 60000) {
      return token;
    }
    // 토큰 재발급 요청
    const url = `${SECRET.KIS_BASE_URL}/oauth2/tokenP`;
    const payload = {
      "grant_type": "client_credentials",
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET
    };
    try {
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      };
      
      Logger.log(`[KIS API] 토큰 발급 요청 중... URL: ${url}`);
      const res = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(res.getContentText());
      
      if (data.access_token) {
        // 유효기간 저장 (보통 24시간)
        const expiresIn = data.expires_in * 1000; // 밀리초 변환
        props.setProperty('KIS_ACCESS_TOKEN', data.access_token);
        props.setProperty('KIS_TOKEN_EXPIRY', String(now + expiresIn));
        return data.access_token;
      } else {
        throw new Error('토큰 발급 실패: ' + JSON.stringify(data));
      }
    } catch (e) {
      Logger.log('KIS 토큰 발급 중 오류: ' + e);
      throw e;
    }
  },
  /**
   * [신규] 토큰 사전 검증 및 발급 트리거
   * 배포 전이나 실행 초기에 호출하여 토큰이 유효한지 확실히 해둠
   */
  ensureToken: function() {
    try {
      const token = this.getAccessToken();
      if (token) {
        // Logger.log("KIS 토큰 준비 완료");
        return true;
      }
    } catch (e) {
      Logger.log("KIS 토큰 준비 실패: " + e);
    }
    return false;
  },
  /**
   * 주식 현재가 조회 (국내주식)
   * @param {string} code 종목코드 (6자리)
   * @return {number} 현재가 (실패 시 null)
   */
  getKisPrice: function(code) {
    if (!code) return null;
    
    const token = this.getAccessToken();
    const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHKST01010100", // 주식현재가 시세
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    try {
      Logger.log(`[KIS API] 국내 가격 조회 요청 (${code})...`);
      const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      
      if (data.rt_cd === "0") {
        return parseInt(data.output.stck_prpr); // 주식 현재가
      } else {
        Logger.log(`KIS 가격 조회 실패(${code}): ${data.msg1}`);
        return null;
      }
    } catch (e) {
      Logger.log(`KIS API 호출 오류(${code}): ${e}`);
      return null;
    }
  },
    
  /**
   * [신규] 다수 한국 주식 현재가 병렬 조회 (속도 개선 + 안정성)
   * 과부하 방지를 위해 5개씩 끊어서 요청 (Throttling)
   * @param {Array} codes 종목코드 배열
   * @return {Object} { '005930': 60000, ... }
   */
  getKisPricesBatch: function(codes) {
    if (!codes || codes.length === 0) return {};
    
    const uniqueCodes = [...new Set(codes)];
    const token = this.getAccessToken();
    const result = {};
    
    // 5개씩 병렬 처리 (fetchAll 활용)
    const CHUNK_SIZE = 5;
    
    for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
      const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
      
      const requests = chunk.map(code => {
        return {
          url: `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "authorization": "Bearer " + token,
            "appkey": SECRET.KIS_APP_KEY,
            "appsecret": SECRET.KIS_APP_SECRET,
            "tr_id": "FHKST01010100"
          },
          method: 'get',
          muteHttpExceptions: true,
          _code: code
        };
      });
      
      try {
        const responses = UrlFetchApp.fetchAll(requests);
        responses.forEach((res, idx) => {
          const code = requests[idx]._code;
          try {
            const data = JSON.parse(res.getContentText());
            if (data.rt_cd === "0") {
              result[code] = parseInt(data.output.stck_prpr);
            } else {
              Logger.log(`KIS batch fail(${code}): ${data.msg1}`);
              result[code] = null;
            }
          } catch (e) {
            result[code] = null;
          }
        });
      } catch (e) {
        Logger.log(`Chunk fetch error: ${e}`);
      }
      
      // 배치 간 딜레이 (5개 병렬이므로 여유있게)
      Utilities.sleep(280);
    }
    
    return result;
  },
  /**
   * [신규] 다수 국내 주식 상세 정보 병렬 조회 (가격+등락+52주)
   */
  getKisStockInfoBatch: function(codes) {
    if (!codes || codes.length === 0) return {};
    const uniqueCodes = [...new Set(codes)];
    const token = this.getAccessToken();
    const result = {};
    const CHUNK_SIZE = 5;
    for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
      const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
      const requests = chunk.map(code => ({
        url: `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "authorization": "Bearer " + token,
          "appkey": SECRET.KIS_APP_KEY,
          "appsecret": SECRET.KIS_APP_SECRET,
          "tr_id": "FHKST01010100"
        },
        method: 'get',
        muteHttpExceptions: true,
        _code: code
      }));
      try {
        const responses = UrlFetchApp.fetchAll(requests);
        responses.forEach((res, idx) => {
          const code = requests[idx]._code;
          try {
            const data = JSON.parse(res.getContentText());
            if (data.rt_cd === "0") {
              const out = data.output;
              result[code] = {
                price: parseInt(out.stck_prpr),
                change: parseInt(out.prdy_vrss),
                changeRate: parseFloat(out.prdy_ctrt),
                high52: parseInt(out.w52_hgpr),
                low52: parseInt(out.w52_lwpr),
                exchange: 'KRX'
              };
            } else {
              Logger.log(`KIS info batch fail(${code}): ${data.msg1}`);
              result[code] = null;
            }
          } catch (e) { result[code] = null; }
        });
      } catch (e) { Logger.log(`KIS info batch error: ${e}`); }
      Utilities.sleep(280);
    }
    return result;
  },
  /**
   * [신규] 다수 해외 주식 가격 병렬 조회 (NAS→NYS→AMS 거래소 자동 탐색)
   */
  getOverseasStockInfoBatch: function(codes) {
    if (!codes || codes.length === 0) return {};
    const token = this.getAccessToken();
    const result = {};
    const CHUNK_SIZE = 5;
    const exchanges = ['NAS', 'NYS', 'AMS'];
    let remaining = [...new Set(codes)];
    for (const excd of exchanges) {
      if (remaining.length === 0) break;
      for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
        const chunk = remaining.slice(i, i + CHUNK_SIZE);
        const requests = chunk.map(code => ({
          url: `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${code}`,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "authorization": "Bearer " + token,
            "appkey": SECRET.KIS_APP_KEY,
            "appsecret": SECRET.KIS_APP_SECRET,
            "tr_id": "HHDFS00000300"
          },
          method: 'get',
          muteHttpExceptions: true,
          _code: code
        }));
        try {
          const responses = UrlFetchApp.fetchAll(requests);
          responses.forEach((res, idx) => {
            const code = requests[idx]._code;
            if (result[code]) return;
            try {
              const data = JSON.parse(res.getContentText());
              if (data.rt_cd === "0" && data.output) {
                const out = data.output;
                const price = parseFloat(out.last);
                if (price && price > 0) {
                  result[code] = {
                    price,
                    change: parseFloat(out.diff) || 0,
                    changeRate: parseFloat(out.rate) || 0,
                    high52: 0, low52: 0,
                    exchange: excd
                  };
                }
              }
            } catch (e) {}
          });
        } catch (e) { Logger.log(`Overseas batch error(${excd}): ${e}`); }
        Utilities.sleep(280);
      }
      remaining = remaining.filter(code => !result[code]);
    }
    return result;
  },
  /**
   * 주식 상세 정보 조회 (등락률, 최고/최저 등)
   * StockStatus.gs에서 사용
   */
  getKisStockInfo: function(code) {
    if (!code) return null;
    
    const token = this.getAccessToken();
    const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHKST01010100"
    };
    try {
      const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      
      if (data.rt_cd === "0") {
        const out = data.output;
        return {
          price: parseInt(out.stck_prpr),      // 현재가
          change: parseInt(out.prdy_vrss),     // 전일대비
          changeRate: parseFloat(out.prdy_ctrt), // 전일대비율
          high52: parseInt(out.w52_hgpr),      // 52주 최고
          low52: parseInt(out.w52_lwpr)        // 52주 최저
        };
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  },
  /**
   * 해외 주식 현재가 및 상세 정보 조회
   * @param {string} code 종목코드 (예: AVGO, AAPL)
   * @param {string} excd 거래소코드 (NAS: 나스닥, NYS: 뉴욕, 기본값: NAS)
   * @return {object} 주식 정보 (실패 시 null)
   */
  getOverseasStockInfo: function(code, excd = 'NAS') {
    if (!code) return null;
    
    const token = this.getAccessToken();
    const url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${code}`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "HHDFS00000300", // 해외주식 현재가
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    try {
      Logger.log(`[KIS API] 해외 가격 조회 요청 (${code}, ${excd})...`);
      const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      
      if (data.rt_cd === "0" && data.output) {
        const out = data.output;
        const result = {
          price: parseFloat(out.last),           // 현재가
          change: parseFloat(out.diff),          // 전일대비
          changeRate: parseFloat(out.rate),      // 전일대비율
          high52: 0,
          low52: 0,
          exchange: excd                         // 거래소 코드 추가
        };
        
        // 52주 최고/최저가는 별도 API로 조회 (inquire-ccnl)
        try {
          // 오늘 날짜 (YYYYMMDD 형식)
          const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
          
          const ccnlUrl = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/inquire-ccnl?AUTH=&EXCD=${excd}&SYMB=${code}&GUBN=0&BYMD=${today}&MODP=1`;
          const ccnlHeaders = {
            "content-type": "application/json; charset=utf-8",
            "authorization": "Bearer " + token,
            "appkey": SECRET.KIS_APP_KEY,
            "appsecret": SECRET.KIS_APP_SECRET,
            "tr_id": "HHDFS76240000"
          };
          
          const ccnlRes = UrlFetchApp.fetch(ccnlUrl, { headers: ccnlHeaders, muteHttpExceptions: true });
          const ccnlData = JSON.parse(ccnlRes.getContentText());
          
          if (ccnlData.rt_cd === "0" && ccnlData.output2 && ccnlData.output2.length > 0) {
            // 최근 1년 데이터에서 최고/최저 찾기
            let high = 0;
            let low = 999999999;
            
            for (const day of ccnlData.output2) {
              const h = parseFloat(day.high || 0);
              const l = parseFloat(day.low || 0);
              if (h > high) high = h;
              if (l > 0 && l < low) low = l;
            }
            
            result.high52 = high;
            result.low52 = low === 999999999 ? 0 : low;
          }
        } catch (e) {
          Logger.log(`52주 최고/최저 조회 실패(${code}): ${e}`);
        }
        
        return result;
      } else {
        // Logger.log(`해외주식 조회 실패(${code}, ${excd}): ${data.msg1 || 'Unknown error'}`);
        return null;
      }
    } catch (e) {
      Logger.log(`해외주식 API 호출 오류(${code}): ${e}`);
      return null;
    }
  },
  /**
   * 해외 주식 자동 거래소 찾기 (NAS -> NYS -> AMS 순서)
   */
  getOverseasStockInfoAuto: function(code) {
    const exchanges = ['NAS', 'NYS', 'AMS'];
    for (const ex of exchanges) {
      const info = this.getOverseasStockInfo(code, ex);
      if (info) return info;
    }
    return null;
  },
  /**
   * 주식 과거 가격 조회 (일봉 데이터)
   * @param {string} code 종목코드
   * @param {string} date 조회 날짜 (YYYYMMDD)
   * @param {boolean} isOverseas 해외주식 여부
   * @return {number} 해당 날짜의 종가 (실패 시 null)
   */
  getHistoricalPrice: function(code, date, isOverseas = false, exchange = 'NAS') {
    if (!code || !date) return null;
    
    const token = this.getAccessToken();
    
    if (isOverseas) {
      // 해외주식 일봉 조회
      const url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${exchange}&SYMB=${code}&GUBN=0&BYMD=${date}&MODP=0`;
      const headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer " + token,
        "appkey": SECRET.KIS_APP_KEY,
        "appsecret": SECRET.KIS_APP_SECRET,
        "tr_id": "HHDFS76240000"
      };
      
      try {
        const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
        const data = JSON.parse(res.getContentText());
        
        if (data.rt_cd === "0" && data.output2 && data.output2.length > 0) {
          return parseFloat(data.output2[0].clos); // 종가
        }
      } catch (e) {
        Logger.log(`해외 과거가 조회 오류(${code}, ${date}): ${e}`);
      }
    } else {
      // 국내주식 일봉 조회 (기간별 차트 API 사용 - 30일 이상 조회 가능)
      // 휴일 고려하여 조회일 기준 7일 전부터 조회
      const targetDate = date; // YYYYMMDD
      
      // 7일 전 날짜 계산
      const d = new Date(targetDate.substring(0,4), parseInt(targetDate.substring(4,6))-1, targetDate.substring(6,8));
      d.setDate(d.getDate() - 7);
      const startDate = Utilities.formatDate(d, 'Asia/Seoul', 'yyyyMMdd');
      const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}&FID_INPUT_DATE_1=${startDate}&FID_INPUT_DATE_2=${targetDate}&FID_PERIOD_DIV_CODE=D&FID_ORG_ADJ_PRC=0`;
      
      const headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer " + token,
        "appkey": SECRET.KIS_APP_KEY,
        "appsecret": SECRET.KIS_APP_SECRET,
        "tr_id": "FHKST03010100" // 주식기간별시세(일/주/월/년)
      };
      
      try {
        const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
        const data = JSON.parse(res.getContentText());
        
        if (data.rt_cd === "0" && data.output2 && data.output2.length > 0) {
          // output2 배열의 첫 번째 요소가 가장 최근 날짜(targetDate에 가장 가까운 날)
          // API 응답은 내림차순(최신순)으로 옴
          return parseInt(data.output2[0].stck_clpr); // 종가
        }
      } catch (e) {
        Logger.log(`국내 과거가 조회 오류(${code}, ${date}): ${e}`);
      }
    }
    
    return null;
  },
  /**
   * 기간별 등락률 계산 (Legacy - 개별 조회용)
   */
  getPeriodReturn: function(code, currentPrice, months, isOverseas = false, exchange = 'NAS') {
    if (!code || !currentPrice || !months) return '-';
    
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setMonth(pastDate.getMonth() - months);
    
    const dateStr = Utilities.formatDate(pastDate, 'Asia/Seoul', 'yyyyMMdd');
    
    const pastPrice = this.getHistoricalPrice(code, dateStr, isOverseas, exchange);
    
    if (pastPrice && pastPrice > 0) {
      const returnRate = ((currentPrice - pastPrice) / pastPrice * 100).toFixed(2);
      return returnRate + '%';
    }
    
    return '-';
  },
  /**
   * [최적화] 최근 1년치 데이터 조회 (주봉 사용)
   * 일봉(D) 대신 주봉(W)을 사용하여 1번의 호출로 1년치(약 52주) 데이터를 모두 가져옴.
   */
  getStockHistory: function(code, isOverseas = false, exchange = 'NAS') {
    // 단일 조회용 (기존 유지)
    const req = this.createHistoryRequest(code, isOverseas, exchange);
    if (!req) return [];
    
    try {
      const res = UrlFetchApp.fetch(req.url, { headers: req.headers, muteHttpExceptions: true });
      return this.parseHistoryResponse(res, isOverseas, code, exchange);
    } catch (e) {
      Logger.log(`History(Weekly) 조회 오류(${code}): ${e}`);
      return [];
    }
  },
  /**
   * [신규] 병렬 처리를 위한 요청 객체 생성 헬퍼
   */
  createHistoryRequest: function(code, isOverseas, exchange) {
    if (!code) return null;
    
    const token = this.getAccessToken();
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    
    // 1년 전 날짜 계산 (주봉이므로 넉넉하게 1년 2개월 전부터 조회)
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setMonth(d.getMonth() - 2); 
    const startDate = Utilities.formatDate(d, 'Asia/Seoul', 'yyyyMMdd');
    
    let url, headers;
    
    if (isOverseas) {
      // 해외주식: FID_ORG_ADJ_PRC=1 (수정주가 반영) 추가
      url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/inquire-daily-chartprice?FID_COND_MRKT_DIV_CODE=${exchange}&FID_INPUT_ISCD=${code}&FID_INPUT_DATE_1=${startDate}&FID_INPUT_DATE_2=${today}&FID_PERIOD_DIV_CODE=W&FID_ORG_ADJ_PRC=1`;
      headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer " + token,
        "appkey": SECRET.KIS_APP_KEY,
        "appsecret": SECRET.KIS_APP_SECRET,
        "tr_id": "HHDFS76410000"
      };
    } else {
      url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}&FID_INPUT_DATE_1=${startDate}&FID_INPUT_DATE_2=${today}&FID_PERIOD_DIV_CODE=W&FID_ORG_ADJ_PRC=1`;
      headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer " + token,
        "appkey": SECRET.KIS_APP_KEY,
        "appsecret": SECRET.KIS_APP_SECRET,
        "tr_id": "FHKST03010100"
      };
    }
    
    return {
      url: url,
      headers: headers,
      method: 'get',
      muteHttpExceptions: true,
      // 사용자 정의 필드 (나중에 응답 매핑용)
      _code: code,
      _isOverseas: isOverseas,
      _exchange: exchange
    };
  },
  /**
   * [신규] 병렬 처리 응답 파싱 헬퍼
   */
  parseHistoryResponse: function(res, isOverseas, code, exchange) {
    try {
      const data = JSON.parse(res.getContentText());
      
      if (data.rt_cd === "0" && data.output2 && data.output2.length > 0) {
        return data.output2.map(item => ({
          date: item.stck_bsop_date || item.xymd,
          close: parseFloat(item.stck_clpr || item.clos),
          high: parseFloat(item.stck_hgpr || item.high),
          low: parseFloat(item.stck_lwpr || item.low)
        }));
      } else if (isOverseas) {
        // 주봉 실패 시 Fallback은 병렬 처리에서 제외 (복잡도 증가 방지)
        // 필요하다면 여기서 동기적으로 호출하거나 무시
        return []; 
      }
    } catch (e) {
      Logger.log(`Parse Error(${code}): ${e}`);
    }
    return [];
  },
  /**
   * [신규] 다수 종목 히스토리 병렬 조회 (Batch Processing)
   * @param {Array} items - [{code: '005930', isOverseas: false}, ...]
   * @return {Object} { '005930': [history...], 'AAPL': [history...] }
   */
  fetchAllStockHistory: function(items) {
    if (!items || items.length === 0) return {};
    
    // 1. 요청 객체 생성
    const requests = items.map(item => {
      const req = this.createHistoryRequest(item.code, item.isOverseas, item.exchange || 'NAS');
      return req ? { ...req, _code: item.code } : null; // _code 보존
    }).filter(r => r !== null);
    
    if (requests.length === 0) return {};
    // 2. 병렬 실행 (UrlFetchApp.fetchAll)
    // GAS fetchAll은 요청 객체 배열을 받음 (headers, method 등 포함)
    const responses = UrlFetchApp.fetchAll(requests);
    
    // 3. 결과 매핑
    const resultMap = {};
    
    responses.forEach((res, index) => {
      const req = requests[index];
      const code = req._code;
      const isOverseas = req._isOverseas;
      const exchange = req._exchange;
      
      resultMap[code] = this.parseHistoryResponse(res, isOverseas, code, exchange);
    });
    
    return resultMap;
  },
  /**
   * 해외주식 일봉 조회 Fallback (최근 100일)
   */
  getOverseasDailyPriceFallback: function(code, exchange) {
    const token = this.getAccessToken();
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    const url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${exchange}&SYMB=${code}&GUBN=0&BYMD=${today}&MODP=0`;
    
    try {
      const res = UrlFetchApp.fetch(url, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "authorization": "Bearer " + token,
          "appkey": SECRET.KIS_APP_KEY,
          "appsecret": SECRET.KIS_APP_SECRET,
          "tr_id": "HHDFS76240000"
        },
        muteHttpExceptions: true
      });
      const data = JSON.parse(res.getContentText());
      if (data.rt_cd === "0" && data.output2) {
        return data.output2.map(item => ({
          date: item.xymd,
          close: parseFloat(item.clos),
          high: parseFloat(item.high),
          low: parseFloat(item.low)
        }));
      }
    } catch (e) {
      Logger.log(`Fallback 조회 실패: ${e}`);
    }
    return [];
  },
  /**
   * [개선] 히스토리 데이터를 기반으로 통계 계산
   * 데이터가 부족할 경우(예: 상장한 지 1년 미만), 가능한 가장 오래된 데이터를 사용하여 계산 시도
   */
  calculateStats: function(history, currentPrice) {
    if (!history || history.length === 0) return null;
    
    const now = new Date();
    
    // 날짜 차이 계산 헬퍼
    const findPriceAgo = (months) => {
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() - months);
      const targetStr = Utilities.formatDate(targetDate, 'Asia/Seoul', 'yyyyMMdd');
      
      // targetStr보다 작거나 같은 날짜 중 가장 최근 날짜 찾기
      // history는 내림차순(최신->과거) 정렬되어 있다고 가정
      // 따라서 뒤에서부터 찾거나, filter 후 0번을 쓰거나 해야 함.
      // history: [20241206, 20241205, ...]
      
      // targetStr 이하인 날짜들 중 가장 큰(최신) 날짜
      const candidates = history.filter(h => h.date <= targetStr);
      
      if (candidates.length > 0) {
        return candidates[0].close; // 그 중 가장 최신(가장 가까운 과거)
      } else {
        // 만약 targetStr보다 더 과거의 데이터가 아예 없다면? (즉, 상장한 지 얼마 안 됨)
        // 가장 오래된 데이터(history의 마지막)라도 사용할지 결정해야 함.
        // 1년 수익률인데 상장 6개월차라면 '-' 표시가 맞을 수도 있고, 상장 이후 수익률을 보여줄 수도 있음.
        // 여기서는 '데이터 없음'으로 처리하되, 1년 미만 신규 상장주 등을 위해
        // 요청 기간보다 데이터가 짧으면 가장 오래된 데이터를 리턴하지 않고 null 리턴.
        return null; 
      }
    };
    const price1M = findPriceAgo(1);
    const price3M = findPriceAgo(3);
    const price6M = findPriceAgo(6);
    const price1Y = findPriceAgo(12);
    
    // 52주(1년) 최고/최저
    let high52 = 0;
    let low52 = 999999999;
    
    history.forEach(h => {
      if (h.high > high52) high52 = h.high;
      if (h.low > 0 && h.low < low52) low52 = h.low;
    });
    
    if (low52 === 999999999) low52 = 0;
    const calcRate = (past) => past ? ((currentPrice - past) / past * 100).toFixed(2) + '%' : '-';
    return {
      return1M: calcRate(price1M),
      return3M: calcRate(price3M),
      return6M: calcRate(price6M),
      return1Y: calcRate(price1Y),
      high52: high52,
      low52: low52
    };
  },
  /**
   * [보정] 해외주식 거래소 자동 찾기 (Broadcom 등 예외 처리 포함)
   */
  getOverseasStockInfoAuto: function(code) {
    // 1. Broadcom(AVGO) 등 특정 종목 예외 처리
    // AVGO는 나스닥(NAS)에 있지만 API에서 가끔 조회가 안 될 때가 있음.
    // 하지만 기본적으로 NAS임.

    const exchanges = ['NAS', 'NYS', 'AMS'];
    for (const ex of exchanges) {
      const info = this.getOverseasStockInfo(code, ex);
      if (info) return info;
    }
    return null;
  },

  /**
   * [신규] 국내 지수 현재값 조회 (KOSPI, KOSDAQ, KOSPI200 등)
   * @param {string} code 업종코드 (KOSPI=0001, KOSDAQ=1001, KOSPI200=2001)
   * @return {object|null} { value, change, changePct } — 실패 시 null
   */
  getDomesticIndex: function(code) {
    if (!code) return null;
    const token = this.getAccessToken();
    // 국내업종 현재지수 API
    // tr_id: FHPUP02100000 — 국내업종 현재지수
    const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price?FID_COND_MRKT_DIV_CODE=U&FID_INPUT_ISCD=${code}`;
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHPUP02100000"
    };
    try {
      const res = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      if (data.rt_cd === "0" && data.output) {
        const out = data.output;
        return {
          value:     parseFloat(out.bstp_nmix_prpr) || 0,    // 업종지수 현재가
          change:    parseFloat(out.bstp_nmix_prdy_vrss) || 0, // 전일대비
          changePct: parseFloat(out.bstp_nmix_prdy_ctrt) || 0  // 전일대비율(%)
        };
      } else {
        Logger.log(`국내지수 조회 실패(${code}): ${data.msg1}`);
        return null;
      }
    } catch (e) {
      Logger.log(`국내지수 API 오류(${code}): ${e}`);
      return null;
    }
  },

  /**
   * [신규] 해외 지수 현재값 조회 (S&P500, NASDAQ100, 다우, SOX 등)
   * @param {string} code 심볼 (SPX, NDX, DJI, SOX 등)
   * @param {string} excd 거래소 코드 (SPI=S&P, NAS=나스닥, NYS=NYSE 등)
   * @return {object|null} { value, change, changePct } — 실패 시 null
   *
   * TODO: KIS 해외지수 API(HHDFS76410000)의 정확한 파라미터 확인 필요.
   *       실패 시 MobileAPI에서 GOOGLEFINANCE fallback 사용.
   */
  getOverseasIndex: function(code, excd = 'NAS') {
    if (!code) return null;
    const token = this.getAccessToken();
    // 해외지수는 해외주식 현재가 API로 조회 시도
    const url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${code}`;
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "HHDFS00000300"
    };
    try {
      const res = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      if (data.rt_cd === "0" && data.output) {
        const out = data.output;
        const value = parseFloat(out.last) || 0;
        if (value <= 0) return null;
        return {
          value,
          change:    parseFloat(out.diff) || 0,
          changePct: parseFloat(out.rate) || 0
        };
      } else {
        Logger.log(`해외지수 조회 실패(${code}, ${excd}): ${data.msg1}`);
        return null;
      }
    } catch (e) {
      Logger.log(`해외지수 API 오류(${code}): ${e}`);
      return null;
    }
  },

  /**
   * 코스피200 선물 최근월물 종목코드 계산 (101W + YYMM)
   * 분기물(3·6·9·12월) 기준 — 당월이 만기 전이면 당월, 이후면 다음 분기
   */
  getNearestKospi200Code: function() {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // 1~12
    const quarters = [3, 6, 9, 12];
    let contractMonth = quarters.find(q => q >= month);
    if (!contractMonth) { contractMonth = 3; year++; }
    return '101W' + String(year).slice(-2) + String(contractMonth).padStart(2, '0');
  },

  /**
   * [신규] 국내 선물 현재값 조회 (코스피200 선물)
   * @param {string} code 선물코드 또는 'NEAREST' (자동 계산)
   * @return {object|null} { value, change, changePct } — 실패 시 null
   */
  getDomesticFutures: function(code) {
    if (!code) return null;
    const actualCode = code === 'NEAREST' ? this.getNearestKospi200Code() : code;
    const token = this.getAccessToken();
    const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-futureoption/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=F&FID_INPUT_ISCD=${actualCode}`;
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHMIF10000000"
    };
    try {
      const res = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      Logger.log(`국내선물 응답(${actualCode}): rt_cd=${data.rt_cd}, msg=${data.msg1}, keys=${Object.keys(data).join(',')}`);
      if (data.rt_cd === "0" && data.output1) {
        const out = data.output1;
        Logger.log(`국내선물 output1 keys: ${Object.keys(out).join(',')}`);
        const value = parseFloat(out.futs_prpr) || 0;
        if (value <= 0) return null;
        return {
          value,
          change:    parseFloat(out.futs_prdy_vrss) || 0,
          changePct: parseFloat(out.futs_prdy_ctrt) || 0
        };
      } else {
        Logger.log(`국내선물 조회 실패(${actualCode}): rt_cd=${data.rt_cd}, msg=${data.msg1}`);
        return null;
      }
    } catch (e) {
      Logger.log(`국내선물 API 오류(${code}): ${e}`);
      return null;
    }
  }
};