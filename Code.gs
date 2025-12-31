/**
 * ระบบจัดการจองโต๊ะ บ้านไร่ริมเขื่อน - REAL-TIME & UX EDITION
 */

const SPREADSHEET_ID = "1sCEITK6m2tivkQt6wgPXSMnr5aEMRJQ8i6APP98pu60";
const SHEET_NAME = "Bookings";
const TIMEZONE = "Asia/Bangkok";
const DATE_FORMAT = "yyyy-MM-dd";

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('บ้านไร่ริมเขื่อน - ระบบจัดการโต๊ะ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    if (requestData.action === 'save_booking') return createResponse(saveBooking(requestData));
    if (requestData.action === 'update_status') return createResponse(updateTableStatus(requestData.tableNo, requestData.date, requestData.status));
    if (requestData.action === 'get_data') return createResponse(getDataByDate(requestData.date));
  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}

function getDataByDate(dateStr) {
  const sheet = getOrSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const targetDate = Utilities.formatDate(parseThaiDate(dateStr), TIMEZONE, DATE_FORMAT);

  return values.slice(1)
    .filter(row => {
      if (!row[3]) return false;
      const rowDate = Utilities.formatDate(new Date(row[3]), TIMEZONE, DATE_FORMAT);
      return rowDate === targetDate;
    })
    .map(row => {
      let timeVal = row[4];
      if (timeVal instanceof Date) timeVal = Utilities.formatDate(timeVal, TIMEZONE, "HH:mm");
      return {
        name: row[1] || '',
        phone: row[2] || '',
        date: row[3] ? Utilities.formatDate(new Date(row[3]), TIMEZONE, DATE_FORMAT) : '',
        time: timeVal || '', 
        people: row[5] || '',
        table: row[6] || '',
        zone: row[7] || '',
        note: row[8] || '',
        status: row[9] || 'reserved',
        timestamp: row[0]
      };
    })
    .filter(item => item.table);
}

function saveBooking(data) {
  const currentData = getDataByDate(data.date);
  if (currentData.some(b => b.table === data.table && (b.status === 'reserved' || b.status === 'occupied'))) {
    return { success: false, message: "โต๊ะนี้ถูกจองไปแล้ว" };
  }
  
  const sheet = getOrSheet();
  const bookingDate = parseThaiDate(data.date);
  const now = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  
  sheet.appendRow([now, data.name, "'" + data.phone, bookingDate, data.time, data.people, data.table, data.zone, data.note, 'reserved']);
  return { success: true };
}

function updateTableStatus(tableNo, dateStr, newStatus) {
  const sheet = getOrSheet();
  const data = sheet.getDataRange().getValues();
  const targetDate = Utilities.formatDate(parseThaiDate(dateStr), TIMEZONE, DATE_FORMAT);
  
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = Utilities.formatDate(new Date(data[i][3]), TIMEZONE, DATE_FORMAT);
    const rowTable = data[i][6].toString().trim();
    if (rowDate === targetDate && rowTable === tableNo.toString().trim()) {
      if (newStatus === 'available') { sheet.deleteRow(i + 1); } 
      else { sheet.getRange(i + 1, 10).setValue(newStatus); }
      return { success: true };
    }
  }
  return { success: false };
}

function getOrSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Date', 'Time', 'People', 'Table', 'Zone', 'Note', 'Status']);
  }
  return sheet;
}

function parseThaiDate(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({ data: data })).setMimeType(ContentService.MimeType.JSON);
}
