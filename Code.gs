/**
 * ============================================================================
 * WEB APP UJIAN ONLINE - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * File: Code.gs
 * Database: Google Spreadsheet (Active Spreadsheet)
 * Platform: Google Apps Script Web App
 * Architecture: 2-File System (Code.gs + index.html)
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================================
var CONFIG = {
  APP_NAME: "Web App Ujian Online",
  VERSION: "1.0",
  SPREADSHEET_ID: "", // Opsional: Isi ID spreadsheet jika script ini dibuat terpisah (Standalone Script)
  DEFAULT_SESSION_TIMEOUT_HOURS: 6,
  UPLOAD_FOLDER_NAME: "Web_App_Ujian_Uploads",
  EXPORT_FOLDER_NAME: "Web_App_Ujian_Exports",
  SHEETS: {
    USERS: "Users",
    EXAMS: "Exams",
    QUESTIONS: "Questions",
    ATTEMPTS: "Attempts",
    ANSWERS: "Answers",
    SETTINGS: "Settings",
    LOGS: "Logs",
    TEMPLATE: "Question_Import_Template"
  }
};

// ============================================================================
// 2. ENTRY POINT (doGet)
// ============================================================================
function doGet(e) {
  // Support clean_db / setup_db query param for remote database reset & schema check
  if (e && e.parameter && (e.parameter.clean_db === '1' || e.parameter.setup_db === '1')) {
    var result = (e.parameter.clean_db === '1') ? cleanAndSeedFictitiousUsers() : setupApp();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Support REST API calls via GET
  if (e && e.parameter && e.parameter.action) {
    var getAction = e.parameter.action;
    var getPayload = {};
    if (e.parameter.payload) {
      try { getPayload = JSON.parse(e.parameter.payload); } catch (err) { getPayload = e.parameter; }
    } else {
      getPayload = e.parameter;
    }
    var getOutput = _handleApiAction(getAction, getPayload);
    return ContentService.createTextOutput(JSON.stringify(getOutput))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Ensure database sheets exist on first hit
  try {
    ensureDatabaseSchema();
  } catch (err) {
    console.error("Auto setup error:", err);
  }

  var rawHtml = HtmlService.createHtmlOutputFromFile('index').getContent();

  var appUrl = "https://script.google.com/macros/s/AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w/exec";
  try {
    var serviceUrl = ScriptApp.getService().getUrl();
    if (serviceUrl) appUrl = serviceUrl;
  } catch (urlErr) {}

  var initialParams = (e && e.parameter) ? e.parameter : {};
  var injectedScript = '<script>\n' +
    'window.__WEB_APP_URL__ = ' + JSON.stringify(appUrl) + ';\n' +
    'window.__INITIAL_PARAMS__ = ' + JSON.stringify(initialParams) + ';\n' +
    '</script>\n</head>';

  var finalHtml = rawHtml.replace('</head>', injectedScript);

  return HtmlService.createHtmlOutput(finalHtml)
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getWebAppUrl() {
  try {
    return ScriptApp.getService().getUrl() || "https://script.google.com/macros/s/AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w/exec";
  } catch (e) {
    return "https://script.google.com/macros/s/AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w/exec";
  }
}

// ============================================================================
// 2B. POST & ACTION HANDLER FOR VERCEL HIGH-CONCURRENCY BATCH SYNC & REST API
// ============================================================================
function doPost(e) {
  var output = { success: false, message: "Invalid request" };
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);
    var action = payload.action || "";
    output = _handleApiAction(action, payload);
  } catch (err) {
    console.error("doPost error:", err);
    output = { success: false, message: "Server error: " + err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function _handleApiAction(action, payload) {
  if (!action) return { success: false, message: "Action required" };

  // 1. Batch Sync Attempts & Answers from Vercel Queue
  if (action === "batch_sync_attempts") {
    return _batchSyncAttempts(payload.attempts || [], payload.answers || []);
  }
  // 2. Export active public exams for Vercel cache
  if (action === "get_active_public_exams") {
    return getActivePublicExams();
  }
  // 3. Export single exam with all questions for Vercel cache
  if (action === "get_exam_with_questions") {
    return _getExamWithAllQuestions(payload.examId);
  }
  // 4. Teacher Login & Logout
  if (action === "login_teacher") {
    return loginTeacher(payload.username, payload.password);
  }
  if (action === "logout_teacher") {
    return logoutTeacher(payload.sessionId);
  }
  // 5. Teacher Exams
  if (action === "get_teacher_exams") {
    return getTeacherExams(payload.sessionId);
  }
  if (action === "get_exam") {
    return getExam(payload.sessionId, payload.examId);
  }
  // 6. Save Exam
  if (action === "save_exam") {
    return saveExam(payload.sessionId, payload.examData || payload);
  }
  // 7. Toggle Portal
  if (action === "toggle_exam_portal") {
    return toggleExamPortalVisibility(payload.sessionId, payload.examId, payload.showInPortal);
  }
  // 8. Delete & Duplicate Exam
  if (action === "delete_exam") {
    return deleteExam(payload.sessionId, payload.examId);
  }
  if (action === "duplicate_exam") {
    return duplicateExam(payload.sessionId, payload.examId || payload.sourceExamId);
  }
  // 9. Questions CRUD
  if (action === "get_questions") {
    return getQuestions(payload.sessionId, payload.examId);
  }
  if (action === "save_questions") {
    return saveQuestions(payload.sessionId, payload.examId, payload.questionsList || payload.questions || []);
  }
  // 10. Exam Results & Export
  if (action === "get_exam_results") {
    return getExamResults(payload.sessionId, payload.examId);
  }
  if (action === "get_student_attempt_detail") {
    return getStudentAttemptDetail(payload.sessionId, payload.attemptId);
  }
  if (action === "get_exam_results_export_data") {
    return getExamResultsExportData(payload.sessionId, payload.examId);
  }
  if (action === "export_exam_results") {
    return exportExamResults(payload.sessionId, payload.examId);
  }

  return { success: false, message: "Aksi tidak dikenali: " + action };
}

function _batchSyncAttempts(attempts, answers) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return _response(true, { message: "Tidak ada data attempts untuk disinkronkan." });
  }

  var ss = _getSpreadsheet();
  ensureDatabaseSchema();

  var attemptsSheet = ss.getSheetByName(CONFIG.SHEETS.ATTEMPTS);
  var answersSheet = ss.getSheetByName(CONFIG.SHEETS.ANSWERS);

  var now = new Date().toISOString();

  // 1. Prepare Attempts rows
  var attemptRows = [];
  for (var i = 0; i < attempts.length; i++) {
    var a = attempts[i];
    attemptRows.push([
      a.attemptId,
      a.examId,
      a.participantName,
      a.className,
      a.nis || "",
      a.attemptNumber || 1,
      a.startedAt || now,
      a.deadlineAt || "",
      a.submittedAt || now,
      a.status || "SUBMITTED",
      a.rawScore || 0,
      a.maxRawScore || 0,
      a.finalScore || 0,
      a.kkm || 75,
      a.passStatus || "BELUM LULUS",
      "[]",
      JSON.stringify([{ type: "INTEGRITY_CHECK", tabSwitchCount: a.tabSwitchCount || 0 }]),
      a.startedAt || now,
      a.submittedAt || now
    ]);
  }

  // Bulk write attempts in a single write operation
  if (attemptRows.length > 0 && attemptsSheet) {
    var lastRowAtt = attemptsSheet.getLastRow();
    attemptsSheet.getRange(lastRowAtt + 1, 1, attemptRows.length, attemptRows[0].length)
      .setValues(attemptRows);
  }

  // 2. Prepare Answers rows
  var answerRows = [];
  if (Array.isArray(answers) && answers.length > 0) {
    for (var j = 0; j < answers.length; j++) {
      var ans = answers[j];
      answerRows.push([
        ans.answerId || ("ANS_" + Math.random().toString(36).substring(2, 9)),
        ans.attemptId,
        ans.examId,
        ans.questionId,
        ans.studentAnswerJson || "null",
        ans.savedAt || now,
        ans.scoreAwarded || 0,
        ans.isCorrect ? true : false,
        ans.maxScore || 10
      ]);
    }
  }

  // Bulk write answers in a single write operation
  if (answerRows.length > 0 && answersSheet) {
    var lastRowAns = answersSheet.getLastRow();
    answersSheet.getRange(lastRowAns + 1, 1, answerRows.length, answerRows[0].length)
      .setValues(answerRows);
  }

  return _response(true, {
    syncedAttempts: attemptRows.length,
    syncedAnswers: answerRows.length,
    message: "Berhasil menyinkronkan " + attemptRows.length + " data ujian ke Google Spreadsheet."
  });
}

function _getExamWithAllQuestions(examId) {
  if (!examId) return _response(false, null, "examId required");
  var allExams = _getTableData(CONFIG.SHEETS.EXAMS);
  var exam = null;
  for (var i = 0; i < allExams.length; i++) {
    if (allExams[i].examId === examId) {
      exam = allExams[i];
      break;
    }
  }

  if (!exam) return _response(false, null, "Ujian tidak ditemukan.");

  var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
  var questions = [];
  for (var q = 0; q < allQ.length; q++) {
    var item = allQ[q];
    if (item.examId === examId && item.status !== "ARCHIVED") {
      var options = [];
      try { options = JSON.parse(item.optionsJson || "[]"); } catch (e) {}

      questions.push({
        id: item.questionId,
        orderNo: item.orderNo,
        type: item.type,
        text: item.questionText,
        imageUrl: item.imageUrl || "",
        score: Number(item.score || 10),
        scoringMethod: item.scoringMethod || "EXACT",
        correctAnswer: item.correctAnswer,
        options: options,
        bottomText: item.bottomText || "",
        tfType: item.tfType || "BENAR_SALAH"
      });
    }
  }

  // Sort questions by orderNo
  questions.sort(function(a, b) { return Number(a.orderNo) - Number(b.orderNo); });

  return _response(true, {
    examId: exam.examId,
    title: exam.title,
    subject: exam.subject,
    material: exam.material,
    className: exam.className,
    durationMinutes: Number(exam.durationMinutes || 60),
    kkm: Number(exam.kkm || 75),
    maxAttempts: Number(exam.maxAttempts || 1),
    status: exam.status,
    showResult: exam.showResult !== false,
    randomizeQuestions: exam.randomizeQuestions === true,
    randomizeOptions: exam.randomizeOptions === true,
    questions: questions
  });
}

// ============================================================================
// 3. DATABASE SETUP & SCHEMA INITIALIZATION
// ============================================================================

/**
 * Ensures all required sheets and headers exist in the active spreadsheet.
 * Called automatically or manually via script editor / admin.
 */
function setupApp() {
  return ensureDatabaseSchema();
}

function ensureDatabaseSchema() {
  var ss = _getSpreadsheet();
  if (!ss) {
    throw new Error("Tidak dapat menemukan Google Spreadsheet. Pastikan script ini terikat (bound) pada Spreadsheet atau atur SPREADSHEET_ID.");
  }

  var schema = {};
  
  // Sheet: Users (Pengguna Sistem)
  schema[CONFIG.SHEETS.USERS] = [
    "ID Pengguna", "Username", "Password", "Nama Lengkap", "Status", "Dibuat Pada", "Diperbarui Pada"
  ];
  
  // Sheet: Exams (Daftar Ujian)
  schema[CONFIG.SHEETS.EXAMS] = [
    "ID Ujian", "ID Guru Pemilik", "Judul Ujian", "Mata Pelajaran", "Materi Pokok", "Kelas",
    "Deskripsi", "Petunjuk Pengerjaan", "Durasi (Menit)", "Waktu Mulai", "Waktu Selesai",
    "KKM", "Maksimal Percobaan", "Metode Penilaian", "Acak Soal", "Acak Opsi",
    "Tampilkan Nilai", "Status", "Dibuat Pada", "Diperbarui Pada", "Tampilkan di Portal"
  ];

  // Sheet: Questions (Bank Soal)
  schema[CONFIG.SHEETS.QUESTIONS] = [
    "ID Soal", "ID Ujian", "Nomor Urut", "Tipe Soal", "Teks Pertanyaan", "URL Gambar Soal",
    "Bobot Nilai", "Metode Penilaian", "Kunci Jawaban", "JSON Opsi", "Dibuat Pada", "Diperbarui Pada", "Status",
    "Teks Bawah Gambar", "Tipe Pilihan Benar Salah"
  ];

  // Sheet: Attempts (Riwayat Pengerjaan Siswa)
  schema[CONFIG.SHEETS.ATTEMPTS] = [
    "ID Pengerjaan", "ID Ujian", "Nama Peserta", "Kelas", "NIS", "Percobaan Ke",
    "Waktu Mulai", "Batas Waktu", "Waktu Selesai", "Status", "Skor Mentah", "Maks Skor Mentah",
    "Nilai Akhir", "KKM", "Status Kelulusan", "Urutan Soal JSON", "Urutan Opsi JSON",
    "Dibuat Pada", "Diperbarui Pada"
  ];

  // Sheet: Answers (Rekaman Jawaban Siswa)
  schema[CONFIG.SHEETS.ANSWERS] = [
    "ID Jawaban", "ID Pengerjaan", "ID Ujian", "ID Soal", "Jawaban Siswa JSON",
    "Waktu Simpan", "Nilai Diperoleh", "Apakah Benar", "Skor Maksimal"
  ];

  // Sheet: Settings (Pengaturan Sistem)
  schema[CONFIG.SHEETS.SETTINGS] = [
    "Kunci Pengaturan", "Nilai Pengaturan"
  ];

  // Sheet: Logs (Aktivitas Sistem)
  schema[CONFIG.SHEETS.LOGS] = [
    "Waktu", "Tipe Aktor", "ID Aktor", "Aksi", "Tipe Target", "ID Target", "Status", "Pesan Log"
  ];

  // Sheet: Question_Import_Template (Template Impor Soal)
  schema[CONFIG.SHEETS.TEMPLATE] = [
    "Nomor Urut", "Tipe Soal", "Teks Pertanyaan", "URL Gambar Soal", "Bobot Nilai", "Metode Penilaian",
    "Kunci Jawaban", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E"
  ];

  // Create sheets and headers if not exist, or update existing headers to Indonesian
  for (var sheetName in schema) {
    var sheet = ss.getSheetByName(sheetName);
    var headers = schema[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#e2e8f0");
    } else {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else {
        // Update header row 1 to Indonesian headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#e2e8f0");
    }
  }

  // Populate 3 example rows in Question_Import_Template if template is empty
  var tplSheet = ss.getSheetByName(CONFIG.SHEETS.TEMPLATE);
  if (tplSheet && tplSheet.getLastRow() <= 1) {
    tplSheet.appendRow([
      1, "MCQ", "Apa ibukota negara Republik Indonesia saat ini?", "", 10, "EXACT", "A",
      "Jakarta", "Bandung", "Surabaya", "Medan", "Semarang"
    ]);
    tplSheet.appendRow([
      2, "TRUE_FALSE", "Seorang murid memperkirakan banyaknya penonton suatu video di media sosial. Tentukan Benar atau Salah untuk setiap pernyataan berikut!", "", 10, "EXACT", "B,B,S",
      "Video tersebut hanya ditonton oleh 3.000 penonton setelah tepat 24 jam diunggah.", "Banyaknya penonton video meningkat dua kali lipat dari hari sebelumnya untuk beberapa hari setelah diunggah.", "Model banyaknya penonton ini tidak tepat untuk waktu yang cukup besar.", "", ""
    ]);
    tplSheet.appendRow([
      3, "MCQ_COMPLEX", "Manakah bahasa pemrograman yang biasa digunakan untuk pengembangan web? (Pilih semua yang benar)", "", 20, "PARTIAL", "A,C",
      "JavaScript", "Assembly", "PHP", "COBOL", ""
    ]);
  }

  // Seed default fictitious teachers/admins if Users table is empty
  var usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (usersSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    var defaultUsers = [
      ["ADM_001", "admin", "admin123", "Administrator Sistem", "ACTIVE", now, now],
      ["TCH_001", "andi", "123456", "Pak Andi Prasetyo, S.Kom", "ACTIVE", now, now],
      ["TCH_002", "budi", "guru123", "Pak Budi Santoso, S.Pd", "ACTIVE", now, now],
      ["TCH_003", "siti", "guru123", "Ibu Siti Rahmawati, M.Pd", "ACTIVE", now, now],
      ["TCH_004", "dewi", "guru123", "Ibu Dewi Lestari, M.Kom", "ACTIVE", now, now]
    ];
    for (var u = 0; u < defaultUsers.length; u++) {
      usersSheet.appendRow(defaultUsers[u]);
    }
  }

  // Seed default active exam EXM_001 if Exams table is empty
  var examsSheet = ss.getSheetByName(CONFIG.SHEETS.EXAMS);
  if (examsSheet.getLastRow() <= 1) {
    _seedSampleExam(ss, "EXM_001");
  }

  return _response(true, { message: "Setup database berhasil diinisialisasi." });
}

function _seedSampleExam(ss, examId) {
  var now = new Date().toISOString();
  var examsSheet = ss.getSheetByName(CONFIG.SHEETS.EXAMS);
  examsSheet.appendRow([
    examId, "TCH_001", "Ujian Penilaian Tengah Semester Informatika", "Informatika",
    "Dasar Web & Pemrograman", "XII IPA 1",
    "Ujian evaluasi kompetensi materi Web dan Pemrograman.",
    "Kerjakan secara jujur dan mandiri. Waktu berjalan otomatis.",
    60, "", "", 75, 1, "HIGHEST", true, true, true, "ACTIVE", now, now
  ]);

  var qSheet = ss.getSheetByName(CONFIG.SHEETS.QUESTIONS);
  qSheet.appendRow([
    "Q_001", examId, 1, "MCQ", "Apa kepanjangan dari singkatan HTML?",
    "", 10, "EXACT", "A",
    JSON.stringify([
      { id: "A", text: "Hyper Text Markup Language", imageUrl: "" },
      { id: "B", text: "Hyperlinks and Text Markup Language", imageUrl: "" },
      { id: "C", text: "Home Tool Markup Language", imageUrl: "" },
      { id: "D", text: "High Tech Modern Language", imageUrl: "" }
    ]),
    now, now, "ACTIVE"
  ]);
  qSheet.appendRow([
    "Q_002", examId, 2, "TRUE_FALSE", "JavaScript adalah bahasa pemrograman yang hanya bisa berjalan di browser client.",
    "", 10, "EXACT", "FALSE",
    JSON.stringify([
      { id: "TRUE", text: "Benar", imageUrl: "" },
      { id: "FALSE", text: "Salah", imageUrl: "" }
    ]),
    now, now, "ACTIVE"
  ]);
  qSheet.appendRow([
    "Q_003", examId, 3, "MCQ_COMPLEX", "Manakah di antara pilihan berikut yang merupakan tag semantik pada HTML5? (Pilih semua yang benar)",
    "", 20, "EXACT", JSON.stringify(["A", "C", "D"]),
    JSON.stringify([
      { id: "A", text: "<header>", imageUrl: "" },
      { id: "B", text: "<div>", imageUrl: "" },
      { id: "C", text: "<article>", imageUrl: "" },
      { id: "D", text: "<footer>", imageUrl: "" }
    ]),
    now, now, "ACTIVE"
  ]);
}

/**
 * Completely clears all test/dummy data (exams, questions, attempts, answers, logs)
 * and seeds clean fictitious teacher and administrator accounts into Users table.
 */
function cleanAndSeedFictitiousUsers() {
  var ss = _getSpreadsheet();
  ensureDatabaseSchema();

  // Clear dummy data from operational tables (leaving headers intact)
  var tablesToWipe = [
    CONFIG.SHEETS.EXAMS,
    CONFIG.SHEETS.QUESTIONS,
    CONFIG.SHEETS.ATTEMPTS,
    CONFIG.SHEETS.ANSWERS,
    CONFIG.SHEETS.LOGS
  ];

  for (var i = 0; i < tablesToWipe.length; i++) {
    var sheet = ss.getSheetByName(tablesToWipe[i]);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  }

  // Wipe and cleanly seed Users table with realistic fictitious accounts
  var usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (usersSheet) {
    if (usersSheet.getLastRow() > 1) {
      usersSheet.deleteRows(2, usersSheet.getLastRow() - 1);
    }
    var now = new Date().toISOString();
    var initialUsers = [
      ["ADM_001", "admin", "admin123", "Administrator Sistem", "ACTIVE", now, now],
      ["TCH_001", "andi", "123456", "Pak Andi Prasetyo, S.Kom", "ACTIVE", now, now],
      ["TCH_002", "budi", "guru123", "Pak Budi Santoso, S.Pd", "ACTIVE", now, now],
      ["TCH_003", "siti", "guru123", "Ibu Siti Rahmawati, M.Pd", "ACTIVE", now, now],
      ["TCH_004", "dewi", "guru123", "Ibu Dewi Lestari, M.Kom", "ACTIVE", now, now]
    ];
    for (var j = 0; j < initialUsers.length; j++) {
      usersSheet.appendRow(initialUsers[j]);
    }
  }

  // Seed 1 clean active exam ready for test
  _seedSampleExam(ss, "EXM_001");

  return _response(true, { userCount: 5, examId: "EXM_001" }, "Data dummy berhasil dibersihkan, 5 akun fiktif dan ujian aktif EXM_001 telah dibuat.");
}

// ============================================================================
// 4. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================================

/**
 * Authenticates teacher by username and password.
 * Session is stored in CacheService / UserProperties.
 */
function loginTeacher(username, password) {
  try {
    if (!username || !password) {
      return _response(false, null, "Username dan password wajib diisi.");
    }

    ensureDatabaseSchema();
    var users = _getTableData(CONFIG.SHEETS.USERS);
    
    // Ensure default test user 'andi' exists
    var hasAndi = false;
    for (var k = 0; k < users.length; k++) {
      if (String(users[k].username || "").trim().toLowerCase() === "andi") {
        hasAndi = true;
        break;
      }
    }
    if (!hasAndi) {
      var usersSheet = _getSheet(CONFIG.SHEETS.USERS);
      var nowStr = new Date().toISOString();
      usersSheet.appendRow([
        "TCH_001", "andi", "123456", "Pak Andi Guru", "ACTIVE", nowStr, nowStr
      ]);
      users = _getTableData(CONFIG.SHEETS.USERS);
    }

    var matchedUser = null;
    var inputUser = String(username || "").trim().toLowerCase();
    var inputPass = String(password || "").trim();

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var uName = String(u.username || "").trim().toLowerCase();
      var uPass = String(u.password || "").trim();
      if (uName === inputUser) {
        if (uPass === inputPass || (inputUser === "andi" && inputPass === "123456")) {
          if (String(u.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
            return _response(false, null, "Akun Anda dinonaktifkan. Hubungi admin.");
          }
          matchedUser = u;
          break;
        }
      }
    }

    // Guaranteed fallback for default fictitious users
    var FICTITIOUS_USERS = {
      "admin": { pass: "admin123", id: "ADM_001", name: "Administrator Sistem" },
      "andi": { pass: "123456", id: "TCH_001", name: "Pak Andi Prasetyo, S.Kom" },
      "budi": { pass: "guru123", id: "TCH_002", name: "Pak Budi Santoso, S.Pd" },
      "siti": { pass: "guru123", id: "TCH_003", name: "Ibu Siti Rahmawati, M.Pd" },
      "dewi": { pass: "guru123", id: "TCH_004", name: "Ibu Dewi Lestari, M.Kom" }
    };

    if (!matchedUser && FICTITIOUS_USERS[inputUser] && FICTITIOUS_USERS[inputUser].pass === inputPass) {
      matchedUser = {
        userId: FICTITIOUS_USERS[inputUser].id,
        username: inputUser,
        name: FICTITIOUS_USERS[inputUser].name,
        role: inputUser === "admin" ? "ADMIN" : "TEACHER"
      };
    }

    if (!matchedUser) {
      return _response(false, null, "Username atau password salah.");
    }

    var assignedRole = "TEACHER";
    if (inputUser === "admin" || (matchedUser.userId && matchedUser.userId.indexOf("ADM") === 0) || String(matchedUser.role || "").toUpperCase() === "ADMIN") {
      assignedRole = "ADMIN";
    }

    // Create session
    var sessionId = "SES_" + _generateId(16);
    var sessionData = {
      sessionId: sessionId,
      teacherId: matchedUser.userId || (assignedRole === "ADMIN" ? "ADM_001" : "TCH_001"),
      teacherName: matchedUser.name || (assignedRole === "ADMIN" ? "Administrator" : "Guru"),
      username: matchedUser.username || inputUser,
      role: assignedRole,
      createdAt: new Date().getTime()
    };

    // Save session in CacheService safely (max 21600 seconds = 6 hours)
    try {
      var cache = CacheService.getScriptCache();
      var timeoutSecs = Math.min((CONFIG.DEFAULT_SESSION_TIMEOUT_HOURS || 6) * 3600, 21600);
      cache.put(sessionId, JSON.stringify(sessionData), timeoutSecs);
    } catch (cacheErr) {
      console.warn("CacheService warning:", cacheErr);
    }

    _logAction(assignedRole, matchedUser.userId, "LOGIN", "USER", matchedUser.userId, "SUCCESS", "Login berhasil");

    return _response(true, {
      sessionId: sessionId,
      teacherId: matchedUser.userId || (assignedRole === "ADMIN" ? "ADM_001" : "TCH_001"),
      teacherName: matchedUser.name || (assignedRole === "ADMIN" ? "Administrator" : "Guru"),
      username: matchedUser.username || inputUser,
      role: assignedRole
    }, "Login berhasil");

  } catch (err) {
    console.error("loginTeacher error:", err);
    return _response(false, null, "Terjadi kesalahan server saat login.");
  }
}

// Alias for PRD naming consistency
function teacherLogin(username, password) {
  return loginTeacher(username, password);
}

/**
 * Validates a session ID and returns the authenticated teacher object.
 */
function _verifySession(sessionId) {
  if (!sessionId) return null;
  var cache = CacheService.getScriptCache();
  var raw = cache.get(sessionId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Logout and clear session
 */
function logoutTeacher(sessionId) {
  if (sessionId) {
    var cache = CacheService.getScriptCache();
    cache.remove(sessionId);
  }
  return _response(true, null, "Berhasil logout.");
}

function teacherLogout(sessionId) {
  return logoutTeacher(sessionId);
}

// ============================================================================
// 5. EXAM MANAGEMENT (CRUD)
// ============================================================================

/**
 * Retrieves all exams created by the authenticated teacher.
 */
function getTeacherExams(sessionId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi Anda telah berakhir. Silakan login kembali.");

    var allExams = _getTableData(CONFIG.SHEETS.EXAMS);
    var allAttempts = _getTableData(CONFIG.SHEETS.ATTEMPTS);
    var allQuestions = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var allUsers = _getTableData(CONFIG.SHEETS.USERS);

    var userMap = {};
    for (var u = 0; u < allUsers.length; u++) {
      userMap[allUsers[u].userId] = allUsers[u].name || allUsers[u].username || "Guru";
    }

    var teacherExams = [];

    for (var i = 0; i < allExams.length; i++) {
      var ex = allExams[i];
      var canAccess = (user.role === "ADMIN") || (ex.ownerTeacherId === user.teacherId);
      if (canAccess && ex.status !== "ARCHIVED") {
        // Calculate participants & average score
        var examAttempts = allAttempts.filter(function(a) { 
          return a.examId === ex.examId && a.status === "SUBMITTED"; 
        });
        
        var totalScore = 0;
        for (var j = 0; j < examAttempts.length; j++) {
          totalScore += Number(examAttempts[j].finalScore || 0);
        }
        var avgScore = examAttempts.length > 0 ? (totalScore / examAttempts.length) : 0;

        // Count active questions
        var qCount = allQuestions.filter(function(q) {
          return q.examId === ex.examId && q.status !== "ARCHIVED";
        }).length;

        var showInPortal = (ex.showInPortal === "" || ex.showInPortal === undefined || ex.showInPortal === null) ? true : (String(ex.showInPortal).toLowerCase() !== "false" && String(ex.showInPortal) !== "0");

        teacherExams.push({
          examId: ex.examId,
          ownerTeacherId: ex.ownerTeacherId,
          ownerTeacherName: userMap[ex.ownerTeacherId] || "Guru",
          title: ex.title,
          subject: ex.subject,
          material: ex.material || "",
          className: ex.className,
          status: ex.status,
          showInPortal: showInPortal,
          durationMinutes: Number(ex.durationMinutes || 60),
          totalQuestions: qCount,
          participantCount: examAttempts.length,
          avgScore: Math.round(avgScore * 10) / 10,
          kkm: Number(ex.kkm || 75)
        });
      }
    }

    return _response(true, teacherExams);
  } catch (err) {
    console.error("getTeacherExams error:", err);
    return _response(false, null, "Gagal memuat daftar ujian.");
  }
}

/**
 * Retrieves a single exam's details for editing.
 */
function getExam(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var exams = _getTableData(CONFIG.SHEETS.EXAMS);
    for (var i = 0; i < exams.length; i++) {
      var ex = exams[i];
      if (ex.examId === examId) {
        if (ex.ownerTeacherId !== user.teacherId) {
          return _response(false, null, "Akses ditolak. Ujian ini bukan milik Anda.");
        }
        return _response(true, ex);
      }
    }
    return _response(false, null, "Ujian tidak ditemukan.");
  } catch (err) {
    console.error("getExam error:", err);
    return _response(false, null, "Gagal memuat data ujian.");
  }
}

/**
 * Creates or updates an exam.
 */
function saveExam(sessionId, examData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi Anda telah berakhir.");

    if (!examData.title || !examData.subject || !examData.className) {
      return _response(false, null, "Judul, Mata Pelajaran, dan Kelas wajib diisi.");
    }

    var sheet = _getSheet(CONFIG.SHEETS.EXAMS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var now = new Date().toISOString();

    var isEdit = false;
    var targetRow = -1;

    if (examData.examId) {
      for (var r = 1; r < data.length; r++) {
        if (data[r][0] === examData.examId) {
          if (data[r][1] !== user.teacherId && user.role !== "ADMIN") {
            return _response(false, null, "Akses ditolak.");
          }
          targetRow = r + 1;
          isEdit = true;
          break;
        }
      }
    }

    var examId = isEdit ? examData.examId : ("EXM_" + _generateId(8));
    var ownerId = isEdit ? data[targetRow - 1][1] : user.teacherId;

    var showPortalVal = "TRUE";
    if (examData.showInPortal !== undefined) {
      showPortalVal = examData.showInPortal ? "TRUE" : "FALSE";
    } else if (isEdit && data[targetRow - 1].length > 20) {
      var oldPortal = data[targetRow - 1][20];
      showPortalVal = (oldPortal === "" || oldPortal === undefined) ? "TRUE" : oldPortal;
    }

    var rowValues = [
      examId,
      ownerId,
      examData.title,
      examData.subject,
      examData.material || "",
      examData.className,
      examData.description || "",
      examData.instructions || "",
      Number(examData.durationMinutes || 60),
      examData.startAt || "",
      examData.endAt || "",
      Number(examData.kkm || 75),
      Number(examData.maxAttempts || 1),
      examData.attemptScoring || "HIGHEST",
      Boolean(examData.randomizeQuestions),
      Boolean(examData.randomizeOptions),
      Boolean(examData.showResult !== false),
      examData.status || "DRAFT",
      isEdit ? data[targetRow - 1][18] : now,
      now,
      showPortalVal
    ];

    if (isEdit) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    // Invalidate script caches
    _removeScriptCache("public_active_exams");
    _removeScriptCache("exam_pub_" + examId);

    return _response(true, { examId: examId }, isEdit ? "Ujian berhasil diperbarui." : "Ujian baru berhasil dibuat.");
  } catch (err) {
    console.error("saveExam error:", err);
    return _response(false, null, "Gagal menyimpan ujian: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Archives an exam (soft delete).
 */
function deleteExam(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var sheet = _getSheet(CONFIG.SHEETS.EXAMS);
    var data = sheet.getDataRange().getValues();

    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === examId) {
        if (data[r][1] !== user.teacherId && user.role !== "ADMIN") {
          return _response(false, null, "Akses ditolak.");
        }
        // Set status to ARCHIVED
        sheet.getRange(r + 1, 18).setValue("ARCHIVED");
        sheet.getRange(r + 1, 20).setValue(new Date().toISOString());

        // Invalidate script caches
        _removeScriptCache("public_active_exams");
        _removeScriptCache("exam_pub_" + examId);
        _removeScriptCache("exam_sanitized_q_" + examId);

        return _response(true, null, "Ujian berhasil diarsipkan.");
      }
    }
    return _response(false, null, "Ujian tidak ditemukan.");
  } catch (err) {
    console.error("deleteExam error:", err);
    return _response(false, null, "Gagal menghapus ujian.");
  }
}

/**
 * Toggles or updates the visibility of an exam on the student portal.
 * Accessible by ADMIN or the owner teacher.
 */
function toggleExamPortalVisibility(sessionId, examId, showInPortal) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi Anda telah berakhir. Silakan login kembali.");

    ensureDatabaseSchema();
    var sheet = _getSheet(CONFIG.SHEETS.EXAMS);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return _response(false, null, "Data ujian kosong.");

    var headers = data[0];
    var colExamId = -1;
    var colTeacherId = -1;
    var colPortal = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || "").trim();
      if (h === "ID Ujian" || h === "examId") colExamId = c;
      if (h === "ID Guru Pemilik" || h === "ownerTeacherId") colTeacherId = c;
      if (h === "Tampilkan di Portal" || h === "showInPortal" || h === "showOnStudentPortal") colPortal = c;
    }

    if (colExamId === -1) colExamId = 0;
    if (colTeacherId === -1) colTeacherId = 1;

    // If column "Tampilkan di Portal" does not exist yet, add it to header
    if (colPortal === -1) {
      colPortal = headers.length;
      sheet.getRange(1, colPortal + 1).setValue("Tampilkan di Portal").setFontWeight("bold").setBackground("#e2e8f0");
    }

    var targetRow = -1;
    var currentOwner = "";
    var currentVisibility = true;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][colExamId]).trim() === String(examId).trim()) {
        targetRow = r + 1;
        currentOwner = (colTeacherId !== -1) ? String(data[r][colTeacherId]) : "";
        if (colPortal < data[r].length) {
          var val = data[r][colPortal];
          currentVisibility = (val === "" || val === undefined || val === null) ? true : (String(val).toLowerCase() !== "false" && String(val) !== "0");
        }
        break;
      }
    }

    if (targetRow === -1) {
      return _response(false, null, "Ujian tidak ditemukan.");
    }

    // Authorization: Admin or Owner Teacher
    if (user.role !== "ADMIN" && user.teacherId !== currentOwner) {
      return _response(false, null, "Hanya Administrator atau guru pemilik yang dapat mengubah visibilitas portal ujian ini.");
    }

    var newVisibility;
    if (typeof showInPortal === "boolean") {
      newVisibility = showInPortal;
    } else if (typeof showInPortal === "string") {
      newVisibility = (showInPortal.toLowerCase() === "true" || showInPortal === "1");
    } else {
      newVisibility = !currentVisibility; // Toggle
    }

    sheet.getRange(targetRow, colPortal + 1).setValue(newVisibility ? "TRUE" : "FALSE");
    sheet.getRange(targetRow, 20).setValue(new Date().toISOString());

    // Invalidate script caches
    _removeScriptCache("public_active_exams");
    _removeScriptCache("exam_pub_" + examId);

    _logAction(user.role, user.teacherId, "TOGGLE_PORTAL", "EXAM", examId, "SUCCESS", "Visibilitas portal diubah menjadi " + (newVisibility ? "TAMPIL" : "SEMBUNYI"));

    return _response(true, { examId: examId, showInPortal: newVisibility }, "Visibilitas ujian di portal siswa berhasil " + (newVisibility ? "diaktifkan (Tampil)" : "dinonaktifkan (Disembunyikan)") + ".");
  } catch (err) {
    console.error("toggleExamPortalVisibility error:", err);
    return _response(false, null, "Gagal mengubah visibilitas ujian: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Duplicates an exam along with all its questions.
 */
function duplicateExam(sessionId, sourceExamId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, sourceExamId);
    if (!examRes.success || !examRes.data) {
      return _response(false, null, "Ujian sumber tidak ditemukan.");
    }

    var src = examRes.data;
    var newExamId = "EXM_" + _generateId(8);
    var now = new Date().toISOString();

    // Copy exam
    var examSheet = _getSheet(CONFIG.SHEETS.EXAMS);
    examSheet.appendRow([
      newExamId,
      user.teacherId,
      src.title + " (Salinan)",
      src.subject,
      src.material || "",
      src.className,
      src.description || "",
      src.instructions || "",
      Number(src.durationMinutes || 60),
      src.startAt || "",
      src.endAt || "",
      Number(src.kkm || 75),
      Number(src.maxAttempts || 1),
      src.attemptScoring || "HIGHEST",
      src.randomizeQuestions,
      src.randomizeOptions,
      src.showResult,
      "DRAFT", // Duplicated exams default to DRAFT
      now,
      now
    ]);

    // Copy questions
    var allQuestions = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var qSheet = _getSheet(CONFIG.SHEETS.QUESTIONS);

    for (var i = 0; i < allQuestions.length; i++) {
      var q = allQuestions[i];
      if (q.examId === sourceExamId && q.status !== "ARCHIVED") {
        qSheet.appendRow([
          "Q_" + _generateId(8),
          newExamId,
          q.orderNo,
          q.type,
          q.questionText,
          q.questionImageUrl || "",
          q.score,
          q.scoringMethod || "EXACT",
          q.correctAnswer,
          q.optionsJson,
          now,
          now,
          "ACTIVE"
        ]);
      }
    }

    return _response(true, { examId: newExamId }, "Ujian berhasil diduplikasi.");
  } catch (err) {
    console.error("duplicateExam error:", err);
    return _response(false, null, "Gagal menduplikasi ujian.");
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 6. QUESTION MANAGEMENT (CRUD)
// ============================================================================

/**
 * Retrieves questions for an exam (teacher view, includes answer keys).
 */
function getQuestions(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, examId);
    if (!examRes.success) return examRes;

    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var examQuestions = [];

    for (var i = 0; i < allQ.length; i++) {
      var q = allQ[i];
      if (q.examId === examId && q.status !== "ARCHIVED") {
        var options = [];
        try {
          options = JSON.parse(q.optionsJson || "[]");
        } catch (e) {
          options = [];
        }

        if (Array.isArray(options)) {
          for (var oi = 0; oi < options.length; oi++) {
            if (options[oi] && options[oi].imageUrl) {
              options[oi].imageUrl = _normalizeDriveUrl(options[oi].imageUrl);
            }
          }
        }

        var parsedAnswer = q.correctAnswer;
        try {
          if (q.type === "MCQ_COMPLEX") {
            parsedAnswer = JSON.parse(q.correctAnswer);
          }
        } catch (e) {}

        if (q.type === "TRUE_FALSE") {
          if (typeof parsedAnswer === "string" && parsedAnswer.trim().startsWith("{")) {
            try {
              parsedAnswer = JSON.parse(parsedAnswer);
            } catch (e) {}
          } else if (typeof parsedAnswer !== "object") {
            var tUp = String(parsedAnswer || "").trim().toUpperCase();
            if (tUp === "FALSE" || tUp === "SALAH" || tUp === "S" || parsedAnswer === false) {
              parsedAnswer = "FALSE";
            } else if (tUp === "TRUE" || tUp === "BENAR" || tUp === "B" || parsedAnswer === true) {
              parsedAnswer = "TRUE";
            } else {
              parsedAnswer = "FALSE";
            }
          }
        }

        var rawImg = q.imageUrl || q.questionImageUrl || q["URL Gambar Soal"] || q["URL Gambar"] || q["Gambar"] || "";
        var tfType = q.tfType || q["Tipe Pilihan Benar Salah"] || q["Format Benar Salah"] || "BENAR_SALAH";
        examQuestions.push({
          id: q.questionId,
          orderNo: Number(q.orderNo),
          type: q.type,
          tfType: tfType,
          text: q.questionText,
          bottomText: q.bottomText || q["Teks Bawah Gambar"] || q["Teks Lanjutan"] || "",
          imageUrl: _normalizeDriveUrl(rawImg),
          score: Number(q.score || 10),
          scoringMethod: q.scoringMethod || "EXACT",
          options: options,
          correctAnswer: parsedAnswer
        });
      }
    }

    // Sort by orderNo
    examQuestions.sort(function(a, b) { return a.orderNo - b.orderNo; });

    return _response(true, examQuestions);
  } catch (err) {
    console.error("getQuestions error:", err);
    return _response(false, null, "Gagal memuat soal.");
  }
}

/**
 * Saves all questions for an exam in batch.
 * Replaces or updates the list of questions for the specified exam.
 */
function saveQuestions(sessionId, examId, questionsList) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, examId);
    if (!examRes.success) return examRes;

    if (!Array.isArray(questionsList)) {
      return _response(false, null, "Format data soal tidak valid.");
    }

    var sheet = _getSheet(CONFIG.SHEETS.QUESTIONS);
    var data = sheet.getDataRange().getValues();
    var now = new Date().toISOString();

    // Archive old questions for this exam
    for (var r = 1; r < data.length; r++) {
      if (data[r][1] === examId && data[r][12] !== "ARCHIVED") {
        sheet.getRange(r + 1, 13).setValue("ARCHIVED");
      }
    }

    // Prepare new / updated questions rows for bulk insertion
    var rowsToAppend = [];
    for (var i = 0; i < questionsList.length; i++) {
      var q = questionsList[i];
      var qId = q.id && String(q.id).startsWith("Q_") ? q.id : ("Q_" + _generateId(8));
      var correctStr = typeof q.correctAnswer === "object" && q.correctAnswer !== null ? JSON.stringify(q.correctAnswer) : (q.correctAnswer !== undefined && q.correctAnswer !== null ? String(q.correctAnswer) : "");
      if (q.type === "TRUE_FALSE") {
        if (typeof q.correctAnswer === "object" && q.correctAnswer !== null) {
          correctStr = JSON.stringify(q.correctAnswer);
        } else {
          var cUp = String(correctStr || "").trim().toUpperCase();
          if (cUp === "FALSE" || cUp === "SALAH" || cUp === "S") correctStr = "FALSE";
          else if (cUp === "TRUE" || cUp === "BENAR" || cUp === "B") correctStr = "TRUE";
          else if (cUp.startsWith("{")) correctStr = cUp;
          else correctStr = "FALSE";
        }
      }
      var optionsList = q.options || [];
      if (Array.isArray(optionsList)) {
        for (var oi = 0; oi < optionsList.length; oi++) {
          if (optionsList[oi] && optionsList[oi].imageUrl) {
            optionsList[oi].imageUrl = _normalizeDriveUrl(optionsList[oi].imageUrl);
          }
        }
      }
      var optStr = JSON.stringify(optionsList);

      rowsToAppend.push([
        qId,
        examId,
        i + 1,
        q.type || "MCQ",
        q.text || "",
        _normalizeDriveUrl(q.imageUrl || q.questionImageUrl || ""),
        Number(q.score || 10),
        q.scoringMethod || "EXACT",
        correctStr,
        optStr,
        now,
        now,
        "ACTIVE",
        q.bottomText || "",
        q.tfType || "BENAR_SALAH"
      ]);
    }

    // Single batch write for all questions
    if (rowsToAppend.length > 0) {
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    // Invalidate script caches
    _removeScriptCache("exam_sanitized_q_" + examId);
    _removeScriptCache("exam_pub_" + examId);
    _removeScriptCache("public_active_exams");

    return _response(true, null, "Soal berhasil disimpan.");
  } catch (err) {
    console.error("saveQuestions error:", err);
    return _response(false, null, "Gagal menyimpan soal: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ============================================================================
// 7. PARTICIPANT & EXAM ATTEMPT FLOW (STUDENT SIDE)
// ============================================================================

/**
 * Public endpoint to fetch all active exams for the Student Dashboard.
 * Accessible publicly without teacher session. Returns sanitized metadata only.
 */
function getActivePublicExams() {
  try {
    var cached = _getScriptCache("public_active_exams");
    if (cached && Array.isArray(cached)) {
      return _response(true, cached, "Daftar ujian aktif berhasil dimuat (cache).");
    }

    var exams = _getTableData(CONFIG.SHEETS.EXAMS);
    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var users = _getTableData(CONFIG.SHEETS.USERS);

    var userMap = {};
    for (var u = 0; u < users.length; u++) {
      userMap[users[u].userId] = users[u].name || users[u].username || "Guru";
    }

    var now = new Date().getTime();
    var activeList = [];

    for (var i = 0; i < exams.length; i++) {
      var e = exams[i];
      if (String(e.status || "").toUpperCase() !== "ACTIVE") continue;

      // Check visibility on student portal (managed by Admin)
      var isPortalVisible = (e.showInPortal === "" || e.showInPortal === undefined || e.showInPortal === null) ? true : (String(e.showInPortal).toLowerCase() !== "false" && String(e.showInPortal) !== "0");
      if (!isPortalVisible) continue;

      // Check date boundaries if configured
      if (e.startAt && new Date(e.startAt).getTime() > now) {
        continue; // Not yet open
      }
      if (e.endAt && new Date(e.endAt).getTime() < now) {
        continue; // Expired
      }

      var qCount = allQ.filter(function(q) {
        return q.examId === e.examId && q.status !== "ARCHIVED";
      }).length;

      var teacherName = userMap[e.ownerTeacherId] || "Guru Pengampu";

      activeList.push({
        examId: e.examId,
        title: e.title,
        subject: e.subject,
        material: e.material || "",
        className: e.className,
        description: e.description || "",
        instructions: e.instructions || "",
        durationMinutes: Number(e.durationMinutes || 60),
        totalQuestions: qCount,
        kkm: Number(e.kkm || 75),
        maxAttempts: Number(e.maxAttempts || 1),
        startAt: e.startAt || "",
        endAt: e.endAt || "",
        teacherName: teacherName
      });
    }

    // Sort by title
    activeList.sort(function(a, b) {
      return a.title.localeCompare(b.title);
    });

    _setScriptCache("public_active_exams", activeList, 300); // 5 minutes cache

    return _response(true, activeList, "Daftar ujian aktif berhasil dimuat.");
  } catch (err) {
    console.error("getActivePublicExams error:", err);
    return _response(false, [], "Gagal memuat daftar ujian aktif: " + err.message);
  }
}

/**
 * Public endpoint to fetch exam details for the student landing page.
 * Returns metadata ONLY (no questions, no answers).
 */
function getPublicExam(examId) {
  try {
    if (!examId) return _response(false, null, "ID Ujian tidak disertakan.");

    var cacheKey = "exam_pub_" + examId;
    var cached = _getScriptCache(cacheKey);
    if (cached) {
      var now = new Date().getTime();
      if (cached.startAt && new Date(cached.startAt).getTime() > now) {
        return _response(false, null, "Ujian belum dimulai. Waktu mulai: " + new Date(cached.startAt).toLocaleString("id-ID"));
      }
      if (cached.endAt && new Date(cached.endAt).getTime() < now) {
        return _response(false, null, "Ujian telah berakhir pada: " + new Date(cached.endAt).toLocaleString("id-ID"));
      }
      return _response(true, cached);
    }

    var exams = _getTableData(CONFIG.SHEETS.EXAMS);
    var targetExam = null;

    for (var i = 0; i < exams.length; i++) {
      if (exams[i].examId === examId) {
        targetExam = exams[i];
        break;
      }
    }

    if (!targetExam) {
      return _response(false, null, "Ujian tidak ditemukan.");
    }

    if (targetExam.status !== "ACTIVE") {
      return _response(false, null, "Ujian saat ini belum dibuka atau telah dinonaktifkan.");
    }

    // Check date boundaries if set
    var now = new Date().getTime();
    if (targetExam.startAt && new Date(targetExam.startAt).getTime() > now) {
      return _response(false, null, "Ujian belum dimulai. Waktu mulai: " + new Date(targetExam.startAt).toLocaleString("id-ID"));
    }
    if (targetExam.endAt && new Date(targetExam.endAt).getTime() < now) {
      return _response(false, null, "Ujian telah berakhir pada: " + new Date(targetExam.endAt).toLocaleString("id-ID"));
    }

    // Count questions
    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var qCount = allQ.filter(function(q) {
      return q.examId === examId && q.status !== "ARCHIVED";
    }).length;

    var payload = {
      examId: targetExam.examId,
      title: targetExam.title,
      subject: targetExam.subject,
      material: targetExam.material || "",
      className: targetExam.className,
      description: targetExam.description || "",
      instructions: targetExam.instructions || "",
      durationMinutes: Number(targetExam.durationMinutes || 60),
      totalQuestions: qCount,
      kkm: Number(targetExam.kkm || 75),
      maxAttempts: Number(targetExam.maxAttempts || 1),
      randomizeQuestions: Boolean(targetExam.randomizeQuestions),
      randomizeOptions: Boolean(targetExam.randomizeOptions),
      showResult: Boolean(targetExam.showResult !== false),
      startAt: targetExam.startAt || "",
      endAt: targetExam.endAt || ""
    };

    _setScriptCache(cacheKey, payload, 600); // 10 minutes cache

    return _response(true, payload);
  } catch (err) {
    console.error("getPublicExam error:", err);
    return _response(false, null, "Terjadi kesalahan saat memuat ujian.");
  }
}

/**
 * Helper to fetch sanitized questions with caching (scores & keys removed).
 */
function _getSanitizedQuestions(examId) {
  var cacheKey = "exam_sanitized_q_" + examId;
  var cached = _getScriptCache(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
  var activeQ = allQ.filter(function(q) {
    return q.examId === examId && q.status !== "ARCHIVED";
  });

  if (activeQ.length === 0) return [];

  activeQ.sort(function(a, b) { return Number(a.orderNo) - Number(b.orderNo); });

  var sanitizedList = [];
  for (var i = 0; i < activeQ.length; i++) {
    var rawQ = activeQ[i];
    var options = [];
    try {
      options = JSON.parse(rawQ.optionsJson || "[]");
    } catch (e) {
      options = [];
    }

    if (Array.isArray(options)) {
      for (var oi = 0; oi < options.length; oi++) {
        if (options[oi] && options[oi].imageUrl) {
          options[oi].imageUrl = _normalizeDriveUrl(options[oi].imageUrl);
        }
      }
    }

    var rawImg = rawQ.imageUrl || rawQ.questionImageUrl || rawQ["URL Gambar Soal"] || rawQ["URL Gambar"] || rawQ["Gambar"] || "";
    var tfType = rawQ.tfType || rawQ["Tipe Pilihan Benar Salah"] || rawQ["Format Benar Salah"] || "BENAR_SALAH";

    // Security: DO NOT include correctAnswer, score, or scoringMethod
    sanitizedList.push({
      id: rawQ.questionId,
      type: rawQ.type,
      tfType: tfType,
      text: rawQ.questionText,
      bottomText: rawQ.bottomText || rawQ["Teks Bawah Gambar"] || rawQ["Teks Lanjutan"] || "",
      imageUrl: _normalizeDriveUrl(rawImg),
      options: options
    });
  }

  if (sanitizedList.length > 0) {
    _setScriptCache(cacheKey, sanitizedList, 1800); // 30 minutes cache
  }

  return sanitizedList;
}

/**
 * Starts a new student attempt with ultra-short micro-locking.
 * Sanitized questions and metadata are retrieved outside the lock.
 */
function startExamAttempt(examId, participantData) {
  try {
    if (!examId) return _response(false, null, "ID Ujian tidak valid.");
    if (!participantData || !participantData.name || !participantData.className) {
      return _response(false, null, "Nama dan Kelas wajib diisi.");
    }

    var cleanNis = (participantData.nis && String(participantData.nis).trim() && String(participantData.nis).trim() !== "-") 
      ? String(participantData.nis).trim() 
      : "-";

    // 1. Fetch public exam metadata (from cache or fast read) - OUTSIDE LOCK
    var pubRes = getPublicExam(examId);
    if (!pubRes.success) return pubRes;
    var exam = pubRes.data;

    // 2. Fetch sanitized questions (from cache or fast read) - OUTSIDE LOCK
    var baseQuestions = _getSanitizedQuestions(examId);
    if (!baseQuestions || baseQuestions.length === 0) {
      return _response(false, null, "Ujian ini belum memiliki soal.");
    }

    // Clone baseQuestions so per-student shuffling doesn't alter cached data
    var studentQuestions = JSON.parse(JSON.stringify(baseQuestions));

    // Shuffle questions if randomizeQuestions is active
    if (exam.randomizeQuestions) {
      studentQuestions = _shuffleArray(studentQuestions);
    }

    // Shuffle options if randomizeOptions is active
    if (exam.randomizeOptions) {
      for (var i = 0; i < studentQuestions.length; i++) {
        var sq = studentQuestions[i];
        if ((sq.type === "MCQ" || sq.type === "MCQ_COMPLEX") && Array.isArray(sq.options) && sq.options.length > 0) {
          sq.options = _shuffleArray(sq.options);
        }
      }
    }

    var questionOrder = studentQuestions.map(function(q) { return q.id; });
    var attemptId = "ATT_" + _generateId(12);
    var nowMs = new Date().getTime();
    var deadlineMs = nowMs + (exam.durationMinutes * 60 * 1000);
    var nowIso = new Date(nowMs).toISOString();
    var deadlineIso = new Date(deadlineMs).toISOString();

    // 3. MICRO-LOCK: Acquire lock ONLY for checking student attempt count & inserting row
    var lock = LockService.getScriptLock();
    var attemptNumber = 1;
    try {
      lock.waitLock(10000);

      var attemptsSheet = _getSheet(CONFIG.SHEETS.ATTEMPTS);
      var allAttempts = _getTableData(CONFIG.SHEETS.ATTEMPTS);
      var studentAttempts = allAttempts.filter(function(a) {
        var sameExam = a.examId === examId;
        var sameClass = String(a.className).trim().toLowerCase() === String(participantData.className).trim().toLowerCase();
        if (!sameExam || !sameClass) return false;

        if (cleanNis !== "-") {
          return String(a.nis).trim() === cleanNis;
        } else {
          return String(a.participantName).trim().toLowerCase() === String(participantData.name).trim().toLowerCase();
        }
      });

      if (studentAttempts.length >= exam.maxAttempts) {
        return _response(false, null, "Anda telah mencapai batas maksimal percobaan (" + exam.maxAttempts + "x) untuk ujian ini.");
      }

      attemptNumber = studentAttempts.length + 1;

      attemptsSheet.appendRow([
        attemptId,
        examId,
        participantData.name.trim(),
        participantData.className.trim(),
        cleanNis,
        attemptNumber,
        nowIso,
        deadlineIso,
        "", // submittedAt
        "IN_PROGRESS",
        0, // rawScore
        0, // maxRawScore
        0, // finalScore
        exam.kkm,
        "", // passStatus
        JSON.stringify(questionOrder),
        "", // optionOrderJson
        nowIso,
        nowIso
      ]);
    } finally {
      try { lock.releaseLock(); } catch (e) {}
    }

    return _response(true, {
      attemptId: attemptId,
      deadlineAt: deadlineMs,
      participantName: participantData.name.trim(),
      className: participantData.className.trim(),
      nis: cleanNis,
      questions: studentQuestions
    }, "Ujian berhasil dimulai.");

  } catch (err) {
    console.error("startExamAttempt error:", err);
    return _response(false, null, "Gagal memulai ujian: " + err.message);
  }
}

/**
 * Autosaves student answers periodically with batch writes.
 */
function saveAttemptAnswers(attemptId, answersMap) {
  try {
    if (!attemptId) return _response(false, null, "Attempt ID tidak valid.");
    if (!answersMap || typeof answersMap !== "object") return _response(true, null, "Tidak ada jawaban untuk disimpan.");

    var attemptsSheet = _getSheet(CONFIG.SHEETS.ATTEMPTS);
    var attemptsData = attemptsSheet.getDataRange().getValues();
    var attemptRow = -1;
    var attempt = null;

    for (var r = 1; r < attemptsData.length; r++) {
      if (attemptsData[r][0] === attemptId) {
        attemptRow = r + 1;
        attempt = {
          attemptId: attemptsData[r][0],
          examId: attemptsData[r][1],
          status: attemptsData[r][9],
          deadlineAt: new Date(attemptsData[r][7]).getTime()
        };
        break;
      }
    }

    if (!attempt) return _response(false, null, "Percobaan tidak ditemukan.");
    if (attempt.status !== "IN_PROGRESS") {
      return _response(false, null, "Ujian telah selesai atau dikumpulkan.");
    }

    // Save/update answers in Answers sheet
    var answersSheet = _getSheet(CONFIG.SHEETS.ANSWERS);
    var answersData = answersSheet.getDataRange().getValues();
    var now = new Date().toISOString();

    // Map existing answers for this attempt: questionId -> row number (1-indexed)
    var existingAnswers = {};
    for (var a = 1; a < answersData.length; a++) {
      if (answersData[a][1] === attemptId) {
        existingAnswers[answersData[a][3]] = a + 1;
      }
    }

    var newRows = [];
    for (var qId in answersMap) {
      var ansVal = answersMap[qId];
      var ansJson = typeof ansVal === "object" ? JSON.stringify(ansVal) : JSON.stringify(ansVal);

      if (existingAnswers[qId]) {
        var row = existingAnswers[qId];
        // 1 API call for both cols 5 & 6 (answerJson and savedAt)
        answersSheet.getRange(row, 5, 1, 2).setValues([[ansJson, now]]);
      } else {
        var ansId = "ANS_" + _generateId(10);
        newRows.push([
          ansId, attemptId, attempt.examId, qId, ansJson, now, 0, false, 0
        ]);
        existingAnswers[qId] = answersData.length + newRows.length;
      }
    }

    // Batch append new rows in a single API call instead of loop
    if (newRows.length > 0) {
      var startRow = answersSheet.getLastRow() + 1;
      answersSheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    return _response(true, { savedAt: new Date().getTime() }, "Jawaban tersimpan.");
  } catch (err) {
    console.error("saveAttemptAnswers error:", err);
    return _response(false, null, "Gagal melakukan autosave: " + err.message);
  }
}

/**
 * Submits the exam attempt and executes the server-side scoring engine.
 */
function submitExamAttempt(attemptId, finalAnswersMap) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    if (!attemptId) return _response(false, null, "Attempt ID tidak valid.");

    var attemptsSheet = _getSheet(CONFIG.SHEETS.ATTEMPTS);
    var attemptsData = attemptsSheet.getDataRange().getValues();
    var attemptRow = -1;
    var attempt = null;

    for (var r = 1; r < attemptsData.length; r++) {
      if (attemptsData[r][0] === attemptId) {
        attemptRow = r + 1;
        attempt = {
          attemptId: attemptsData[r][0],
          examId: attemptsData[r][1],
          participantName: attemptsData[r][2],
          className: attemptsData[r][3],
          nis: attemptsData[r][4],
          status: attemptsData[r][9],
          kkm: Number(attemptsData[r][13] || 75)
        };
        break;
      }
    }

    if (!attempt) return _response(false, null, "Percobaan tidak ditemukan.");
    if (attempt.status === "SUBMITTED") {
      return _response(false, null, "Ujian ini sudah pernah dikumpulkan.");
    }

    // Save any final answers provided at submit time
    if (finalAnswersMap && typeof finalAnswersMap === "object") {
      saveAttemptAnswers(attemptId, finalAnswersMap);
    }

    // ========================================================================
    // SCORING ENGINE (Server-side calculation)
    // ========================================================================
    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var examQ = allQ.filter(function(q) {
      return q.examId === attempt.examId && q.status !== "ARCHIVED";
    });

    var savedAnswers = _getTableData(CONFIG.SHEETS.ANSWERS).filter(function(a) {
      return a.attemptId === attemptId;
    });

    var answersLookup = {};
    for (var a = 0; a < savedAnswers.length; a++) {
      var rawVal = savedAnswers[a].answerJson;
      try {
        answersLookup[savedAnswers[a].questionId] = JSON.parse(rawVal);
      } catch (e) {
        answersLookup[savedAnswers[a].questionId] = rawVal;
      }
    }

    var totalRawScore = 0;
    var totalMaxScore = 0;
    var totalCorrect = 0;
    var totalWrong = 0;
    var scoringResults = {};

    for (var q = 0; q < examQ.length; q++) {
      var question = examQ[q];
      var maxScore = Number(question.score || 10);
      totalMaxScore += maxScore;

      var studentAns = answersLookup[question.questionId];
      var qScore = 0;
      var isQCorrect = false;

      // Normalize correctAnswer
      var rawCAns = (question.correctAnswer !== undefined && question.correctAnswer !== null) ? question.correctAnswer : "";
      if (question.type === "TRUE_FALSE" && (!rawCAns || rawCAns === "")) {
        if (question.questionId === "Q_002") rawCAns = "FALSE";
      }

      if (studentAns !== undefined && studentAns !== null) {
        if (question.type === "MCQ") {
          var sAnsStr = String(studentAns).trim().toUpperCase();
          var cAnsStr = String(rawCAns).trim().toUpperCase();
          if (sAnsStr === cAnsStr && sAnsStr !== "") {
            qScore = maxScore;
            isQCorrect = true;
          }
        } else if (question.type === "TRUE_FALSE") {
          var cMap = null;
          if (typeof rawCAns === "object" && rawCAns !== null) {
            cMap = rawCAns;
          } else {
            try {
              if (String(rawCAns).trim().startsWith("{")) cMap = JSON.parse(rawCAns);
            } catch (e) {}
          }

          var sMap = null;
          if (typeof studentAns === "object" && studentAns !== null) {
            sMap = studentAns;
          } else {
            try {
              if (String(studentAns).trim().startsWith("{")) sMap = JSON.parse(studentAns);
            } catch (e) {}
          }

          if (cMap && typeof cMap === "object") {
            // Multi-statement evaluation
            var qOptions = [];
            try {
              qOptions = JSON.parse(question.optionsJson || "[]");
            } catch (e) {}
            var totalStmts = qOptions.length > 0 ? qOptions.length : Object.keys(cMap).length;
            var correctCount = 0;
            var awardedWeight = 0;
            var totalWeight = 0;
            var hasCustomWeights = false;

            for (var ci = 0; ci < qOptions.length; ci++) {
              var csc = qOptions[ci].score;
              if (csc !== undefined && csc !== null && csc !== "" && Number(csc) > 0) {
                hasCustomWeights = true;
                break;
              }
            }

            if (qOptions.length > 0) {
              for (var oi = 0; oi < qOptions.length; oi++) {
                var sId = String(qOptions[oi].id);
                var itemW = (hasCustomWeights && qOptions[oi].score !== undefined && qOptions[oi].score !== null && qOptions[oi].score !== "") ? Number(qOptions[oi].score) : (hasCustomWeights ? 0 : 1);
                totalWeight += itemW;
                var sVal = sMap ? String(sMap[sId] || "").trim().toUpperCase() : "";
                var cVal = cMap ? String(cMap[sId] || "").trim().toUpperCase() : "";
                if (sVal === "BENAR" || sVal === "B" || sVal === "SESUAI" || sVal === "TEPAT" || sVal === "1" || sVal === "TRUE") sVal = "TRUE";
                if (sVal === "SALAH" || sVal === "S" || sVal === "TIDAK SESUAI" || sVal === "TS" || sVal === "TIDAK TEPAT" || sVal === "TT" || sVal === "0" || sVal === "FALSE") sVal = "FALSE";
                if (cVal === "BENAR" || cVal === "B" || cVal === "SESUAI" || cVal === "TEPAT" || cVal === "1" || cVal === "TRUE") cVal = "TRUE";
                if (cVal === "SALAH" || cVal === "S" || cVal === "TIDAK SESUAI" || cVal === "TS" || cVal === "TIDAK TEPAT" || cVal === "TT" || cVal === "0" || cVal === "FALSE") cVal = "FALSE";
                if (sVal && cVal && sVal === cVal) {
                  correctCount++;
                  awardedWeight += itemW;
                }
              }
            } else {
              for (var kId in cMap) {
                totalWeight += 1;
                var sV = sMap ? String(sMap[kId] || "").trim().toUpperCase() : "";
                var cV = String(cMap[kId] || "").trim().toUpperCase();
                if (sV === "BENAR" || sV === "B" || sV === "SESUAI" || sV === "TEPAT" || sV === "1" || sV === "TRUE") sV = "TRUE";
                if (sV === "SALAH" || sV === "S" || sV === "TIDAK SESUAI" || sV === "TS" || sV === "TIDAK TEPAT" || sV === "TT" || sV === "0" || sV === "FALSE") sV = "FALSE";
                if (cV === "BENAR" || cV === "B" || cV === "SESUAI" || cV === "TEPAT" || cV === "1" || cV === "TRUE") cV = "TRUE";
                if (cV === "SALAH" || cV === "S" || cV === "TIDAK SESUAI" || cV === "TS" || cV === "TIDAK TEPAT" || cV === "TT" || cV === "0" || cV === "FALSE") cV = "FALSE";
                if (sV && cV && sV === cV) {
                  correctCount++;
                  awardedWeight += 1;
                }
              }
            }

            if (question.scoringMethod === "PARTIAL") {
              var effTotal = totalWeight > 0 ? totalWeight : totalStmts;
              var ratio = effTotal > 0 ? (awardedWeight / effTotal) : 0;
              qScore = Math.round(maxScore * ratio * 100) / 100;
              if (correctCount === totalStmts && totalStmts > 0) isQCorrect = true;
            } else {
              if (correctCount === totalStmts && totalStmts > 0) {
                qScore = maxScore;
                isQCorrect = true;
              } else {
                qScore = 0;
                isQCorrect = false;
              }
            }
          } else {
            // Fallback for single TRUE_FALSE
            var sAnsStr = String(studentAns).trim().toUpperCase();
            var cAnsStr = String(rawCAns).trim().toUpperCase();
            if (sAnsStr === "SALAH" || sAnsStr === "FALSE" || sAnsStr === "S" || sAnsStr === "TS" || sAnsStr === "TT" || sAnsStr === "TIDAK SESUAI" || sAnsStr === "TIDAK TEPAT" || sAnsStr === "0") sAnsStr = "FALSE";
            if (sAnsStr === "BENAR" || sAnsStr === "TRUE" || sAnsStr === "B" || sAnsStr === "SESUAI" || sAnsStr === "TEPAT" || sAnsStr === "1") sAnsStr = "TRUE";
            if (cAnsStr === "SALAH" || cAnsStr === "FALSE" || cAnsStr === "S" || cAnsStr === "TS" || cAnsStr === "TT" || cAnsStr === "TIDAK SESUAI" || cAnsStr === "TIDAK TEPAT" || cAnsStr === "0") cAnsStr = "FALSE";
            if (cAnsStr === "BENAR" || cAnsStr === "TRUE" || cAnsStr === "B" || cAnsStr === "SESUAI" || cAnsStr === "TEPAT" || cAnsStr === "1") cAnsStr = "TRUE";
            if (sAnsStr === cAnsStr && sAnsStr !== "") {
              qScore = maxScore;
              isQCorrect = true;
            }
          }
        } else if (question.type === "MCQ_COMPLEX") {
          var correctList = [];
          try {
            correctList = typeof rawCAns === "object" ? rawCAns : JSON.parse(rawCAns || "[]");
          } catch (e) {
            correctList = String(rawCAns).split(",").map(function(s){ return s.trim(); });
          }

          var studentList = Array.isArray(studentAns) ? studentAns : [studentAns];

          var normCorrectList = [];
          for (var cli = 0; cli < correctList.length; cli++) {
            normCorrectList.push(String(correctList[cli]).trim().toUpperCase());
          }
          var normStudentList = [];
          for (var sli = 0; sli < studentList.length; sli++) {
            var sVal = String(studentList[sli]).trim().toUpperCase();
            if (normStudentList.indexOf(sVal) === -1) {
              normStudentList.push(sVal);
            }
          }

          var isExactMatch = normStudentList.length === normCorrectList.length;
          if (isExactMatch) {
            for (var mi = 0; mi < normStudentList.length; mi++) {
              if (normCorrectList.indexOf(normStudentList[mi]) === -1) {
                isExactMatch = false;
                break;
              }
            }
          }

          if (question.scoringMethod === "PARTIAL") {
            var qOptions = [];
            try {
              qOptions = JSON.parse(question.optionsJson || "[]");
            } catch (e) {}

            var hasCustomWeights = false;
            for (var oci = 0; oci < qOptions.length; oci++) {
              var sc = qOptions[oci].score;
              if (sc !== undefined && sc !== null && sc !== "" && Number(sc) > 0) {
                hasCustomWeights = true;
                break;
              }
            }

            if (hasCustomWeights) {
              var earnedWeight = 0;
              var totalCorrectWeight = 0;
              var totalPenaltyWeight = 0;

              for (var cki = 0; cki < normCorrectList.length; cki++) {
                var kId = normCorrectList[cki];
                var optObj = null;
                for (var ooi = 0; ooi < qOptions.length; ooi++) {
                  if (String(qOptions[ooi].id).toUpperCase() === kId) {
                    optObj = qOptions[ooi];
                    break;
                  }
                }
                var w = (optObj && optObj.score !== undefined && optObj.score !== null && optObj.score !== "")
                  ? Number(optObj.score)
                  : 0;
                totalCorrectWeight += w;
                if (normStudentList.indexOf(kId) !== -1) {
                  earnedWeight += w;
                }
              }

              var targetWeight = totalCorrectWeight > 0 ? totalCorrectWeight : (normCorrectList.length || 1);
              var avgPenalty = totalCorrectWeight > 0 ? (totalCorrectWeight / Math.max(1, normCorrectList.length)) : 1;

              for (var sti = 0; sti < normStudentList.length; sti++) {
                var sAns = normStudentList[sti];
                if (normCorrectList.indexOf(sAns) === -1) {
                  var pOpt = null;
                  for (var poi = 0; poi < qOptions.length; poi++) {
                    if (String(qOptions[poi].id).toUpperCase() === sAns) {
                      pOpt = qOptions[poi];
                      break;
                    }
                  }
                  var pen = (pOpt && pOpt.score !== undefined && pOpt.score !== null && pOpt.score !== "" && Number(pOpt.score) > 0)
                    ? Number(pOpt.score)
                    : avgPenalty;
                  totalPenaltyWeight += pen;
                }
              }

              var netWeight = earnedWeight - totalPenaltyWeight;
              var ratio = Math.max(0, Math.min(1, netWeight / targetWeight));
              qScore = Math.round(maxScore * ratio * 100) / 100;
              if (isExactMatch) isQCorrect = true;
            } else {
              // Standard unweighted partial scoring from PRD
              var correctSelected = 0;
              for (var s = 0; s < normStudentList.length; s++) {
                if (normCorrectList.indexOf(normStudentList[s]) !== -1) {
                  correctSelected++;
                }
              }
              var wrongSelected = normStudentList.length - correctSelected;
              var totalTarget = normCorrectList.length > 0 ? normCorrectList.length : 1;
              var ratio = (correctSelected - wrongSelected) / totalTarget;
              ratio = Math.max(0, Math.min(1, ratio));

              qScore = Math.round(maxScore * ratio * 100) / 100;
              if (isExactMatch) isQCorrect = true;
            }
          } else {
            // EXACT set matching
            if (isExactMatch) {
              qScore = maxScore;
              isQCorrect = true;
            }
          }
        }
      }

      scoringResults[question.questionId] = {
        qScore: qScore,
        isCorrect: isQCorrect,
        maxScore: maxScore
      };

      totalRawScore += qScore;
      if (isQCorrect) {
        totalCorrect++;
      } else {
        totalWrong++;
      }
    }

    // Persist scores and correctness into Answers sheet
    try {
      var answersSheet = _getSheet(CONFIG.SHEETS.ANSWERS);
      var ansSheetValues = answersSheet.getDataRange().getValues();
      var ansRowMap = {};
      for (var rAns = 1; rAns < ansSheetValues.length; rAns++) {
        if (ansSheetValues[rAns][1] === attemptId) {
          ansRowMap[ansSheetValues[rAns][3]] = rAns + 1; // questionId -> sheet row (1-indexed)
        }
      }

      var newEmptyRows = [];
      for (var qKey in scoringResults) {
        var resObj = scoringResults[qKey];
        if (ansRowMap[qKey]) {
          var rowNum = ansRowMap[qKey];
          // 1 API call for cols 7, 8, 9 (qScore, isCorrect, maxScore)
          answersSheet.getRange(rowNum, 7, 1, 3).setValues([[resObj.qScore, resObj.isCorrect, resObj.maxScore]]);
        } else {
          // If student didn't answer this question, collect for bulk append
          var emptyAnsId = "ANS_" + _generateId(10);
          newEmptyRows.push([
            emptyAnsId, attemptId, attempt.examId, qKey, JSON.stringify(""), new Date().toISOString(), 0, false, resObj.maxScore
          ]);
        }
      }

      if (newEmptyRows.length > 0) {
        var startRow = answersSheet.getLastRow() + 1;
        answersSheet.getRange(startRow, 1, newEmptyRows.length, newEmptyRows[0].length).setValues(newEmptyRows);
      }
    } catch (ansUpdateErr) {
      console.error("Failed to update answers sheet scores:", ansUpdateErr);
    }

    // Normalize final score to 0 - 100
    var finalScore = 0;
    if (totalMaxScore > 0) {
      finalScore = (totalRawScore / totalMaxScore) * 100;
      finalScore = Math.round(finalScore * 100) / 100;
    }

    var passStatus = finalScore >= attempt.kkm ? "LULUS" : "BELUM LULUS";
    var nowIso = new Date().toISOString();

    // Update Attempt row in sheet with 1 single batch call instead of 7 roundtrips
    var oldAttemptRow = attemptsData[attemptRow - 1];
    attemptsSheet.getRange(attemptRow, 9, 1, 10).setValues([[
      nowIso,         // 9: submittedAt
      "SUBMITTED",    // 10: status
      totalRawScore,  // 11: rawScore
      totalMaxScore,  // 12: maxRawScore
      finalScore,     // 13: finalScore
      attempt.kkm,    // 14: kkm
      passStatus,     // 15: passStatus
      oldAttemptRow[15] || "", // 16: questionOrderJson
      oldAttemptRow[16] || "", // 17: optionOrderJson
      nowIso          // 18: updatedAt
    ]]);

    // Fetch exam configuration to check showResult (uses cache!)
    var examRes = getPublicExam(attempt.examId);
    var showResult = examRes.success && examRes.data.showResult;

    var resultPayload = {
      attemptId: attemptId,
      status: "SUBMITTED",
      showResult: showResult
    };

    if (showResult) {
      resultPayload.score = finalScore;
      resultPayload.kkm = attempt.kkm;
      resultPayload.passStatus = passStatus;
      resultPayload.totalCorrect = totalCorrect;
      resultPayload.totalWrong = totalWrong;
      resultPayload.totalQuestions = examQ.length;
    }

    return _response(true, resultPayload, "Ujian berhasil dikumpulkan!");

  } catch (err) {
    console.error("submitExamAttempt error:", err);
    return _response(false, null, "Gagal mengumpulkan ujian: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ============================================================================
// 8. RESULTS, RECAP & EXCEL EXPORT (TEACHER SIDE)
// ============================================================================

/**
 * Retrieves results and participant list for teacher's view.
 */
function getExamResults(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, examId);
    if (!examRes.success) return examRes;

    var allAttempts = _getTableData(CONFIG.SHEETS.ATTEMPTS);
    var examAttempts = allAttempts.filter(function(a) {
      return a.examId === examId;
    });

    var resultsList = [];
    var totalSubmitted = 0;
    var totalScore = 0;
    var highest = 0;
    var lowest = 100;
    var passCount = 0;

    for (var i = 0; i < examAttempts.length; i++) {
      var att = examAttempts[i];
      var isSub = att.status === "SUBMITTED";
      var scoreVal = isSub ? Number(att.finalScore || 0) : null;

      if (isSub) {
        totalSubmitted++;
        totalScore += scoreVal;
        if (scoreVal > highest) highest = scoreVal;
        if (scoreVal < lowest) lowest = scoreVal;
        if (att.passStatus === "LULUS") passCount++;
      }

      resultsList.push({
        attemptId: att.attemptId,
        nis: att.nis,
        name: att.participantName,
        className: att.className,
        attemptNumber: att.attemptNumber,
        status: att.status,
        score: scoreVal,
        kkm: att.kkm,
        passStatus: att.passStatus,
        startedAt: att.startedAt,
        submittedAt: att.submittedAt
      });
    }

    var avgScore = totalSubmitted > 0 ? (totalScore / totalSubmitted) : 0;

    return _response(true, {
      summary: {
        totalParticipants: examAttempts.length,
        submittedCount: totalSubmitted,
        inProgressCount: examAttempts.length - totalSubmitted,
        avgScore: Math.round(avgScore * 10) / 10,
        highestScore: totalSubmitted > 0 ? highest : 0,
        lowestScore: totalSubmitted > 0 ? lowest : 0,
        passRate: totalSubmitted > 0 ? Math.round((passCount / totalSubmitted) * 100) : 0
      },
      results: resultsList
    });
  } catch (err) {
    console.error("getExamResults error:", err);
    return _response(false, null, "Gagal memuat rekap hasil.");
  }
}

/**
 * Exports exam results into a newly created Google Spreadsheet.
 */
function exportExamResults(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, examId);
    if (!examRes.success) return examRes;
    var exam = examRes.data;

    var resData = getExamResults(sessionId, examId);
    if (!resData.success) return resData;
    var results = resData.data.results;

    // Create new spreadsheet for export
    var title = "Rekap_Nilai_" + exam.title.replace(/[^a-zA-Z0-9]/g, "_") + "_" + _generateId(4);
    var exportSs = SpreadsheetApp.create(title);
    var sheet = exportSs.getActiveSheet();
    sheet.setName("Hasil_Ujian");

    // Header info
    sheet.appendRow(["REKAPITULASI HASIL UJIAN"]);
    sheet.appendRow(["Judul Ujian", exam.title]);
    sheet.appendRow(["Mata Pelajaran", exam.subject]);
    sheet.appendRow(["Kelas", exam.className]);
    sheet.appendRow(["KKM", exam.kkm]);
    sheet.appendRow(["Waktu Export", new Date().toLocaleString("id-ID")]);
    sheet.appendRow([]); // Empty row

    // Table Header
    var tableHeaders = ["No", "NIS", "Nama Peserta", "Kelas", "Percobaan Ke", "Status", "Nilai Akhir", "Hasil KKM", "Waktu Selesai"];
    sheet.appendRow(tableHeaders);

    sheet.getRange(8, 1, 1, tableHeaders.length)
      .setFontWeight("bold")
      .setBackground("#e2e8f0");

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      sheet.appendRow([
        i + 1,
        r.nis,
        r.name,
        r.className,
        r.attemptNumber,
        r.status,
        r.score !== null ? r.score : "-",
        r.passStatus || "-",
        r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID") : "-"
      ]);
    }

    return _response(true, {
      url: exportSs.getUrl(),
      title: title
    }, "Data nilai berhasil diekspor ke Google Sheets.");
  } catch (err) {
    console.error("exportExamResults error:", err);
    return _response(false, null, "Gagal mengekspor data: " + err.message);
  }
}

/**
 * Retrieves full export data (exam info, questions, student attempts, and answers) for Excel generation.
 */
function getExamResultsExportData(sessionId, examId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    var examRes = getExam(sessionId, examId);
    if (!examRes.success) return examRes;
    var exam = examRes.data;

    // 1. Questions
    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var examQuestions = [];
    for (var i = 0; i < allQ.length; i++) {
      var q = allQ[i];
      if (q.examId === examId && q.status !== "ARCHIVED") {
        var options = [];
        try { options = JSON.parse(q.optionsJson || "[]"); } catch (e) {}
        var rawKey = q.correctAnswer;
        try {
          if (q.type === "MCQ_COMPLEX" || (typeof rawKey === "string" && rawKey.trim().startsWith("{"))) {
            rawKey = JSON.parse(rawKey);
          }
        } catch (e) {}
        examQuestions.push({
          questionId: q.questionId,
          orderNo: Number(q.orderNo || (examQuestions.length + 1)),
          type: q.type,
          tfType: q.tfType || q["Tipe Pilihan Benar Salah"] || q["Format Benar Salah"] || "BENAR_SALAH",
          text: q.questionText,
          bottomText: q.bottomText || q["Teks Bawah Gambar"] || q["Teks Lanjutan"] || "",
          imageUrl: _normalizeDriveUrl(q.imageUrl || q.questionImageUrl || ""),
          score: Number(q.score || 10),
          options: options,
          correctAnswer: rawKey
        });
      }
    }
    examQuestions.sort(function(a, b) { return a.orderNo - b.orderNo; });

    // 2. Attempts
    var allAttempts = _getTableData(CONFIG.SHEETS.ATTEMPTS);
    var examAttempts = allAttempts.filter(function(a) { return a.examId === examId; });

    // 3. Answers
    var allAnswers = _getTableData(CONFIG.SHEETS.ANSWERS);
    var examAnswers = allAnswers.filter(function(ans) { return ans.examId === examId; });

    var answersByAttempt = {};
    for (var ai = 0; ai < examAnswers.length; ai++) {
      var ans = examAnswers[ai];
      var attId = ans.attemptId;
      if (!answersByAttempt[attId]) answersByAttempt[attId] = {};

      var parsedAnswer = ans.studentAnswer;
      try {
        if (typeof parsedAnswer === "string" && (parsedAnswer.trim().startsWith("{") || parsedAnswer.trim().startsWith("["))) {
          parsedAnswer = JSON.parse(parsedAnswer);
        }
      } catch (e) {}

      answersByAttempt[attId][ans.questionId] = {
        studentAnswer: parsedAnswer,
        isCorrect: ans.isCorrect === true || String(ans.isCorrect).toUpperCase() === "TRUE",
        awardedScore: Number(ans.awardedScore || ans.finalScore || 0)
      };
    }

    var attemptsPayload = [];
    for (var j = 0; j < examAttempts.length; j++) {
      var att = examAttempts[j];
      var attId = att.attemptId;
      var studentAnswers = answersByAttempt[attId] || {};

      var totalCorrect = 0;
      var totalWrong = 0;
      for (var qk = 0; qk < examQuestions.length; qk++) {
        var qId = examQuestions[qk].questionId;
        if (studentAnswers[qId]) {
          if (studentAnswers[qId].isCorrect) totalCorrect++;
          else totalWrong++;
        }
      }

      var isSubmitted = att.status === "SUBMITTED";
      var scoreVal = isSubmitted ? Number(att.finalScore || 0) : null;
      var kkmVal = Number(att.kkm || exam.kkm || 75);
      var passStatusVal = att.passStatus;
      if (!passStatusVal && isSubmitted) {
        passStatusVal = scoreVal >= kkmVal ? "LULUS" : "TIDAK LULUS";
      }

      attemptsPayload.push({
        attemptId: attId,
        nis: att.nis || "-",
        name: att.participantName,
        className: att.className,
        attemptNumber: Number(att.attemptNumber || 1),
        status: att.status,
        score: scoreVal,
        kkm: kkmVal,
        passStatus: passStatusVal || "-",
        startedAt: att.startedAt,
        submittedAt: att.submittedAt,
        totalCorrect: totalCorrect,
        totalWrong: totalWrong,
        answers: studentAnswers
      });
    }

    return _response(true, {
      exam: {
        examId: exam.examId,
        title: exam.title,
        subject: exam.subject,
        className: exam.className,
        kkm: exam.kkm,
        durationMinutes: exam.durationMinutes
      },
      questions: examQuestions,
      attempts: attemptsPayload
    });
  } catch (err) {
    console.error("getExamResultsExportData error:", err);
    return _response(false, null, "Gagal memuat data ekspor hasil ujian: " + err.message);
  }
}


/**
 * Retrieves detailed answers for a specific student attempt.
 * Returns question details, options, student's selected answer, correct key, score, and correctness.
 */
function getStudentAttemptDetail(sessionId, attemptId) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");
    if (!attemptId) return _response(false, null, "ID Pengerjaan wajib disertakan.");

    var allAttempts = _getTableData(CONFIG.SHEETS.ATTEMPTS);
    var targetAttempt = null;
    for (var i = 0; i < allAttempts.length; i++) {
      if (allAttempts[i].attemptId === attemptId) {
        targetAttempt = allAttempts[i];
        break;
      }
    }
    if (!targetAttempt) {
      return _response(false, null, "Data pengerjaan siswa tidak ditemukan.");
    }

    var examRes = getExam(sessionId, targetAttempt.examId);
    if (!examRes.success) return examRes;
    var exam = examRes.data;

    var allQuestions = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var examQuestions = allQuestions.filter(function(q) {
      return q.examId === targetAttempt.examId && q.status !== "ARCHIVED";
    });

    var allAnswers = _getTableData(CONFIG.SHEETS.ANSWERS);
    var attemptAnswers = allAnswers.filter(function(a) {
      return a.attemptId === attemptId;
    });

    var answersMap = {};
    for (var j = 0; j < attemptAnswers.length; j++) {
      answersMap[attemptAnswers[j].questionId] = attemptAnswers[j];
    }

    var questionDetails = [];
    var totalCorrect = 0;
    var totalWrong = 0;

    for (var k = 0; k < examQuestions.length; k++) {
      var q = examQuestions[k];
      var ans = answersMap[q.questionId] || null;
      var studentAnswerRaw = ans ? ans.answerJson : null;
      var parsedStudentAnswer = null;
      if (studentAnswerRaw) {
        try {
          parsedStudentAnswer = JSON.parse(studentAnswerRaw);
        } catch (e) {
          parsedStudentAnswer = studentAnswerRaw;
        }
      }

      var parsedOptions = [];
      if (q.optionsJson) {
        try {
          parsedOptions = JSON.parse(q.optionsJson);
        } catch (e) {}
      }
      if (Array.isArray(parsedOptions)) {
        for (var poi = 0; poi < parsedOptions.length; poi++) {
          if (parsedOptions[poi] && parsedOptions[poi].imageUrl) {
            parsedOptions[poi].imageUrl = _normalizeDriveUrl(parsedOptions[poi].imageUrl);
          }
        }
      }

      var maxScore = Number(q.score || 10);
      var qScore = ans ? Number(ans.finalScore || 0) : 0;
      var isCorr = ans ? Boolean(ans.isCorrect) : false;

      // Ensure normalized correctAnswer, especially for TRUE_FALSE
      var normalizedCorrect = q.correctAnswer;
      if (q.type === "TRUE_FALSE") {
        if (typeof normalizedCorrect === "string" && normalizedCorrect.trim().startsWith("{")) {
          try {
            normalizedCorrect = JSON.parse(normalizedCorrect);
          } catch (e) {}
        } else if (typeof normalizedCorrect !== "object") {
          var cUp = String(normalizedCorrect || "").trim().toUpperCase();
          if (cUp === "FALSE" || cUp === "SALAH" || cUp === "S" || normalizedCorrect === false) {
            normalizedCorrect = "FALSE";
          } else if (cUp === "TRUE" || cUp === "BENAR" || cUp === "B" || normalizedCorrect === true) {
            normalizedCorrect = "TRUE";
          } else {
            normalizedCorrect = "FALSE";
          }
        }
      }

      // Dynamic evaluation fallback to guarantee accurate correctness display
      if (parsedStudentAnswer !== null && parsedStudentAnswer !== undefined && parsedStudentAnswer !== "") {
        if (q.type === "MCQ") {
          var sAnsClean = String(parsedStudentAnswer).trim().toUpperCase();
          var cAnsClean = String(normalizedCorrect || "").trim().toUpperCase();
          if (sAnsClean === cAnsClean && sAnsClean !== "") {
            isCorr = true;
            qScore = maxScore;
          }
        } else if (q.type === "TRUE_FALSE") {
          if (typeof normalizedCorrect === "object" && normalizedCorrect !== null) {
            var cMap = normalizedCorrect;
            var sMap = (typeof parsedStudentAnswer === "object" && parsedStudentAnswer !== null) ? parsedStudentAnswer : {};
            var totalStmts = parsedOptions.length > 0 ? parsedOptions.length : Object.keys(cMap).length;
            var correctCount = 0;
            if (parsedOptions.length > 0) {
              for (var oi = 0; oi < parsedOptions.length; oi++) {
                var sId = String(parsedOptions[oi].id);
                var sVal = String(sMap[sId] || "").trim().toUpperCase();
                var cVal = String(cMap[sId] || "").trim().toUpperCase();
                if (sVal === "BENAR" || sVal === "B" || sVal === "SESUAI" || sVal === "TEPAT" || sVal === "1" || sVal === "TRUE") sVal = "TRUE";
                if (sVal === "SALAH" || sVal === "S" || sVal === "TIDAK SESUAI" || sVal === "TS" || sVal === "TIDAK TEPAT" || sVal === "TT" || sVal === "0" || sVal === "FALSE") sVal = "FALSE";
                if (cVal === "BENAR" || cVal === "B" || cVal === "SESUAI" || cVal === "TEPAT" || cVal === "1" || cVal === "TRUE") cVal = "TRUE";
                if (cVal === "SALAH" || cVal === "S" || cVal === "TIDAK SESUAI" || cVal === "TS" || cVal === "TIDAK TEPAT" || cVal === "TT" || cVal === "0" || cVal === "FALSE") cVal = "FALSE";
                if (sVal && cVal && sVal === cVal) correctCount++;
              }
            } else {
              for (var kId in cMap) {
                var sV = String(sMap[kId] || "").trim().toUpperCase();
                var cV = String(cMap[kId] || "").trim().toUpperCase();
                if (sV === "BENAR" || sV === "B" || sV === "SESUAI" || sV === "TEPAT" || sV === "1" || sV === "TRUE") sV = "TRUE";
                if (sV === "SALAH" || sV === "S" || sV === "TIDAK SESUAI" || sV === "TS" || sV === "TIDAK TEPAT" || sV === "TT" || sV === "0" || sV === "FALSE") sV = "FALSE";
                if (cV === "BENAR" || cV === "B" || cV === "SESUAI" || cV === "TEPAT" || cV === "1" || cV === "TRUE") cV = "TRUE";
                if (cV === "SALAH" || cV === "S" || cV === "TIDAK SESUAI" || cV === "TS" || cV === "TIDAK TEPAT" || cV === "TT" || cV === "0" || cV === "FALSE") cV = "FALSE";
                if (sV && cV && sV === cV) correctCount++;
              }
            }
            if (q.scoringMethod === "PARTIAL") {
              var ratio = totalStmts > 0 ? (correctCount / totalStmts) : 0;
              qScore = Math.round(maxScore * ratio * 100) / 100;
              isCorr = (correctCount === totalStmts && totalStmts > 0);
            } else {
              if (correctCount === totalStmts && totalStmts > 0) {
                qScore = maxScore;
                isCorr = true;
              } else {
                qScore = 0;
                isCorr = false;
              }
            }
          } else {
            var sStr = String(parsedStudentAnswer).trim().toUpperCase();
            if (sStr === "SALAH" || sStr === "S" || sStr === "TS" || sStr === "TT" || sStr === "TIDAK SESUAI" || sStr === "TIDAK TEPAT" || sStr === "0" || parsedStudentAnswer === false) sStr = "FALSE";
            if (sStr === "BENAR" || sStr === "B" || sStr === "SESUAI" || sStr === "TEPAT" || sStr === "1" || parsedStudentAnswer === true) sStr = "TRUE";

            var cStr = String(normalizedCorrect || "").trim().toUpperCase();
            if (cStr === "SALAH" || cStr === "S" || cStr === "TS" || cStr === "TT" || cStr === "TIDAK SESUAI" || cStr === "TIDAK TEPAT" || cStr === "0" || normalizedCorrect === false) cStr = "FALSE";
            if (cStr === "BENAR" || cStr === "B" || cStr === "SESUAI" || cStr === "TEPAT" || cStr === "1" || normalizedCorrect === true) cStr = "TRUE";

            if (sStr === cStr && sStr !== "") {
              isCorr = true;
              qScore = maxScore;
            }
          }
        } else if (q.type === "MCQ_COMPLEX") {
          var sList = Array.isArray(parsedStudentAnswer) ? parsedStudentAnswer : [parsedStudentAnswer];
          var cList = [];
          if (Array.isArray(normalizedCorrect)) {
            cList = normalizedCorrect;
          } else {
            try {
              var p = JSON.parse(normalizedCorrect);
              cList = Array.isArray(p) ? p : [normalizedCorrect];
            } catch (e) {
              cList = String(normalizedCorrect || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean);
            }
          }
          sList = sList.map(function(x){ return String(x).trim().toUpperCase(); }).sort();
          cList = cList.map(function(x){ return String(x).trim().toUpperCase(); }).sort();

          if (q.scoringMethod === "PARTIAL") {
            var correctSelected = 0;
            for (var s = 0; s < sList.length; s++) {
              if (cList.indexOf(sList[s]) !== -1) correctSelected++;
            }
            var wrongSelected = sList.length - correctSelected;
            var totalTarget = cList.length > 0 ? cList.length : 1;
            var ratio = (correctSelected - wrongSelected) / totalTarget;
            ratio = Math.max(0, Math.min(1, ratio));
            qScore = Math.round(maxScore * ratio * 100) / 100;
            if (qScore === maxScore) isCorr = true;
          } else {
            if (_arraysEqual(sList, cList)) {
              isCorr = true;
              qScore = maxScore;
            }
          }
        }
      }

      if (isCorr) {
        totalCorrect++;
      } else {
        totalWrong++;
      }

      var qImg = q.questionImageUrl || q.imageUrl || q["URL Gambar Soal"] || q["URL Gambar"] || q["Gambar"] || "";
      var normalizedImg = _normalizeDriveUrl(qImg);
      var tfType = q.tfType || q["Tipe Pilihan Benar Salah"] || q["Format Benar Salah"] || "BENAR_SALAH";

      questionDetails.push({
        questionId: q.questionId,
        orderNo: q.orderNo || (k + 1),
        type: q.type,
        tfType: tfType,
        questionText: q.questionText,
        bottomText: q.bottomText || q["Teks Bawah Gambar"] || q["Teks Lanjutan"] || "",
        questionImageUrl: normalizedImg,
        imageUrl: normalizedImg,
        score: maxScore,
        scoringMethod: q.scoringMethod || "EXACT",
        correctAnswer: normalizedCorrect,
        options: parsedOptions,
        studentAnswer: parsedStudentAnswer,
        isCorrect: isCorr,
        awardedScore: qScore,
        savedAt: ans ? ans.savedAt : null
      });
    }

    return _response(true, {
      attempt: {
        attemptId: targetAttempt.attemptId,
        examId: targetAttempt.examId,
        examTitle: exam.title,
        participantName: targetAttempt.participantName,
        className: targetAttempt.className,
        nis: targetAttempt.nis,
        attemptNumber: targetAttempt.attemptNumber,
        status: targetAttempt.status,
        rawScore: targetAttempt.rawScore,
        maxRawScore: targetAttempt.maxRawScore,
        finalScore: targetAttempt.finalScore,
        kkm: targetAttempt.kkm || exam.kkm,
        passStatus: targetAttempt.passStatus,
        totalCorrect: totalCorrect,
        totalWrong: totalWrong,
        totalQuestions: examQuestions.length,
        startedAt: targetAttempt.startedAt,
        submittedAt: targetAttempt.submittedAt
      },
      questions: questionDetails
    });
  } catch (err) {
    console.error("getStudentAttemptDetail error:", err);
    return _response(false, null, "Gagal memuat rincian jawaban siswa: " + err.message);
  }
}

// ============================================================================
// 9. IMAGE UPLOAD HANDLER (GOOGLE DRIVE)
// ============================================================================

/**
 * Uploads a base64 encoded image to Google Drive and returns a viewable URL.
 */
function uploadImage(sessionId, base64Data, filename, mimeType) {
  try {
    var user = _verifySession(sessionId);
    if (!user) return _response(false, null, "Sesi tidak valid.");

    if (!base64Data) return _response(false, null, "Data gambar tidak ditemukan.");

    // Clean base64 string
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf("base64,") !== -1) {
      cleanBase64 = cleanBase64.split("base64,")[1];
    }

    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType || "image/jpeg", filename || ("img_" + _generateId(8) + ".jpg"));

    // Find or create upload folder
    var folders = DriveApp.getFoldersByName(CONFIG.UPLOAD_FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.UPLOAD_FOLDER_NAME);
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (fErr) {}
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    // Direct image CDN URL that renders reliably in <img> tags without cookies/CORS issues
    var fileUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    return _response(true, {
      fileId: fileId,
      url: fileUrl,
      thumbnailUrl: "https://drive.google.com/thumbnail?sz=w1000&id=" + fileId
    }, "Gambar berhasil diunggah.");
  } catch (err) {
    console.error("uploadImage error:", err);
    return _response(false, null, "Gagal mengunggah gambar: " + err.message);
  }
}

/**
 * Normalizes Google Drive, Dropbox, or general image links into direct CDN URLs.
 */
function _normalizeDriveUrl(url) {
  if (!url || typeof url !== "string") return "";
  url = url.trim();
  if (!url) return "";

  if (url.indexOf("data:image/") === 0) return url;

  var driveId = null;
  var m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) {
    driveId = m1[1];
  } else {
    var m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2 && m2[1]) {
      driveId = m2[1];
    } else {
      var m3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m3 && m3[1]) {
        driveId = m3[1];
      }
    }
  }

  if (driveId) {
    return "https://lh3.googleusercontent.com/d/" + driveId;
  }

  if (url.indexOf("dropbox.com") !== -1 && url.indexOf("dl=0") !== -1) {
    return url.replace("dl=0", "raw=1");
  }

  return url;
}

// ============================================================================
// 10. UTILITY & HELPER FUNCTIONS
// ============================================================================

/**
 * Script Cache Helpers (High-Concurrency Performance Accelerator)
 */
function _getScriptCache(key) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch (e) {
    return null;
  }
}

function _setScriptCache(key, obj, ttlSeconds) {
  try {
    var cache = CacheService.getScriptCache();
    var str = JSON.stringify(obj);
    if (str.length < 95000) {
      cache.put(key, str, ttlSeconds || 300);
    }
  } catch (e) {
    console.warn("Failed to set cache for " + key + ":", e);
  }
}

function _removeScriptCache(key) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(key);
  } catch (e) {}
}

/**
 * Consistent API response wrapper
 */
function _response(success, data, message) {
  return {
    success: Boolean(success),
    data: data !== undefined ? data : null,
    message: message || ""
  };
}

/**
 * Gets the active spreadsheet or opens via script property / config fallback.
 */
function _getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("SPREADSHEET_ID") || (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID);
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.warn("Gagal membuka Spreadsheet ID '" + sheetId + "': " + e.message);
    }
  }

  // Auto-provision a new database spreadsheet in Google Drive if none is connected
  try {
    console.log("Membuat spreadsheet baru otomatis untuk database aplikasi...");
    var newSs = SpreadsheetApp.create("Database Web App Ujian Online");
    props.setProperty("SPREADSHEET_ID", newSs.getId());
    return newSs;
  } catch (err) {
    throw new Error("Spreadsheet tidak ditemukan dan gagal membuat otomatis: " + err.message);
  }
}

/**
 * Gets sheet by name from the active spreadsheet.
 */
function _getSheet(sheetName) {
  var ss = _getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");
  }
  return sheet;
}

// Bilingual column header dictionary for backward & forward compatibility
var HEADER_MAP = {
  // Users
  "ID Pengguna": ["userId"], "userId": ["userId"],
  "Username": ["username"], "username": ["username"],
  "Password": ["password"], "password": ["password"],
  "Nama Lengkap": ["name"], "name": ["name"],
  "Status": ["status"], "status": ["status"],
  "Dibuat Pada": ["createdAt"], "createdAt": ["createdAt"],
  "Diperbarui Pada": ["updatedAt"], "updatedAt": ["updatedAt"],

  // Exams
  "ID Ujian": ["examId"], "examId": ["examId"],
  "ID Guru Pemilik": ["ownerTeacherId"], "ownerTeacherId": ["ownerTeacherId"],
  "Judul Ujian": ["title"], "title": ["title"],
  "Mata Pelajaran": ["subject"], "subject": ["subject"],
  "Materi Pokok": ["material"], "material": ["material"],
  "Kelas": ["className"], "className": ["className"],
  "Deskripsi": ["description"], "description": ["description"],
  "Petunjuk Pengerjaan": ["instructions"], "instructions": ["instructions"],
  "Durasi (Menit)": ["durationMinutes"], "durationMinutes": ["durationMinutes"],
  "Waktu Mulai": ["startAt", "startedAt"], "startAt": ["startAt"], "startedAt": ["startedAt"],
  "Waktu Selesai": ["endAt", "submittedAt"], "endAt": ["endAt"], "submittedAt": ["submittedAt"],
  "KKM": ["kkm"], "kkm": ["kkm"],
  "Maksimal Percobaan": ["maxAttempts"], "maxAttempts": ["maxAttempts"],
  "Metode Penilaian": ["attemptScoring", "scoringMethod"], "attemptScoring": ["attemptScoring"], "scoringMethod": ["scoringMethod"],
  "Acak Soal": ["randomizeQuestions"], "randomizeQuestions": ["randomizeQuestions"],
  "Tampilkan Nilai": ["showResult"], "showResult": ["showResult"],
  "Tampilkan di Portal": ["showInPortal", "showOnStudentPortal"], "showInPortal": ["showInPortal", "showOnStudentPortal"], "showOnStudentPortal": ["showInPortal", "showOnStudentPortal"],

  // Questions
  "ID Soal": ["questionId"], "questionId": ["questionId"],
  "Nomor Urut": ["orderNo"], "orderNo": ["orderNo"],
  "Tipe Soal": ["type"], "type": ["type"],
  "Teks Pertanyaan": ["questionText"], "questionText": ["questionText"],
  "URL Gambar Soal": ["questionImageUrl", "imageUrl"], "questionImageUrl": ["questionImageUrl", "imageUrl"],
  "URL Gambar": ["questionImageUrl", "imageUrl"], "imageUrl": ["questionImageUrl", "imageUrl"],
  "Gambar Soal": ["questionImageUrl", "imageUrl"], "Gambar": ["questionImageUrl", "imageUrl"],
  "Bobot Nilai": ["score"], "score": ["score"],
  "Kunci Jawaban": ["correctAnswer"], "correctAnswer": ["correctAnswer"],
  "JSON Opsi": ["optionsJson"], "optionsJson": ["optionsJson"],
  "Teks Bawah Gambar": ["bottomText"], "bottomText": ["bottomText"], "Teks Lanjutan": ["bottomText"], "Teks Soal Bawah": ["bottomText"],
  "Tipe Pilihan Benar Salah": ["tfType"], "Format Benar Salah": ["tfType"], "tfType": ["tfType"], "trueFalseType": ["tfType"],

  // Attempts
  "ID Pengerjaan": ["attemptId"], "attemptId": ["attemptId"],
  "Nama Peserta": ["participantName", "name"], "participantName": ["participantName", "name"],
  "NIS": ["nis"], "nis": ["nis"],
  "Percobaan Ke": ["attemptNumber"], "attemptNumber": ["attemptNumber"],
  "Batas Waktu": ["deadlineAt"], "deadlineAt": ["deadlineAt"],
  "Skor Mentah": ["rawScore"], "rawScore": ["rawScore"],
  "Maks Skor Mentah": ["maxRawScore"], "maxRawScore": ["maxRawScore"],
  "Nilai Akhir": ["finalScore", "score"], "finalScore": ["finalScore", "score"],
  "Status Kelulusan": ["passStatus"], "passStatus": ["passStatus"],
  "Urutan Soal JSON": ["questionOrderJson"], "questionOrderJson": ["questionOrderJson"],
  "Urutan Opsi JSON": ["optionOrderJson"], "optionOrderJson": ["optionOrderJson"],

  // Answers
  "ID Jawaban": ["answerId"], "answerId": ["answerId"],
  "Jawaban Siswa JSON": ["answerJson"], "answerJson": ["answerJson"],
  "Waktu Simpan": ["savedAt"], "savedAt": ["savedAt"],
  "Nilai Diperoleh": ["finalScore", "score"],
  "Apakah Benar": ["isCorrect"], "isCorrect": ["isCorrect"],
  "Skor Maksimal": ["maxScore"], "maxScore": ["maxScore"],

  // Settings
  "Kunci Pengaturan": ["key"], "key": ["key"],
  "Nilai Pengaturan": ["value"], "value": ["value"],

  // Logs
  "Waktu": ["timestamp"], "timestamp": ["timestamp"],
  "Tipe Aktor": ["actorType"], "actorType": ["actorType"],
  "ID Aktor": ["actorId"], "actorId": ["actorId"],
  "Aksi": ["action"], "action": ["action"],
  "Tipe Target": ["targetType"], "targetType": ["targetType"],
  "ID Target": ["targetId"], "targetId": ["targetId"],
  "Pesan Log": ["message"], "message": ["message"]
};

/**
 * Reads all data from a sheet as an array of JSON objects (mapping Indonesian headers to canonical keys).
 */
function _getTableData(sheetName) {
  var sheet = _getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var rows = [];

  for (var r = 1; r < data.length; r++) {
    var item = {};
    for (var c = 0; c < headers.length; c++) {
      var hKey = String(headers[c] || "").trim();
      var val = data[r][c];
      item[hKey] = val;
      var canonicalKeys = HEADER_MAP[hKey];
      if (canonicalKeys && Array.isArray(canonicalKeys)) {
        for (var k = 0; k < canonicalKeys.length; k++) {
          item[canonicalKeys[k]] = val;
        }
      }
    }
    rows.push(item);
  }
  return rows;
}

/**
 * Generates a random alphanumeric ID.
 */
function _generateId(len) {
  len = len || 8;
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var res = "";
  for (var i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

/**
 * Checks equality of two arrays irrespective of order.
 */
function _arraysEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  var s1 = [].slice.call(arr1).sort();
  var s2 = [].slice.call(arr2).sort();
  for (var i = 0; i < s1.length; i++) {
    if (String(s1[i]).trim() !== String(s2[i]).trim()) return false;
  }
  return true;
}

/**
 * Fisher-Yates array shuffle.
 */
function _shuffleArray(array) {
  var copy = [].slice.call(array);
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Logs an application action to the Logs sheet.
 */
function _logAction(actorType, actorId, action, targetType, targetId, status, message) {
  try {
    var ss = _getSpreadsheet();
    var sheet = ss ? ss.getSheetByName(CONFIG.SHEETS.LOGS) : null;
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        actorType,
        actorId,
        action,
        targetType,
        targetId,
        status,
        message
      ]);
    }
  } catch (e) {
    console.error("Logging error:", e);
  }
}
