// GAS 스텁 하네스 — 가짜 시계·시트·속성·락·UrlFetch 위에서 apps-script-v2 의 실제 코드를 돌린다.
// 사용: const { makeEnv, checker } = require('./harness');  (node 만 있으면 된다. 네트워크·배포 없음)
// 이 폴더는 apps-script-v2 밖이라 push_safe 가 원격에 올리지 않는다. 종목 코드·가격은 전부 가짜다(저장소는 공개).
const vm = require('vm'), fs = require('fs'), path = require('path');
const GAS = path.join(__dirname, '..', '..', 'apps-script-v2');

class FakeSheet {
  constructor(name, rows, book) { this.name = name; this.d = rows.map(r => r.slice()); this.book = book; this.hidden = false; }
  getName() { return this.name; }
  setName(n) { delete this.book.sheets[this.name]; this.name = n; this.book.sheets[n] = this; return this; }
  hideSheet() { this.hidden = true; return this; }
  copyTo() { const c = new FakeSheet(this.name + '의 사본', this.d, this.book); this.book.sheets[c.name] = c; return c; }   // 실제 인자는 스프레드시트 — 같은 문서에 복사
  getLastRow() { return this.d.length; }
  getLastColumn() { return this.d.reduce((m, r) => Math.max(m, r.length), 0); }
  setColumnWidth() {} setFrozenRows() {}
  getRange(r, c, nr, nc) {
    const sh = this; nr = nr || 1; nc = nc || 1;
    const rng = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (sh.d[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? '' : v; })),
      getValue: () => rng.getValues()[0][0],
      setValues: v => { sh.writes = (sh.writes || 0) + 1; v.forEach((row, i) => { while (sh.d.length < r + i) sh.d.push([]); row.forEach((x, j) => { sh.d[r - 1 + i][c - 1 + j] = x; }); }); return rng; },
      setValue: v => rng.setValues([[v]]),
      setFormula: f => rng.setValues([[sh.book.onFormula ? sh.book.onFormula(f) : f]]),
      setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng, setNumberFormat: () => rng, clearContent: () => rng,
    };
    return rng;
  }
}

/**
 * @param {{now: string, sheets: Object<string, Array[]>, files: string[], fetch: function(string, object): {code: number, body: string}}} opts
 *   now = 'YYYY-MM-DDTHH:MM:SS+09:00', sheets = {시트이름: 행 배열}, files = 로드할 GAS 파일, fetch = 주소별 가짜 응답
 */
function makeEnv(opts) {
  const env = { now: opts.now, store: new Map(), logs: [], fetches: [], trading: true, lockBusy: false, holidays: [], book: { sheets: {} } };
  Object.keys(opts.sheets || {}).forEach(n => { env.book.sheets[n] = new FakeSheet(n, opts.sheets[n], env.book); });
  const RealDate = Date;
  class FDate extends RealDate { constructor(...a) { if (a.length === 0) super(env.now); else super(...a); } static now() { return new RealDate(env.now).getTime(); } }
  const p2 = n => ('0' + n).slice(-2);
  const formatDate = (d, tz, f) => {
    const k = new RealDate(d.getTime() + 9 * 3600e3);
    const ymd = k.getUTCFullYear() + '-' + p2(k.getUTCMonth() + 1) + '-' + p2(k.getUTCDate());
    const m = { 'yyyy-MM-dd': ymd, 'yyyyMMdd': ymd.replace(/-/g, ''), 'yyyy-MM-dd HH:mm:ss': ymd + ' ' + p2(k.getUTCHours()) + ':' + p2(k.getUTCMinutes()) + ':' + p2(k.getUTCSeconds()),
      'H': String(k.getUTCHours()), 'm': String(k.getUTCMinutes()), 'HH:mm': p2(k.getUTCHours()) + ':' + p2(k.getUTCMinutes()), 'HHmm': p2(k.getUTCHours()) + p2(k.getUTCMinutes()),
      'u': String(k.getUTCDay() === 0 ? 7 : k.getUTCDay()) };
    if (!(f in m)) throw new Error('formatDate 미지원 형식: ' + f);
    return m[f];
  };
  const respond = req => {
    const url = typeof req === 'string' ? req : req.url; env.fetches.push(url);
    const r = (opts.fetch || (() => ({ code: 404, body: '{}' })))(url, env) || { code: 404, body: '{}' };
    if (r.throw) throw new Error(r.throw);
    return { getResponseCode: () => r.code, getContentText: () => r.body };
  };
  const ss = { getSheetByName: n => env.book.sheets[n] || null, getSheets: () => Object.values(env.book.sheets), toast: () => {} };
  const ctx = vm.createContext({
    console, Date: FDate, unescape, encodeURIComponent,
    Utilities: { formatDate, sleep() {} },
    Logger: { log: m => env.logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => env.store.has(k) ? env.store.get(k) : null, setProperty: (k, v) => { env.store.set(k, String(v)); },
      setProperties: o => Object.keys(o).forEach(k => env.store.set(k, String(o[k]))), deleteProperty: k => env.store.delete(k), getKeys: () => [...env.store.keys()] }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !env.lockBusy, waitLock: () => { if (env.lockBusy) throw new Error('락 대기 시간 초과'); }, releaseLock: () => { env.lockReleases = (env.lockReleases || 0) + 1; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => t, text: t }) },
    UrlFetchApp: { fetchAll: reqs => reqs.map(respond), fetch: (u, o) => respond(Object.assign({ url: u }, o || {})) },
    SECRET: { KIS_BASE_URL: 'https://kis.example' },
    KIS_API: { getAccessToken: () => { if (env.tokenThrow) throw new Error('토큰 발급 실패'); return 'T'; } },
  });
  (opts.files || []).forEach(f => vm.runInContext(fs.readFileSync(path.join(GAS, f), 'utf8'), ctx, { filename: f }));
  // 다른 파일에 정의된 것 중 시험에 필요한 최소 스텁
  const weekday = s => { const wd = new RealDate(s + 'T12:00:00+09:00').getUTCDay(); return wd !== 0 && wd !== 6; };
  ctx._isTradingDateStr = s => weekday(s) && env.holidays.indexOf(s) < 0;
  ctx._mIsTradingDay = () => env.trading && ctx._isTradingDateStr(formatDate(new FDate(), '', 'yyyy-MM-dd'));
  ctx._kisKeys = () => ({ key: 'K', secret: 'S' });
  env.ctx = ctx;
  env.run = code => vm.runInContext(code, ctx);
  env.sheet = n => env.book.sheets[n];
  env.prop = k => { const v = env.store.get(k); try { return JSON.parse(v); } catch (e) { return v; } };
  return env;
}

function checker() {
  let total = 0, fail = 0;
  return {
    check(name, got, want) {
      total++;
      const ok = JSON.stringify(got) === JSON.stringify(want);
      if (!ok) { fail++; console.log('  ✗✗  ' + name + ' → ' + JSON.stringify(got) + '  (기대 ' + JSON.stringify(want) + ')'); }
      else if (process.argv.includes('-v')) console.log('  ok  ' + name);
    },
    done(label) { console.log(fail ? `${label}: ${total}개 중 실패 ${fail}개` : `${label}: ${total}개 전부 통과`); process.exit(fail ? 1 : 0); },
  };
}

module.exports = { makeEnv, checker, FakeSheet };
