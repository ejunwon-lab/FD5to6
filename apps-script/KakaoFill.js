/**
 * KakaoFill.js — 카톡 매수/매도 알림 → 신시스템 *거래_입력폼* 자동 채움
 *
 * 동작 흐름:
 *   1) Claude 가 카톡 텍스트 파싱 → 정형 payload 생성
 *   2) Web App `doGet?action=kakaoLookup` 으로 종목/분류/계좌 후보 조회
 *   3) `doPost?action=kakaoFill` 또는 doGet (URL 짧으면) 호출
 *   4) 본 함수가 신시스템 *거래_입력폼* B3~B14 셀에 setValue (체크박스 false 유지)
 *   5) 사용자가 시트 체크박스 토글 → addTransactionFromForm 자동 실행
 *
 * 사전 설정 (Script Properties):
 *   NEW_SS_ID = 신시스템 스프레드시트 ID  (이미 등록됨)
 */

const KF = {
  PROP_NEW_SS_ID: 'NEW_SS_ID',

  // 신시스템 '*거래_입력폼*' 셀 (NewSystem.js NS.FR 와 동일)
  NEW_FORM_SHEET: '*거래_입력폼*',
  NEW_FORM_COL: 2,
  NEW_FR: { DATE:3, TYPE:4, CODE:5, NAME:6, CAT:7, BROKER:8, ACCT:9, QTY:10, PRICE:11, AMT:12, FEE:13, MEMO:14, SUBMIT:16 },

  NEW_LEDGER_SHEET: '*거래_원장*',
};

// ───────────────────────────────────────────────────
//  공개: 입력폼 채우기
// ───────────────────────────────────────────────────

/**
 * payload:
 *   {
 *     broker:      '미래에셋투자증권' | '삼성증권',
 *     txType:      '매수' | '매도',
 *     code:        '487240',
 *     name:        'KODEX AI전력핵심설비',
 *     category:    '국내주식' | '국내ETF' | '해외주식' | '해외ETF' | '펀드' | '예금' | '보험' | '기타',
 *     accountType: '종합' | 'ISA' | '종합_랩' | '퇴직연금_개인IRP' | '퇴직연금_개인형IRP(범용)',
 *     qty:         100,
 *     price:       60300,
 *     fee:         0,
 *     date:        'YYYY-MM-DD',
 *     memo:        '카톡 자동입력'
 *   }
 */
function kakaoFillForms(payload) {
  const result = { ok: true, newFilled: false, warnings: [] };

  // 필수 검증
  ['broker', 'txType', 'name', 'qty', 'price'].forEach(k => {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
      result.warnings.push(`필수 누락: ${k}`);
    }
  });
  if (payload.txType && payload.txType !== '매수' && payload.txType !== '매도') {
    result.warnings.push(`txType 값 이상: ${payload.txType}`);
  }

  const dateStr = payload.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

  try {
    const newSsId = PropertiesService.getScriptProperties().getProperty(KF.PROP_NEW_SS_ID);
    if (!newSsId) {
      result.ok = false;
      result.warnings.push(`Script Properties 에 ${KF.PROP_NEW_SS_ID} 미설정.`);
      return result;
    }
    const newSs    = SpreadsheetApp.openById(newSsId);
    const newSheet = newSs.getSheetByName(KF.NEW_FORM_SHEET);
    if (!newSheet) {
      result.ok = false;
      result.warnings.push(`신시스템 "${KF.NEW_FORM_SHEET}" 시트를 찾을 수 없음.`);
      return result;
    }

    const C  = KF.NEW_FORM_COL;
    const FR = KF.NEW_FR;

    // 체크박스 false 강제 (사용자가 OFF→ON 토글로 onEdit 발동시키도록)
    newSheet.getRange(FR.SUBMIT, C).setValue(false);

    newSheet.getRange(FR.DATE,   C).setValue(dateStr);
    newSheet.getRange(FR.DATE,   C).setNumberFormat('yyyy-MM-dd');
    newSheet.getRange(FR.TYPE,   C).setValue(payload.txType);
    newSheet.getRange(FR.CODE,   C).setValue(payload.code || '');
    newSheet.getRange(FR.NAME,   C).setValue(payload.name);
    newSheet.getRange(FR.CAT,    C).setValue(payload.category || '');
    newSheet.getRange(FR.BROKER, C).setValue(payload.broker);
    newSheet.getRange(FR.ACCT,   C).setValue(payload.accountType || '');
    newSheet.getRange(FR.QTY,    C).setValue(payload.qty);
    newSheet.getRange(FR.PRICE,  C).setValue(payload.price);
    // AMT 는 수식이라 안 건드림 — qty*price 자동
    newSheet.getRange(FR.FEE,    C).setValue(payload.fee || 0);
    newSheet.getRange(FR.MEMO,   C).setValue(payload.memo || '카톡 자동입력');

    result.newFilled = true;
  } catch (err) {
    result.ok = false;
    result.warnings.push('신시스템 채우기 실패: ' + err.message);
  }

  return result;
}

// ───────────────────────────────────────────────────
//  공개: 종목명/코드 조회 — 분류·계좌 추론용
// ───────────────────────────────────────────────────

/**
 * 입력: name (필수), code (선택)
 * 반환:
 *   {
 *     foundIn:   'new' | 'none',
 *     code:      매칭된 종목코드,
 *     category:  분류,
 *     positions: [{ broker, accountType, qty }]
 *   }
 */
function kakaoLookupByName(name, code) {
  const ret = { foundIn: 'none', code: code || '', category: '', positions: [] };
  if (!name && !code) return ret;

  const nameNorm = String(name || '').trim();
  const codeNorm = _kfNormCode(code);

  try {
    const newSsId = PropertiesService.getScriptProperties().getProperty(KF.PROP_NEW_SS_ID);
    if (!newSsId) return ret;
    const newSs  = SpreadsheetApp.openById(newSsId);
    const ledger = newSs.getSheetByName(KF.NEW_LEDGER_SHEET);
    if (!ledger || ledger.getLastRow() < 2) return ret;

    const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 12).getValues();
    // posMap: broker||acct → { qty, ... }
    const posMap = {};
    for (const r of rows) {
      const [date, type, c, n, cat, broker, acct, qty] = r;
      const rCode = _kfNormCode(c);
      const rName = String(n || '').trim();
      if (codeNorm && rCode !== codeNorm) continue;
      if (!codeNorm && rName !== nameNorm) continue;

      // 분류·코드 보강
      if (!ret.category) ret.category = String(cat || '');
      if (!ret.code)     ret.code     = String(c   || '');
      ret.foundIn = 'new';

      const key = `${broker}||${acct}`;
      if (!posMap[key]) posMap[key] = { broker: String(broker), accountType: String(acct), qty: 0 };
      if (type === '매수') posMap[key].qty += Number(qty) || 0;
      else if (type === '매도') posMap[key].qty -= Number(qty) || 0;
    }
    Object.values(posMap).forEach(p => {
      if (p.qty > 0.0001) ret.positions.push(p);
    });
  } catch (_) {}

  return ret;
}

// ───────────────────────────────────────────────────
//  공개: 활성 계좌·종목 스냅샷
// ───────────────────────────────────────────────────

function kakaoSnapshot() {
  const ret = { brokers: [], positions: 0 };
  try {
    const newSsId = PropertiesService.getScriptProperties().getProperty(KF.PROP_NEW_SS_ID);
    if (!newSsId) return ret;
    const newSs  = SpreadsheetApp.openById(newSsId);
    const posSht = newSs.getSheetByName('*보유현황*');
    if (!posSht || posSht.getLastRow() < 2) return ret;
    const rows = posSht.getRange(2, 1, posSht.getLastRow() - 1, 7).getValues()
      .filter(r => r[0] && String(r[0]) !== '합계' && Number(r[6]) > 0);
    ret.positions = rows.length;
    const set = new Set();
    rows.forEach(r => set.add(`${r[3]}/${r[4]}`));
    ret.brokers = [...set].sort();
  } catch (_) {}
  return ret;
}

// ───────────────────────────────────────────────────
//  헬퍼
// ───────────────────────────────────────────────────

function _kfNormCode(c) {
  const s = String(c || '').trim().toUpperCase();
  if (!s) return '';
  // 앞 'A' 접두 제거 (미래에셋 카톡 표기 A487240 → 487240)
  const stripped = s.replace(/^A(?=\d)/, '');
  // 순수 숫자만 → 앞 0 제거
  return /^\d+$/.test(stripped) ? String(parseInt(stripped, 10)) : stripped;
}
