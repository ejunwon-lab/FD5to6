function onOpen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName(DB.SHEET);
  if (dash) ss.setActiveSheet(dash);
}
