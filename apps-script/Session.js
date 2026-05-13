/**
 * Session.gs
 * 웹앱 doPost 진입점 + 앱 키 인증
 *
 * 설정: GAS Script Properties에 APP_KEY 값 저장 필요
 *   PropertiesService.getScriptProperties().setProperty('APP_KEY', '...')
 *
 * 배포: 웹앱으로 배포 (Execute as: Me, Who has access: Anyone)
 */

function doGet(e) {
  try {
    const action = e.parameter.action
    const key    = e.parameter.key

    const expectedKey = PropertiesService.getScriptProperties().getProperty('APP_KEY')
    if (!expectedKey || key !== expectedKey) {
      return _jsonOut({ error: 'UNAUTHORIZED' })
    }

    switch (action) {
      case 'ping':             return _jsonOut({ ok: true })
      case 'getPortfolio':     return _jsonOut(mobileGetPortfolio())
      case 'triggerUpdate':    return _jsonOut(mobileTriggerUpdate())
      case 'updateFull':       return _jsonOut(mobileUpdateHoldingsFull())
      case 'updateFast':       return _jsonOut(mobileUpdateHoldingsFast())
      case 'updateAll':        return _jsonOut(mobileUpdateAll())
      case 'getIndicators':    return _jsonOut(mobileGetReferenceIndicators())
      case 'getProfitHistory': return _jsonOut(mobileGetProfitHistory())
      case 'getNewFxRate':     return _jsonOut(_getNewSystemFxRate())
      case 'kakaoLookup':      return _jsonOut(kakaoLookupByName(e.parameter.name || '', e.parameter.code || ''))
      case 'kakaoSnapshot':    return _jsonOut(kakaoSnapshot())
      default:                 return _jsonOut({ error: 'UNKNOWN_ACTION' })
    }
  } catch (err) {
    return _jsonOut({ error: err.message })
  }
}

/**
 * APP_KEY 초기 설정 — GAS 에디터에서 1회만 직접 실행
 * 실행 전 아래 key 값을 원하는 비밀 코드로 변경할 것
 */
function setupAppKey() {
  const key = 'Dhsmfehrhrh1!'
  PropertiesService.getScriptProperties().setProperty('APP_KEY', key)
  Logger.log('APP_KEY 설정 완료: ' + key)
}

function doPost(e) {
  try {
    const action = (e.parameter && e.parameter.action) || ''
    const key    = (e.parameter && e.parameter.key)    || ''

    const expectedKey = PropertiesService.getScriptProperties().getProperty('APP_KEY')
    if (!expectedKey || key !== expectedKey) {
      return _jsonOut({ error: 'UNAUTHORIZED' })
    }

    let body = {}
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents) } catch (_) { body = {} }
    }

    switch (action) {
      case 'kakaoFill': return _jsonOut(kakaoFillForms(body))
      default:          return _jsonOut({ error: 'UNKNOWN_ACTION' })
    }
  } catch (err) {
    return _jsonOut({ error: err.message })
  }
}

function _jsonOut(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)
}

/**
 * 신시스템 *설정* 시트의 환율(USD/GBP) 조회.
 * NEW_SS_ID 가 Script Properties 에 등록되어 있어야 함.
 */
function _getNewSystemFxRate() {
  try {
    const newSsId = PropertiesService.getScriptProperties().getProperty('NEW_SS_ID')
    if (!newSsId) return { error: 'NEW_SS_ID not set' }
    const newSs = SpreadsheetApp.openById(newSsId)
    const sheet = newSs.getSheetByName('*설정*')
    if (!sheet) return { error: '*설정* sheet not found in new system' }
    return {
      usd: Number(sheet.getRange(2, 2).getValue()) || null,
      gbp: Number(sheet.getRange(3, 2).getValue()) || null,
    }
  } catch (e) {
    return { error: String(e) }
  }
}
