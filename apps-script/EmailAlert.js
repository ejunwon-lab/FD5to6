/**
 * EmailAlert.gs
 * 이메일 알림 기능
 *
 * 기능:
 * - 목표 수익률 도달 시 이메일 발송
 * - 일일 포트폴리오 리포트
 * - 급격한 변동 알림
 */

/**
 * 알림 설정 (사용자 맞춤 설정)
 */
const ALERT_CONFIG = {
  // 이메일 주소 (현재 사용자 이메일 자동 사용)
  EMAIL: Session.getActiveUser().getEmail(),

  // 목표 수익률 (%) - 이 수익률 도달 시 알림
  TARGET_PROFIT_RATE: 10,

  // 손실 경고 수익률 (%)
  WARNING_LOSS_RATE: -5,

  // 일일 리포트 발송 여부
  DAILY_REPORT_ENABLED: false,

  // 개별 종목 알림 임계값 (%)
  STOCK_ALERT_THRESHOLD: 5
};

/**
 * 목표 수익률 도달 확인 및 알림
 * 트리거로 매일 또는 매시간 실행 가능
 */
function checkProfitTargetAlert() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const stats = collectPortfolioStats(ss);

  // 목표 수익률 도달 확인
  if (stats.totalProfitRate >= ALERT_CONFIG.TARGET_PROFIT_RATE) {
    sendProfitTargetEmail(stats);
  }

  // 손실 경고
  if (stats.totalProfitRate <= ALERT_CONFIG.WARNING_LOSS_RATE) {
    sendLossWarningEmail(stats);
  }

  // 개별 종목 급등/급락 확인
  checkIndividualStockAlerts(stats.stocks);
}

/**
 * 포트폴리오 통계 수집
 */
function collectPortfolioStats(ss) {
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

    totalInvestment += investment;
    totalCurrentValue += currentValue;

    stocks.push({
      code: code,
      name: name,
      investment: investment,
      currentValue: currentValue,
      profit: profit,
      profitRate: profitRate
    });
  }

  const totalProfitRate = totalInvestment > 0
    ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100)
    : 0;

  return {
    totalInvestment: totalInvestment,
    totalCurrentValue: totalCurrentValue,
    totalProfit: totalCurrentValue - totalInvestment,
    totalProfitRate: totalProfitRate,
    stocks: stocks
  };
}

/**
 * 목표 수익률 도달 알림 이메일
 */
function sendProfitTargetEmail(stats) {
  const subject = `🎉 축하합니다! 목표 수익률 ${ALERT_CONFIG.TARGET_PROFIT_RATE}% 달성!`;

  const body = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
    <h1 style="color: #22c55e;">🎉 목표 수익률 달성!</h1>
    <p>설정하신 목표 수익률 <strong>${ALERT_CONFIG.TARGET_PROFIT_RATE}%</strong>를 달성하셨습니다!</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #1f2937; margin-top: 0;">📊 현재 포트폴리오 현황</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>총 투자금</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stats.totalInvestment)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>현재 평가액</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stats.totalCurrentValue)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>총 손익</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #22c55e; font-weight: bold;">+${formatNumber(stats.totalProfit)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>수익률</strong></td>
          <td style="padding: 8px; text-align: right; color: #22c55e; font-weight: bold; font-size: 18px;">+${stats.totalProfitRate.toFixed(2)}%</td>
        </tr>
      </table>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      이 이메일은 자동으로 발송되었습니다.<br>
      시간: ${new Date().toLocaleString('ko-KR')}
    </p>
  </div>
</body>
</html>
  `;

  MailApp.sendEmail({
    to: ALERT_CONFIG.EMAIL,
    subject: subject,
    htmlBody: body
  });

  Logger.log(`목표 수익률 도달 알림 전송: ${stats.totalProfitRate.toFixed(2)}%`);
}

/**
 * 손실 경고 이메일
 */
function sendLossWarningEmail(stats) {
  const subject = `⚠️ 손실 경고: 포트폴리오 수익률 ${stats.totalProfitRate.toFixed(2)}%`;

  const body = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #fef2f2; border-radius: 8px;">
    <h1 style="color: #ef4444;">⚠️ 손실 경고</h1>
    <p>포트폴리오 수익률이 <strong>${ALERT_CONFIG.WARNING_LOSS_RATE}%</strong> 이하로 떨어졌습니다.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #1f2937; margin-top: 0;">📊 현재 포트폴리오 현황</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>총 투자금</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stats.totalInvestment)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>현재 평가액</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stats.totalCurrentValue)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>총 손익</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444; font-weight: bold;">${formatNumber(stats.totalProfit)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>수익률</strong></td>
          <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold; font-size: 18px;">${stats.totalProfitRate.toFixed(2)}%</td>
        </tr>
      </table>
    </div>

    <p style="color: #991b1b; font-weight: bold;">
      포트폴리오를 재검토하시기 바랍니다.
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      시간: ${new Date().toLocaleString('ko-KR')}
    </p>
  </div>
</body>
</html>
  `;

  MailApp.sendEmail({
    to: ALERT_CONFIG.EMAIL,
    subject: subject,
    htmlBody: body
  });

  Logger.log(`손실 경고 알림 전송: ${stats.totalProfitRate.toFixed(2)}%`);
}

/**
 * 개별 종목 급등/급락 확인
 */
function checkIndividualStockAlerts(stocks) {
  for (const stock of stocks) {
    const absRate = Math.abs(stock.profitRate);

    if (absRate >= ALERT_CONFIG.STOCK_ALERT_THRESHOLD) {
      sendStockAlertEmail(stock);
    }
  }
}

/**
 * 개별 종목 알림 이메일
 */
function sendStockAlertEmail(stock) {
  const isProfit = stock.profitRate >= 0;
  const emoji = isProfit ? '📈' : '📉';
  const color = isProfit ? '#22c55e' : '#ef4444';

  const subject = `${emoji} ${stock.name} ${isProfit ? '급등' : '급락'} 알림 (${stock.profitRate > 0 ? '+' : ''}${stock.profitRate.toFixed(2)}%)`;

  const body = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
    <h1 style="color: ${color};">${emoji} ${stock.name} ${isProfit ? '급등' : '급락'}</h1>
    <p><strong>${stock.name} (${stock.code})</strong> 종목이 ${ALERT_CONFIG.STOCK_ALERT_THRESHOLD}% 이상 변동했습니다.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>투자금</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stock.investment)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>평가금액</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatNumber(stock.currentValue)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>평가손익</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${color}; font-weight: bold;">${stock.profit > 0 ? '+' : ''}${formatNumber(stock.profit)}원</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>수익률</strong></td>
          <td style="padding: 8px; text-align: right; color: ${color}; font-weight: bold; font-size: 18px;">${stock.profitRate > 0 ? '+' : ''}${stock.profitRate.toFixed(2)}%</td>
        </tr>
      </table>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      시간: ${new Date().toLocaleString('ko-KR')}
    </p>
  </div>
</body>
</html>
  `;

  MailApp.sendEmail({
    to: ALERT_CONFIG.EMAIL,
    subject: subject,
    htmlBody: body
  });

  Logger.log(`개별 종목 알림 전송: ${stock.name} (${stock.profitRate.toFixed(2)}%)`);
}

/**
 * 일일 포트폴리오 리포트 전송
 * 매일 오전 8시에 트리거 설정 권장
 */
function sendDailyReport() {
  if (!ALERT_CONFIG.DAILY_REPORT_ENABLED) {
    Logger.log('일일 리포트가 비활성화되어 있습니다.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const stats = collectPortfolioStats(ss);

  // TOP 3 수익 종목
  const topStocks = stats.stocks.sort((a, b) => b.profitRate - a.profitRate).slice(0, 3);

  // TOP 3 손실 종목
  const worstStocks = stats.stocks.sort((a, b) => a.profitRate - b.profitRate).slice(0, 3);

  const subject = `📊 일일 투자 리포트 - ${new Date().toLocaleDateString('ko-KR')}`;

  const body = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
    <h1 style="color: #1f2937;">📊 일일 투자 리포트</h1>
    <p>${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #1f2937; margin-top: 0;">전체 현황</h2>
      <div style="font-size: 32px; font-weight: bold; color: ${stats.totalProfit >= 0 ? '#22c55e' : '#ef4444'}; text-align: center; margin: 20px 0;">
        ${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfitRate.toFixed(2)}%
      </div>
      <div style="text-align: center; color: #6b7280;">
        ${stats.totalProfit >= 0 ? '+' : ''}${formatNumber(stats.totalProfit)}원
      </div>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #22c55e; margin-top: 0;">📈 TOP 3 수익 종목</h3>
      ${topStocks.map(s => `
        <div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <strong>${s.name}</strong>
          <span style="float: right; color: #22c55e; font-weight: bold;">+${s.profitRate.toFixed(2)}%</span>
        </div>
      `).join('')}
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #ef4444; margin-top: 0;">📉 TOP 3 손실 종목</h3>
      ${worstStocks.map(s => `
        <div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <strong>${s.name}</strong>
          <span style="float: right; color: #ef4444; font-weight: bold;">${s.profitRate.toFixed(2)}%</span>
        </div>
      `).join('')}
    </div>

    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      매일 오전 8시에 자동으로 발송됩니다.
    </p>
  </div>
</body>
</html>
  `;

  MailApp.sendEmail({
    to: ALERT_CONFIG.EMAIL,
    subject: subject,
    htmlBody: body
  });

  Logger.log('일일 리포트 전송 완료');
}

/**
 * 알림 트리거 설정
 * 이 함수를 한 번 실행하면 자동으로 트리거가 설정됩니다
 */
function setupAlertTriggers() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkProfitTargetAlert' ||
        trigger.getHandlerFunction() === 'sendDailyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 목표 수익률 확인 (매시간)
  ScriptApp.newTrigger('checkProfitTargetAlert')
    .timeBased()
    .everyHours(1)
    .create();

  // 일일 리포트 (매일 오전 8시)
  if (ALERT_CONFIG.DAILY_REPORT_ENABLED) {
    ScriptApp.newTrigger('sendDailyReport')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .create();
  }

  SpreadsheetApp.getUi().alert(
    '✅ 알림 설정 완료',
    '이메일 알림이 설정되었습니다.\n\n' +
    '- 목표 수익률 확인: 매시간\n' +
    '- 일일 리포트: 매일 오전 8시\n\n' +
    '수신 이메일: ' + ALERT_CONFIG.EMAIL,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 모든 이메일 알림 트리거 삭제
 */
function disableAlertTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;

  triggers.forEach(trigger => {
    const handler = trigger.getHandlerFunction();
    if (handler === 'checkProfitTargetAlert' || handler === 'sendDailyReport') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  });

  SpreadsheetApp.getUi().alert(
    '🔕 알림 해제 완료',
    '모든 이메일 알림 트리거가 삭제되었습니다.\n더 이상 자동 알림이 발송되지 않습니다.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function formatNumber(num) {
  return Math.round(num).toLocaleString('ko-KR');
}
