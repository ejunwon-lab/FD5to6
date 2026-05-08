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

function _jsonOut(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)
}
