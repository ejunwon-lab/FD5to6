/**
 * MobileView.gs
 * 모바일 최적화 뷰
 *
 * 기능:
 * - 모바일 친화적인 반응형 UI
 * - 간단한 포트폴리오 조회
 * - 터치 최적화
 */

/**
 * 모바일 뷰 표시
 */
function showMobileView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('투자수익 트래커 시트를 찾을 수 없습니다.');
    return;
  }

  const data = collectMobileData(ss);
  const html = createMobileHTML(data);

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(600)
    .setTitle('📱 모바일 뷰');

  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '투자 현황');
}

/**
 * 모바일용 데이터 수집
 */
function collectMobileData(ss) {
  const { values, idx } = getTrackerActiveData(ss);

  const EXCLUDE_KEYWORDS = CONFIG.CODES.EXCLUDE_KEYWORDS;

  let totalInvestment = 0;
  let totalCurrentValue = 0;
  const stocks = [];

  for (const row of values) {
    const code = row[idx.CODE];
    const name = row[idx.STATUS_NAME];

    if (!code || EXCLUDE_KEYWORDS.some(k => String(name || '').includes(k))) {
      continue;
    }

    const quantity = row[idx.QUANTITY] || 0;
    if (!quantity || quantity <= 0) continue;

    const investment = row[idx.OP_BUY] || 0;
    const currentValue = row[idx.OP_CURRENT] || 0;
    const profit = row[idx.OP_PROFIT] || 0;
    const profitRate = parseFloat(row[idx.PROFIT_RATE]) || 0;
    const change = row[idx.STATUS_CHANGE] || 0;
    const changeRate = row[idx.STATUS_PCT] || '';

    totalInvestment += investment;
    totalCurrentValue += currentValue;

    stocks.push({
      code: code,
      name: name,
      investment: investment,
      currentValue: currentValue,
      profit: profit,
      profitRate: profitRate,
      change: change,
      changeRate: changeRate
    });
  }

  const totalProfit = totalCurrentValue - totalInvestment;
  const totalProfitRate = totalInvestment > 0
    ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100)
    : 0;

  // 수익률 순 정렬
  stocks.sort((a, b) => b.profitRate - a.profitRate);

  return {
    totalInvestment: totalInvestment,
    totalCurrentValue: totalCurrentValue,
    totalProfit: totalProfit,
    totalProfitRate: totalProfitRate,
    stocks: stocks,
    timestamp: new Date().toLocaleString('ko-KR')
  };
}

/**
 * 모바일 HTML 생성
 */
function createMobileHTML(data) {
  const profitColor = data.totalProfit >= 0 ? '#22c55e' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9fafb;
      color: #1f2937;
      overflow-x: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .header .timestamp {
      font-size: 12px;
      opacity: 0.9;
    }

    .summary {
      background: white;
      margin: -20px 16px 16px 16px;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .summary-main {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 16px;
    }

    .summary-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .summary-value {
      font-size: 32px;
      font-weight: 700;
      color: ${profitColor};
      margin-bottom: 4px;
    }

    .summary-profit {
      font-size: 16px;
      color: ${profitColor};
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-item-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .summary-item-value {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
    }

    .stocks-container {
      padding: 0 16px 16px 16px;
    }

    .stock-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }

    .stock-card:active {
      transform: scale(0.98);
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }

    .stock-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .stock-name {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .stock-code {
      font-size: 12px;
      color: #9ca3af;
    }

    .stock-profit-badge {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      text-align: right;
    }

    .stock-profit-badge.positive {
      background: #dcfce7;
      color: #15803d;
    }

    .stock-profit-badge.negative {
      background: #fee2e2;
      color: #b91c1c;
    }

    .stock-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }

    .stock-detail {
      font-size: 13px;
    }

    .stock-detail-label {
      color: #6b7280;
      font-size: 11px;
      margin-bottom: 4px;
    }

    .stock-detail-value {
      font-weight: 600;
      color: #374151;
    }

    .refresh-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      transition: transform 0.2s;
    }

    .refresh-button:active {
      transform: scale(0.95);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 투자 현황</h1>
    <div class="timestamp">${data.timestamp}</div>
  </div>

  <div class="summary">
    <div class="summary-main">
      <div class="summary-label">총 수익률</div>
      <div class="summary-value">${data.totalProfit >= 0 ? '+' : ''}${data.totalProfitRate.toFixed(2)}%</div>
      <div class="summary-profit">${data.totalProfit >= 0 ? '+' : ''}${formatNumber(data.totalProfit)}원</div>
    </div>

    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-item-label">투자금</div>
        <div class="summary-item-value">${formatNumberShort(data.totalInvestment)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">평가액</div>
        <div class="summary-item-value">${formatNumberShort(data.totalCurrentValue)}</div>
      </div>
    </div>
  </div>

  <div class="stocks-container">
    ${data.stocks.map(stock => generateMobileStockCard(stock)).join('')}
  </div>

  <button class="refresh-button" onclick="location.reload()">↻</button>
</body>
</html>
  `;
}

function generateMobileStockCard(stock) {
  const isProfit = stock.profit >= 0;
  const profitClass = isProfit ? 'positive' : 'negative';
  const profitSign = isProfit ? '+' : '';

  return `
    <div class="stock-card">
      <div class="stock-header">
        <div>
          <div class="stock-name">${stock.name}</div>
          <div class="stock-code">${stock.code}</div>
        </div>
        <div class="stock-profit-badge ${profitClass}">
          ${profitSign}${stock.profitRate.toFixed(1)}%
        </div>
      </div>

      <div class="stock-details">
        <div class="stock-detail">
          <div class="stock-detail-label">투자금</div>
          <div class="stock-detail-value">${formatNumberShort(stock.investment)}</div>
        </div>
        <div class="stock-detail">
          <div class="stock-detail-label">평가액</div>
          <div class="stock-detail-value">${formatNumberShort(stock.currentValue)}</div>
        </div>
        <div class="stock-detail">
          <div class="stock-detail-label">평가손익</div>
          <div class="stock-detail-value" style="color: ${isProfit ? '#22c55e' : '#ef4444'};">
            ${profitSign}${formatNumberShort(stock.profit)}
          </div>
        </div>
        <div class="stock-detail">
          <div class="stock-detail-label">당일변동</div>
          <div class="stock-detail-value">${stock.changeRate}</div>
        </div>
      </div>
    </div>
  `;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('ko-KR');
}

function formatNumberShort(num) {
  num = Math.round(num);

  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '억';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(0) + '만';
  } else {
    return num.toLocaleString('ko-KR');
  }
}
