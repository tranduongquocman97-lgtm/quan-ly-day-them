// ============================================================================
// HỆ THỐNG BACKEND GOOGLE APPS SCRIPT - M_SIGMATEACHER & M_SIGMATH
// Đã đồng bộ 11 cột Students, 8 cột WeeklyOverrides, LockService chống xung đột
// ============================================================================

const SHEET_SCHEMAS = {
  Classes: ['id', 'name', 'fee', 'schedulesJson'],
  Students: ['id', 'classId', 'code', 'name', 'phone', 'joinDate', 'customFee', 'username', 'password', 'mustChangePassword', 'transferInfoJson'],
  Attendance: ['studentId', 'classId', 'date', 'status', 'note'],
  Payments: ['id', 'studentId', 'classId', 'cycleIndex', 'amount', 'status', 'method', 'note', 'date'],
  Documents: ['id', 'classId', 'name', 'category', 'url'],
  Exams: ['id', 'title', 'classId', 'duration', 'solutionUrl', 'questionsJson', 'matrixJson', 'status'],
  ExamResults: ['id', 'examId', 'studentId', 'score', 'detailsJson', 'tabSwitchCount', 'submittedAt'],
  WeeklyOverrides: ['id', 'classId', 'date', 'type', 'startTime', 'endTime', 'note', 'newDate'],
  InactiveStudents: ['id', 'studentId', 'studentCode', 'studentName', 'classId', 'className', 'phone', 'joinDate', 'leaveDate', 'totalSessions', 'totalPaid', 'debtAmount', 'reason'],
  AppConfig: ['key', 'value']
};

function getAppSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SpreadsheetApp.getActive().getId());
}

// ============================================================================
// 1. MENU TRÊN GOOGLE SHEETS & KHỞI TẠO BẢNG
// ============================================================================
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🌟 M_SigmaMath')
      .addItem('1. Khởi tạo / Chuẩn hóa 10 bảng', 'setupDatabase')
      .addItem('2. Sao lưu Google Drive ngay', 'backupNowFromMenu')
      .addToUi();
  } catch(e) {}
}

function setupDatabase() {
  const ss = getAppSpreadsheet();
  for (const sheetName in SHEET_SCHEMAS) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = SHEET_SCHEMAS[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    } else {
      // Cập nhật dòng tiêu đề nếu bảng cũ thiếu cột mới
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1e1b4b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  ss.toast('Đã chuẩn hóa cấu trúc 10 bảng thành công!', 'Hoàn tất', 3);
}

function createDriveBackup(ss) {
  const file = DriveApp.getFileById(ss.getId());
  const timeStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd_HH-mm");
  return file.makeCopy(`Backup_SigmaTutoring_${timeStr}`);
}

function backupNowFromMenu() {
  const ss = getAppSpreadsheet();
  const backupFile = createDriveBackup(ss);
  ss.toast(`Đã sao lưu thành công: ${backupFile.getName()}`, 'Google Drive', 4);
}

// ============================================================================
// 2. ĐỌC DỮ LIỆU TỪ WEB (GET REQUEST)
// ============================================================================
function doGet(e) {
  try {
    const ss = getAppSpreadsheet();
    const sheets = ss.getSheets();
    const result = {};

    for (const name in SHEET_SCHEMAS) {
      result[name] = [SHEET_SCHEMAS[name]];
    }

    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (SHEET_SCHEMAS[name]) {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 0 && lastCol > 0) {
          result[name] = sheet.getRange(1, 1, lastRow, lastCol).getValues();
        }
      }
    });

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// 3. GHI DỮ LIỆU (POST REQUEST - CÓ KHÓA CHỐNG XUNG ĐỘT)
// ============================================================================
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Chờ tối đa 15 giây nếu có người khác đang ghi dữ liệu cùng lúc
    lock.waitLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu gửi lên" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = getAppSpreadsheet();

    // A. LƯU TOÀN BỘ CƠ SỞ DỮ LIỆU
    if (action === "saveAll") {
      const payload = data.payload || {};
      for (const sheetName in payload) {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.insertSheet(sheetName);
        
        const rows = payload[sheetName];
        if (rows && rows.length > 0) {
          sheet.clearContents();
          sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // B. HỌC SINH NỘP BÀI THI
    if (action === "submitExamResult" || action === "submitExam") {
      const item = data.payload || data.examResult;
      let sheet = ss.getSheetByName("ExamResults") || ss.insertSheet("ExamResults");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(SHEET_SCHEMAS.ExamResults);
      }
      sheet.appendRow([
        item.id,
        item.examId,
        item.studentId,
        item.score,
        JSON.stringify(item.details || {}),
        item.tabSwitchCount || 0,
        item.submittedAt || Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd-MM-yyyy")
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // C. ĐỔI MẬT KHẨU HỌC SINH & TẮT CỜ ĐỔI MẬT KHẨU LẦN ĐẦU
    if (action === "changePassword") {
      let sheet = ss.getSheetByName("Students");
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(data.studentId)) {
            sheet.getRange(i + 1, 9).setValue(data.newPassword); // Cột 9: password
            sheet.getRange(i + 1, 10).setValue(false);           // Cột 10: mustChangePassword
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // D. ĐỒNG BỘ GOOGLE CALENDAR
    if (action === "syncToGoogleCalendar") {
      const schedules = data.schedules || [];
      const count = syncSchedulesToCalendar(schedules);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: count }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // E. SAO LƯU GOOGLE DRIVE
    if (action === "backupNow") {
      const backupFile = createDriveBackup(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Đã sao lưu thành công: ${backupFile.getName()}`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 4. ĐỒNG BỘ LỊCH DẠY GOOGLE CALENDAR
// ============================================================================
function syncSchedulesToCalendar(schedules) {
  const cal = CalendarApp.getDefaultCalendar();
  const dayIndexMap = {
    'Chủ Nhật': 0, 'Thứ 2': 1, 'Thứ 3': 2, 'Thứ 4': 3,
    'Thứ 5': 4, 'Thứ 6': 5, 'Thứ 7': 6
  };
  const now = new Date();
  let createdCount = 0;

  for (let week = 0; week < 4; week++) {
    schedules.forEach(sc => {
      const targetDay = dayIndexMap[sc.day];
      if (targetDay === undefined) return;

      const eventDate = new Date(now);
      const distance = (targetDay - now.getDay() + 7) % 7 + (week * 7);
      eventDate.setDate(now.getDate() + distance);

      const [startH, startM] = (sc.startTime || '17:30').split(':').map(Number);
      const [endH, endM] = (sc.endTime || '19:00').split(':').map(Number);

      const start = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), startH, startM);
      const end = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), endH, endM);

      const title = `[Dạy Toán] Lớp ${sc.className}`;
      if (cal.getEvents(start, end, { search: title }).length === 0) {
        cal.createEvent(title, start, end, {
          description: `Lịch học cố định lớp ${sc.className} trên hệ thống M_SigmaTeacher.`
        });
        createdCount++;
      }
    });
  }
  return createdCount;
}

// ============================================================================
// 5. HÀM KIỂM TRA TRỰC TIẾP TRÊN TRÌNH SOẠN THẢO
// ============================================================================
function testRun() {
  const out = doGet(null);
  Logger.log("Kết quả đọc dữ liệu thử nghiệm:");
  Logger.log(out.getContent());
}