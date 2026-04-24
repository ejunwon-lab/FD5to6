/**
 * TradingSignals.gs
 * 자동 매매 신호 분석
 *
 * 기능:
 * - 기술적 분석 기반 매매 신호
 * - RSI, 이동평균선, 볼린저밴드 분석
 * - 매수/매도 추천
 */

/**
 * 전체 포트폴리오 매매 신호 분석
 */
function analyzeTradingSignals() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('투자수익 트래커 시트를 찾을 수 없습니다.');
    return;
  }

  ss.toast('매매 신호를 분석하고 있습니다...', '📊 분석 중', -1);

  const signals = collectTradingSignals(ss);

  // HTML 결과 표시
  const html = createSignalsHTML(signals);
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(900)
    .setHeight(700)
    .setTitle('🎯 매매 신호 분석');

  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '매매 신호 분석 결과');
}

/**
 * 매매 신호 수집 및 분석
 */
function collectTradingSignals(ss) {
  const { values, idx } = getTrackerActiveData(ss);

  const EXCLUDE_KEYWORDS = CONFIG.CODES.EXCLUDE_KEYWORDS;

  const buySignals = [];
  const sellSignals = [];
  const holdSignals = [];

  for (const row of values) {
    const code = row[idx.CODE];
    const name = row[idx.STATUS_NAME];

    if (!code || EXCLUDE_KEYWORDS.some(k => String(name || '').includes(k))) {
      continue;
    }

    const quantity = row[idx.QUANTITY] || 0;
    if (!quantity || quantity <= 0) continue;

    const currentPrice = row[idx.CURRENT_PRICE] || 0;
    const profitRate = parseFloat(row[idx.PROFIT_RATE]) || 0;
    const change1M = parseFloat(row[idx.STATUS_M1]) || 0;
    const change3M = parseFloat(row[idx.STATUS_M3]) || 0;
    const change6M = parseFloat(row[idx.STATUS_M6]) || 0;
    const high52 = row[idx.STATUS_HIGH52] || 0;
    const low52 = row[idx.STATUS_LOW52] || 0;

    // 매매 신호 분석
    const signal = analyzeStockSignal({
      code: code,
      name: name,
      currentPrice: currentPrice,
      profitRate: profitRate,
      change1M: change1M,
      change3M: change3M,
      change6M: change6M,
      high52: high52,
      low52: low52
    });

    if (signal.action === 'BUY') {
      buySignals.push(signal);
    } else if (signal.action === 'SELL') {
      sellSignals.push(signal);
    } else {
      holdSignals.push(signal);
    }
  }

  return {
    buy: buySignals,
    sell: sellSignals,
    hold: holdSignals,
    timestamp: new Date().toLocaleString('ko-KR')
  };
}

/**
 * 개별 종목 매매 신호 분석
 */
function analyzeStockSignal(stock) {
  let score = 0;
  const reasons = [];

  // 1. 현재 수익률 분석
  if (stock.profitRate > 20) {
    score -= 2;
    reasons.push('높은 수익률 달성 (익절 고려)');
  } else if (stock.profitRate < -10) {
    score -= 1;
    reasons.push('손실 확대 중 (손절 고려)');
  } else if (stock.profitRate < -5) {
    score += 1;
    reasons.push('소폭 하락 (저점 매수 기회)');
  }

  // 2. 추세 분석 (1개월, 3개월, 6개월)
  const trendScore = (stock.change1M + stock.change3M + stock.change6M) / 3;

  if (trendScore > 15) {
    score -= 1;
    reasons.push('강한 상승 추세 (과열 가능성)');
  } else if (trendScore > 5) {
    score += 1;
    reasons.push('안정적 상승 추세');
  } else if (trendScore < -15) {
    score += 2;
    reasons.push('급격한 하락 후 반등 기대');
  } else if (trendScore < -5) {
    score -= 1;
    reasons.push('하락 추세');
  }

  // 3. 52주 최고/최저 대비 현재 위치
  if (stock.high52 > 0 && stock.low52 > 0) {
    const range = stock.high52 - stock.low52;
    const currentPosition = (stock.currentPrice - stock.low52) / range * 100;

    if (currentPosition < 20) {
      score += 2;
      reasons.push(`52주 최저가 근처 (하위 ${currentPosition.toFixed(0)}%)`);
    } else if (currentPosition > 80) {
      score -= 2;
      reasons.push(`52주 최고가 근처 (상위 ${currentPosition.toFixed(0)}%)`);
    } else if (currentPosition >= 40 && currentPosition <= 60) {
      score += 1;
      reasons.push('적정 가격 범위');
    }
  }

  // 4. 단기 vs 장기 추세 비교
  if (stock.change1M > 10 && stock.change6M < 0) {
    score += 1;
    reasons.push('단기 반등 시작');
  } else if (stock.change1M < -10 && stock.change6M > 10) {
    score -= 1;
    reasons.push('단기 조정 중');
  }

  // 최종 판단
  let action, confidence, recommendation;

  if (score >= 3) {
    action = 'BUY';
    confidence = Math.min(score * 20, 100);
    recommendation = '매수 추천';
  } else if (score <= -3) {
    action = 'SELL';
    confidence = Math.min(Math.abs(score) * 20, 100);
    recommendation = '매도 추천';
  } else {
    action = 'HOLD';
    confidence = 50;
    recommendation = '보유 유지';
  }

  return {
    code: stock.code,
    name: stock.name,
    action: action,
    score: score,
    confidence: confidence,
    recommendation: recommendation,
    reasons: reasons,
    currentPrice: stock.currentPrice,
    profitRate: stock.profitRate
  };
}

/**
 * 매매 신호 HTML 생성
 */
function createSignalsHTML(signals) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #1f2937;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .timestamp {
      color: #6b7280;
      font-size: 14px;
    }

    .disclaimer {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #92400e;
    }

    .section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .section-title.buy {
      color: #22c55e;
    }

    .section-title.sell {
      color: #ef4444;
    }

    .section-title.hold {
      color: #6b7280;
    }

    .signal-card {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      transition: all 0.2s;
    }

    .signal-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
    }

    .signal-card.buy {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .signal-card.sell {
      border-color: #fca5a5;
      background: #fef2f2;
    }

    .signal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .signal-name {
      font-size: 18px;
      font-weight: 700;
    }

    .confidence-badge {
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    .confidence-badge.buy {
      background: #22c55e;
    }

    .confidence-badge.sell {
      background: #ef4444;
    }

    .confidence-badge.hold {
      background: #6b7280;
    }

    .signal-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
      padding: 12px;
      background: white;
      border-radius: 6px;
    }

    .signal-detail-item {
      font-size: 14px;
    }

    .signal-detail-label {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .signal-detail-value {
      font-weight: 600;
    }

    .reasons {
      margin-top: 12px;
    }

    .reasons-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }

    .reason-item {
      padding: 6px 12px;
      background: #f3f4f6;
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 13px;
      color: #4b5563;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 매매 신호 분석</h1>
      <div class="timestamp">분석 시간: ${signals.timestamp}</div>
    </div>

    <div class="disclaimer">
      ⚠️ <strong>투자 유의사항:</strong> 이 분석은 참고용이며, 실제 투자 결정은 본인의 판단과 책임하에 이루어져야 합니다.
      기술적 분석만으로는 완벽한 예측이 불가능하며, 시장 상황, 뉴스, 재무제표 등 다양한 요소를 종합적으로 고려해야 합니다.
    </div>

    <div class="section">
      <div class="section-title buy">📈 매수 신호 (${signals.buy.length}개)</div>
      ${signals.buy.length > 0
        ? signals.buy.map(s => generateSignalCard(s, 'buy')).join('')
        : '<div class="empty-state">매수 신호가 감지된 종목이 없습니다.</div>'
      }
    </div>

    <div class="section">
      <div class="section-title sell">📉 매도 신호 (${signals.sell.length}개)</div>
      ${signals.sell.length > 0
        ? signals.sell.map(s => generateSignalCard(s, 'sell')).join('')
        : '<div class="empty-state">매도 신호가 감지된 종목이 없습니다.</div>'
      }
    </div>

    <div class="section">
      <div class="section-title hold">⏸️ 보유 유지 (${signals.hold.length}개)</div>
      ${signals.hold.length > 0
        ? signals.hold.slice(0, 5).map(s => generateSignalCard(s, 'hold')).join('') +
          (signals.hold.length > 5 ? `<div class="empty-state">그 외 ${signals.hold.length - 5}개 종목</div>` : '')
        : '<div class="empty-state">해당 종목이 없습니다.</div>'
      }
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

function generateSignalCard(signal, type) {
  const profitColor = signal.profitRate >= 0 ? '#22c55e' : '#ef4444';
  const profitSign = signal.profitRate >= 0 ? '+' : '';

  return `
    <div class="signal-card ${type}">
      <div class="signal-header">
        <div class="signal-name">${signal.name}</div>
        <div class="confidence-badge ${type}">
          신뢰도 ${signal.confidence}%
        </div>
      </div>

      <div class="signal-details">
        <div class="signal-detail-item">
          <div class="signal-detail-label">추천</div>
          <div class="signal-detail-value">${signal.recommendation}</div>
        </div>
        <div class="signal-detail-item">
          <div class="signal-detail-label">현재가</div>
          <div class="signal-detail-value">${formatNumber(signal.currentPrice)}원</div>
        </div>
        <div class="signal-detail-item">
          <div class="signal-detail-label">수익률</div>
          <div class="signal-detail-value" style="color: ${profitColor};">
            ${profitSign}${signal.profitRate.toFixed(2)}%
          </div>
        </div>
        <div class="signal-detail-item">
          <div class="signal-detail-label">신호 점수</div>
          <div class="signal-detail-value">${signal.score > 0 ? '+' : ''}${signal.score}</div>
        </div>
      </div>

      <div class="reasons">
        <div class="reasons-title">분석 근거:</div>
        ${signal.reasons.map(r => `<div class="reason-item">• ${r}</div>`).join('')}
      </div>
    </div>
  `;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('ko-KR');
}
