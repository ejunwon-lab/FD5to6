/**
 * Holidays.js — 한국 증시 휴장일 단일 소스 (신시스템 v2)
 *
 *  *휴장일* 시트가 휴장일의 유일한 소스.
 *  syncHolidays() 가 구글 '대한민국 공휴일' 캘린더 + KRX 고정휴장(5/1·12/31)을
 *  시트에 기록하고, _isKoreanHoliday() 가 그 시트를 읽는다.
 *  시트가 없거나 비어 있으면 _HOLIDAY_FALLBACK 으로 대체 (동기화 전 안전망).
 */

// *휴장일* 시트 동기화 전까지만 쓰는 최후 fallback (2025~2026)
const _HOLIDAY_FALLBACK = [
  '2025-01-01',
  '2025-01-28', '2025-01-29', '2025-01-30',
  '2025-03-01', '2025-05-01', '2025-05-05', '2025-06-06',
  '2025-08-15',
  '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-09',
  '2025-12-25',
  '2026-01-01',
  '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-03-02',
  '2026-05-01', '2026-05-05', '2026-05-25',
  '2026-06-06', '2026-07-17', '2026-08-15',
  '2026-10-03', '2026-10-09',
  '2026-12-25', '2026-12-31',
];

var _HOLIDAY_SET = null;  // 실행 내 캐시 (실행당 1회만 시트 읽음)

// *휴장일* 시트(없으면 fallback)에서 휴장일 Set 반환
function _getHolidaySet() {
  if (_HOLIDAY_SET) return _HOLIDAY_SET;
  const set = new Set();
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NS.HOLIDAYS);
    if (sh && sh.getLastRow() >= 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
        const raw = r[0];
        const d = raw instanceof Date
          ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
          : String(raw).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
      });
    }
  } catch (e) {
    Logger.log('_getHolidaySet 오류: ' + e);
  }
  if (set.size === 0) _HOLIDAY_FALLBACK.forEach(d => set.add(d));
  _HOLIDAY_SET = set;
  return set;
}

// 휴일 판정 — 시스템 전체(_isTradingDateStr·_mIsTradingDay·_trIsKoreanHoliday)가 이걸 씀
function _isKoreanHoliday(date) {
  const dateStr = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd');
  return _getHolidaySet().has(dateStr);
}

// *휴장일* 시트 생성 (헤더만)
function _setupHolidaysSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NS.HOLIDAYS);
  if (sh) return sh;
  sh = ss.insertSheet(NS.HOLIDAYS);
  sh.getRange(1, 1, 1, 3).setValues([['날짜', '내용', '출처']])
    .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 100);
  sh.setFrozenRows(1);
  return sh;
}

/**
 * 구글 '대한민국 공휴일' 캘린더 → *휴장일* 시트 동기화 (올해 + 내년).
 * - 음력 휴일·대체공휴일은 구글이 계산해 줌 → 수동 입력 불필요
 * - KRX 전용 휴장(근로자의날 5/1·연말휴장 12/31)은 코드가 자동 추가
 * - 출처='수동' 행은 보존 (임시공휴일 등 수기 추가분)
 * - 메뉴 🗓️ 휴장일 동기화 / 매년 12월 자동 트리거가 호출
 */
function syncHolidays() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = _setupHolidaysSheet(ss);

  // 기존 '수동' 행 보존
  const manual = [];
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
      if (String(r[2] || '').indexOf('수동') === 0) {
        const d = r[0] instanceof Date
          ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
          : String(r[0]).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) manual.push([d, String(r[1] || ''), '수동']);
      }
    });
  }

  // 구글 공휴일 캘린더 (음력·대체공휴일 포함)
  const cal = CalendarApp.getCalendarById('ko.south_korea#holiday@group.v.calendar.google.com');
  if (!cal) {
    ss.toast('공휴일 캘린더 접근 실패 — 캘린더 권한 승인 필요', '❌', 6);
    Logger.log('syncHolidays: 캘린더 접근 실패');
    return;
  }
  const thisYear = new Date().getFullYear();
  const events = cal.getEvents(new Date(thisYear, 0, 1), new Date(thisYear + 2, 0, 1));
  // 채택 기준: 구글 캘린더의 공식 분류(DESCRIPTION '공휴일'/'기념일') — 1차 권위.
  // 이름 화이트리스트는 desc가 빈 경우의 폴백만 (손질 목록 낡음 사고 2회: 스승의날 5/17·제헌절 7/17,
  // + 잠복: 지방선거일 6/3은 화이트리스트 미매칭이었음. ics 실측·설계: docs/plans/2026-07-20-휴장일-권위소스.md)
  const HOLIDAY_NAMES = [
    '신정', '새해', '설날', '삼일절', '3·1', '어린이날', '부처', '석가탄',
    '현충일', '제헌절', '광복절', '추석', '개천절', '한글날', '성탄', '기독탄신', '크리스마스',
    '대체공휴일', '임시공휴일', '근로자', '선거',
  ];
  const map = {};
  let nAdopt = 0, nSkip = 0, nFallback = 0;
  events.forEach(ev => {
    const title = String(ev.getTitle() || '');
    const desc = String(ev.getDescription() || '');
    if (desc) {
      if (desc.indexOf('공휴일') !== 0) { nSkip++; return; }  // '기념일' 등 비공휴일 분류 제외
      nAdopt++;
    } else {
      // desc 없음(API 변동 대비) → 기존 화이트리스트 폴백 — 최악의 경우가 현행 동작
      if (!HOLIDAY_NAMES.some(n => title.indexOf(n) !== -1)) { nSkip++; return; }
      nFallback++;
    }
    const dt = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    const ds = Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd');
    map[ds] = title;
  });
  Logger.log('syncHolidays 분류: 공휴일채택 ' + nAdopt + ' / 제외 ' + nSkip + ' / 폴백채택 ' + nFallback);

  // KRX 전용 고정 휴장일 (공휴일 캘린더에 없을 수 있음)
  for (let y = thisYear; y <= thisYear + 1; y++) {
    if (!map[y + '-05-01']) map[y + '-05-01'] = '근로자의 날';
    if (!map[y + '-12-31']) map[y + '-12-31'] = '연말 휴장';
    // 제헌절 — 2026년 공휴일 재지정(첫 적용 2026-07-17). 캘린더 수록 여부와 무관하게 보장
    if (y >= 2026 && !map[y + '-07-17']) map[y + '-07-17'] = '제헌절';
  }

  // 자동 + 수동 병합 (같은 날짜는 수동 우선)
  const manualSet = {};
  manual.forEach(m => manualSet[m[0]] = true);
  const rows = [];
  Object.keys(map).forEach(d => {
    if (!manualSet[d]) rows.push([d, map[d], '캘린더']);
  });
  manual.forEach(m => rows.push(m));
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  // 시트 갱신
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  }
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  _HOLIDAY_SET = null;  // 캐시 무효화

  _ensureHolidayTrigger();
  ss.toast(rows.length + '개 동기화 (공휴일분류 ' + nAdopt + '·제외 ' + nSkip + '·폴백 ' + nFallback + ')', '🗓️', 5);
  Logger.log('syncHolidays 완료: ' + rows.length + '건');
}

// 매월 25일 자동 동기화 트리거
function _ensureHolidayTrigger() {
  const exists = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'scheduledHolidaySync');
  if (!exists) {
    ScriptApp.newTrigger('scheduledHolidaySync')
      .timeBased().onMonthDay(25).atHour(4).create();
    Logger.log('휴장일 트리거 등록: 매월 25일');
  }
}

// 매월 실행 (구 12월 게이트 제거, 2026-07-20) — 연중 임시공휴일 신설·재지정을 ≤1개월 지연으로
// 자동 수용 (제헌절 7/17 사고 재발 방지). 멱등(수동 행 보존 + 전체 재작성)이라 반복 무해.
function scheduledHolidaySync() {
  syncHolidays();
}
