// 연결부 시험 — 원격에 올라가는 전 파일이 한 문맥에서 오류 없이 로드되는지, 30분 트리거가 단계들을 순서대로 부르고 서로 격리하는지.
// 실행: node scripts/gas-tests/test_wiring.js [-v]
const vm = require('vm'), fs = require('fs'), path = require('path');
const { checker } = require('./harness');
const { check, done } = checker();
const GAS = path.join(__dirname, '..', '..', 'apps-script-v2');
const anyObj = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : anyObj, apply: () => anyObj, construct: () => anyObj });
const ctx = vm.createContext({ console, Logger: { log() {} }, SECRET: { KIS_BASE_URL: 'https://kis.example' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, setProperties() {}, deleteProperty() {}, getKeys: () => [] }) },
  SpreadsheetApp: anyObj, ScriptApp: anyObj, UrlFetchApp: anyObj, CalendarApp: anyObj, HtmlService: anyObj, Session: anyObj,
  ContentService: { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => s }) },
  Utilities: { formatDate: () => '0', sleep() {}, computeDigest: () => [1, 2, 3, 4, 5, 6], DigestAlgorithm: {}, Charset: {} },
  LockService: { getScriptLock: () => ({ tryLock: () => false, releaseLock() {} }) } });
const files = fs.readdirSync(GAS).filter(f => f.endsWith('.js')).sort();
let err = null;
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(GAS, f), 'utf8'), ctx, { filename: f }); } catch (e) { err = f + ': ' + e.message; break; } }
check('전 파일(' + files.length + '개) 로드 오류 없음', err, null);
check('진입점이 전역에 있음', ['mcTick', 'cbfTick', 'cbfRun', 'scheduledHourlyUpdate', 'scheduledDailyUpdate', 'doPost'].filter(n => typeof ctx[n] !== 'function'), []);

let calls = [];
ctx.tgChainFallback = () => { calls.push('fb'); return 'ok'; };
ctx.mcTick = () => { calls.push('mc'); return {}; };
ctx.cbfTick = () => { calls.push('cbf'); return 'have'; };
ctx._mIsTradingDay = () => { calls.push('td'); return false; };
ctx.scheduledHourlyUpdate();
check('30분 트리거: 백업 발송 판정 → mcTick → cbfTick → 거래일 판정', calls, ['fb', 'mc', 'cbf', 'td']);
calls = []; ctx.mcTick = () => { calls.push('mc'); throw new Error('x'); }; ctx.cbfTick = () => { calls.push('cbf'); throw new Error('y'); };
let threw = false; try { ctx.scheduledHourlyUpdate(); } catch (e) { threw = true; }
check('두 단계가 예외를 던져도 기존 흐름은 계속', [calls, threw], [['fb', 'mc', 'cbf', 'td'], false]);
calls = []; ctx.tgChainFallback = () => { calls.push('fb'); return 'fallback:sent'; }; ctx.mcTick = () => { calls.push('mc'); }; ctx.cbfTick = () => { calls.push('cbf'); };
ctx.scheduledHourlyUpdate();
check('백업 발송이 나간 틱: 두 단계는 돌고 갱신은 생략', calls, ['fb', 'mc', 'cbf']);
done('연결부 시험');
