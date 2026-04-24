/**
 * Dashboard.gs
 * 투자 수익률 대시보드 및 시각화 기능
 *
 * 기능:
 * - 포트폴리오 전체 수익률 요약
 * - 자산별/계좌별/종목별 시각화
 * - 실시간 손익 현황
 */

/**
 * 대시보드 메인 함수
 * 투자 현황을 요약하여 보여줍니다
 */
function showDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('투자수익 트래커 시트를 찾을 수 없습니다.');
    return;
  }

  // 데이터 수집
  const stats = collectDashboardStats(ss);

  // HTML 대시보드 생성
  const html = createDashboardHTML(stats);

  // 모달로 표시
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(800)
    .setHeight(600)
    .setTitle('📊 투자 대시보드');

  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '투자 현황 대시보드');
}

/**
 * 대시보드 통계 수집
 */
function collectDashboardStats(ss) {
  const { values, idx } = getTrackerActiveData(ss);

  const EXCLUDE_KEYWORDS = CONFIG.CODES.EXCLUDE_KEYWORDS;

  let totalInvestment = 0;    // 총 투자금
  let totalCurrentValue = 0;  // 총 평가금액
  let totalProfit = 0;        // 총 손익

  const byAccount = {};       // 계좌별 통계
  const byCategory = {};      // 자산별 통계
  const stocks = [];          // 개별 종목 정보

  for (const row of values) {
    const code = row[idx.CODE];
    const name = row[idx.STATUS_NAME];
    const category = row[idx.CATEGORY];
    const account = row[idx.ACCOUNT_TYPE];

    // 제외 대상 확인
    if (!code || EXCLUDE_KEYWORDS.some(k => String(name || '').includes(k))) {
      continue;
    }

    const quantity = row[idx.QUANTITY] || 0;
    const avgPrice = row[idx.UNIT_PRICE] || 0;
    const currentPrice = row[idx.CURRENT_PRICE] || 0;
    const investment = row[idx.OP_BUY] || 0;
    const currentValue = row[idx.OP_CURRENT] || 0;
    const profit = row[idx.OP_PROFIT] || 0;
    const profitRate = row[idx.PROFIT_RATE] || 0;

    if (!quantity || quantity <= 0) continue;

    // 전체 합계
    totalInvestment += investment;
    totalCurrentValue += currentValue;
    totalProfit += profit;

    // 계좌별 집계
    if (account) {
      if (!byAccount[account]) {
        byAccount[account] = { investment: 0, currentValue: 0, profit: 0, count: 0 };
      }
      byAccount[account].investment += investment;
      byAccount[account].currentValue += currentValue;
      byAccount[account].profit += profit;
      byAccount[account].count++;
    }

    // 자산별 집계
    if (category) {
      if (!byCategory[category]) {
        byCategory[category] = { investment: 0, currentValue: 0, profit: 0, count: 0 };
      }
      byCategory[category].investment += investment;
      byCategory[category].currentValue += currentValue;
      byCategory[category].profit += profit;
      byCategory[category].count++;
    }

    // 개별 종목 (수익률 높은 순으로 나중에 정렬)
    stocks.push({
      code: code,
      name: name,
      category: category,
      account: account,
      quantity: quantity,
      avgPrice: avgPrice,
      currentPrice: currentPrice,
      investment: investment,
      currentValue: currentValue,
      profit: profit,
      profitRate: profitRate
    });
  }

  // 수익률 계산
  const totalProfitRate = totalInvestment > 0
    ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100).toFixed(2)
    : 0;

  // 종목 정렬 (수익률 높은 순)
  stocks.sort((a, b) => parseFloat(b.profitRate) - parseFloat(a.profitRate));

  return {
    total: {
      investment: totalInvestment,
      currentValue: totalCurrentValue,
      profit: totalProfit,
      profitRate: totalProfitRate
    },
    byAccount: byAccount,
    byCategory: byCategory,
    stocks: stocks,
    timestamp: new Date().toLocaleString('ko-KR')
  };
}

/**
 * HTML 대시보드 생성
 */
function createDashboardHTML(stats) {
  const profitColor = stats.total.profit >= 0 ? '#22c55e' : '#ef4444';

  let html = `
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
      color: #1f2937;
      margin-bottom: 8px;
    }

    .header .timestamp {
      color: #6b7280;
      font-size: 14px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .summary-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.12);
    }

    .summary-card .label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .summary-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
    }

    .summary-card .value.profit {
      color: ${profitColor};
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
      color: #1f2937;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .chart-container {
      margin-bottom: 16px;
    }

    .bar-chart-item {
      margin-bottom: 12px;
    }

    .bar-chart-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .bar-chart-label .name {
      font-weight: 600;
      color: #374151;
    }

    .bar-chart-label .value {
      color: #6b7280;
    }

    .bar-chart-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-chart-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .stock-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .stock-table thead {
      background: #f9fafb;
    }

    .stock-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }

    .stock-table td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
    }

    .stock-table tbody tr:hover {
      background: #f9fafb;
    }

    .positive {
      color: #22c55e;
      font-weight: 600;
    }

    .negative {
      color: #ef4444;
      font-weight: 600;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #e0e7ff;
      color: #4f46e5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 투자 포트폴리오 대시보드</h1>
      <div class="timestamp">마지막 업데이트: ${stats.timestamp}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">총 투자금</div>
        <div class="value">${formatNumber(stats.total.investment)}원</div>
      </div>
      <div class="summary-card">
        <div class="label">현재 평가액</div>
        <div class="value">${formatNumber(stats.total.currentValue)}원</div>
      </div>
      <div class="summary-card">
        <div class="label">총 손익</div>
        <div class="value profit">${formatNumber(stats.total.profit)}원</div>
      </div>
      <div class="summary-card">
        <div class="label">수익률</div>
        <div class="value profit">${stats.total.profitRate}%</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📈 계좌별 현황</div>
      <div class="chart-container">
        ${generateBarChart(stats.byAccount, stats.total.currentValue)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🏷️ 자산별 현황</div>
      <div class="chart-container">
        ${generateBarChart(stats.byCategory, stats.total.currentValue)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🎯 TOP 종목 (수익률 순)</div>
      <table class="stock-table">
        <thead>
          <tr>
            <th>종목명</th>
            <th>구분</th>
            <th>보유수량</th>
            <th>평균단가</th>
            <th>현재가</th>
            <th>평가손익</th>
            <th>수익률</th>
          </tr>
        </thead>
        <tbody>
          ${generateStockRows(stats.stocks.slice(0, 10))}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('ko-KR');
}

function generateBarChart(data, total) {
  let html = '';
  const entries = Object.entries(data);

  // 금액 순 정렬
  entries.sort((a, b) => b[1].currentValue - a[1].currentValue);

  for (const [name, stats] of entries) {
    const percentage = (stats.currentValue / total * 100).toFixed(1);
    const profitRate = ((stats.currentValue - stats.investment) / stats.investment * 100).toFixed(2);

    html += `
      <div class="bar-chart-item">
        <div class="bar-chart-label">
          <span class="name">${name}</span>
          <span class="value">${formatNumber(stats.currentValue)}원 (${percentage}%) | 수익률: ${profitRate}%</span>
        </div>
        <div class="bar-chart-bar">
          <div class="bar-chart-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }

  return html || '<p style="color: #6b7280;">데이터가 없습니다.</p>';
}

function generateStockRows(stocks) {
  let html = '';

  for (const stock of stocks) {
    const profitClass = stock.profit >= 0 ? 'positive' : 'negative';
    const profitSign = stock.profit >= 0 ? '+' : '';

    html += `
      <tr>
        <td><strong>${stock.name}</strong><br><small style="color: #6b7280;">${stock.code}</small></td>
        <td><span class="badge">${stock.category}</span></td>
        <td>${formatNumber(stock.quantity)}</td>
        <td>${formatNumber(stock.avgPrice)}원</td>
        <td>${formatNumber(stock.currentPrice)}원</td>
        <td class="${profitClass}">${profitSign}${formatNumber(stock.profit)}원</td>
        <td class="${profitClass}">${profitSign}${stock.profitRate}%</td>
      </tr>
    `;
  }

  return html || '<tr><td colspan="7" style="text-align: center; color: #6b7280;">데이터가 없습니다.</td></tr>';
}
