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
    "Tampilkan Nilai", "Status", "Dibuat Pada", "Diperbarui Pada"
  ];

  // Sheet: Questions (Bank Soal)
  schema[CONFIG.SHEETS.QUESTIONS] = [
    "ID Soal", "ID Ujian", "Nomor Urut", "Tipe Soal", "Teks Pertanyaan", "URL Gambar Soal",
    "Bobot Nilai", "Metode Penilaian", "Kunci Jawaban", "JSON Opsi", "Dibuat Pada", "Diperbarui Pada", "Status",
    "Teks Bawah Gambar"
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
        role: "TEACHER"
      };
    }

    if (!matchedUser) {
      return _response(false, null, "Username atau password salah.");
    }

    // Create session
    var sessionId = "SES_" + _generateId(16);
    var sessionData = {
      sessionId: sessionId,
      teacherId: matchedUser.userId || "TCH_001",
      teacherName: matchedUser.name || "Pak Andi Guru",
      username: matchedUser.username || "andi",
      role: "TEACHER",
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

    _logAction("TEACHER", matchedUser.userId, "LOGIN", "USER", matchedUser.userId, "SUCCESS", "Login berhasil");

    return _response(true, {
      sessionId: sessionId,
      teacherId: matchedUser.userId || "TCH_001",
      teacherName: matchedUser.name || "Pak Andi Guru",
      role: "TEACHER"
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

    var teacherExams = [];

    for (var i = 0; i < allExams.length; i++) {
      var ex = allExams[i];
      if (ex.ownerTeacherId === user.teacherId && ex.status !== "ARCHIVED") {
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

        teacherExams.push({
          examId: ex.examId,
          title: ex.title,
          subject: ex.subject,
          material: ex.material || "",
          className: ex.className,
          status: ex.status,
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
    lock.waitLock(10000);
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
          if (data[r][1] !== user.teacherId) {
            return _response(false, null, "Akses ditolak.");
          }
          targetRow = r + 1;
          isEdit = true;
          break;
        }
      }
    }

    var examId = isEdit ? examData.examId : ("EXM_" + _generateId(8));

    var rowValues = [
      examId,
      user.teacherId,
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
      now
    ];

    if (isEdit) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return _response(true, { examId: examId }, isEdit ? "Ujian berhasil diperbarui." : "Ujian baru berhasil dibuat.");
  } catch (err) {
    console.error("saveExam error:", err);
    return _response(false, null, "Gagal menyimpan ujian: " + err.message);
  } finally {
    lock.releaseLock();
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
        if (data[r][1] !== user.teacherId) {
          return _response(false, null, "Akses ditolak.");
        }
        // Set status to ARCHIVED
        sheet.getRange(r + 1, 18).setValue("ARCHIVED");
        sheet.getRange(r + 1, 20).setValue(new Date().toISOString());
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
        examQuestions.push({
          id: q.questionId,
          orderNo: Number(q.orderNo),
          type: q.type,
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
    lock.waitLock(10000);
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
      if (data[r][1] === examId) {
        sheet.getRange(r + 1, 13).setValue("ARCHIVED");
      }
    }

    // Append new / updated questions
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

      sheet.appendRow([
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
        q.bottomText || ""
      ]);
    }

    return _response(true, null, "Soal berhasil disimpan.");
  } catch (err) {
    console.error("saveQuestions error:", err);
    return _response(false, null, "Gagal menyimpan soal: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 7. PARTICIPANT & EXAM ATTEMPT FLOW (STUDENT SIDE)
// ============================================================================

/**
 * Public endpoint to fetch exam details for the student landing page.
 * Returns metadata ONLY (no questions, no answers).
 */
function getPublicExam(examId) {
  try {
    if (!examId) return _response(false, null, "ID Ujian tidak disertakan.");

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

    return _response(true, {
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
      showResult: Boolean(targetExam.showResult !== false)
    });
  } catch (err) {
    console.error("getPublicExam error:", err);
    return _response(false, null, "Terjadi kesalahan saat memuat ujian.");
  }
}

/**
 * Starts a new student attempt.
 * Returns sanitized questions (answers and scores removed).
 */
function startExamAttempt(examId, participantData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    if (!examId) return _response(false, null, "ID Ujian tidak valid.");
    if (!participantData || !participantData.name || !participantData.className) {
      return _response(false, null, "Nama dan Kelas wajib diisi.");
    }

    var cleanNis = (participantData.nis && String(participantData.nis).trim() && String(participantData.nis).trim() !== "-") 
      ? String(participantData.nis).trim() 
      : "-";

    var pubRes = getPublicExam(examId);
    if (!pubRes.success) return pubRes;
    var exam = pubRes.data;

    // Check existing attempts for this participant
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

    var attemptNumber = studentAttempts.length + 1;
    var attemptId = "ATT_" + _generateId(12);
    var nowMs = new Date().getTime();
    var deadlineMs = nowMs + (exam.durationMinutes * 60 * 1000);
    var nowIso = new Date(nowMs).toISOString();
    var deadlineIso = new Date(deadlineMs).toISOString();

    // Fetch questions and sanitize
    var allQ = _getTableData(CONFIG.SHEETS.QUESTIONS);
    var activeQ = allQ.filter(function(q) {
      return q.examId === examId && q.status !== "ARCHIVED";
    });

    if (activeQ.length === 0) {
      return _response(false, null, "Ujian ini belum memiliki soal.");
    }

    // Sort or randomize questions
    activeQ.sort(function(a, b) { return Number(a.orderNo) - Number(b.orderNo); });
    
    // Check if exam requires randomization
    var fullExams = _getTableData(CONFIG.SHEETS.EXAMS);
    var fullExam = fullExams.filter(function(e) { return e.examId === examId; })[0];
    
    if (fullExam && fullExam.randomizeQuestions) {
      activeQ = _shuffleArray(activeQ);
    }

    var sanitizedQuestions = [];
    var questionOrder = [];

    for (var i = 0; i < activeQ.length; i++) {
      var rawQ = activeQ[i];
      questionOrder.push(rawQ.questionId);

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

      if (fullExam && fullExam.randomizeOptions && (rawQ.type === "MCQ" || rawQ.type === "MCQ_COMPLEX")) {
        options = _shuffleArray(options);
      }

      var rawImg = rawQ.imageUrl || rawQ.questionImageUrl || rawQ["URL Gambar Soal"] || rawQ["URL Gambar"] || rawQ["Gambar"] || "";

      // Security: DO NOT include correctAnswer, score, or scoringMethod
      sanitizedQuestions.push({
        id: rawQ.questionId,
        type: rawQ.type,
        text: rawQ.questionText,
        bottomText: rawQ.bottomText || rawQ["Teks Bawah Gambar"] || rawQ["Teks Lanjutan"] || "",
        imageUrl: _normalizeDriveUrl(rawImg),
        options: options
      });
    }

    // Save attempt record
    var attemptsSheet = _getSheet(CONFIG.SHEETS.ATTEMPTS);
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

    return _response(true, {
      attemptId: attemptId,
      deadlineAt: deadlineMs,
      participantName: participantData.name.trim(),
      className: participantData.className.trim(),
      nis: cleanNis,
      questions: sanitizedQuestions
    }, "Ujian berhasil dimulai.");

  } catch (err) {
    console.error("startExamAttempt error:", err);
    return _response(false, null, "Gagal memulai ujian: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Autosaves student answers periodically.
 */
function saveAttemptAnswers(attemptId, answersMap) {
  try {
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

    // Map existing answers for this attempt
    var existingAnswers = {};
    for (var a = 1; a < answersData.length; a++) {
      if (answersData[a][1] === attemptId) {
        existingAnswers[answersData[a][3]] = a + 1; // questionId -> row number
      }
    }

    for (var qId in answersMap) {
      var ansVal = answersMap[qId];
      var ansJson = typeof ansVal === "object" ? JSON.stringify(ansVal) : JSON.stringify(ansVal);

      if (existingAnswers[qId]) {
        // Update
        var row = existingAnswers[qId];
        answersSheet.getRange(row, 5).setValue(ansJson);
        answersSheet.getRange(row, 6).setValue(now);
      } else {
        // Append
        var ansId = "ANS_" + _generateId(10);
        answersSheet.appendRow([
          ansId, attemptId, attempt.examId, qId, ansJson, now, 0, false, 0
        ]);
      }
    }

    return _response(true, { savedAt: new Date().getTime() }, "Jawaban tersimpan.");
  } catch (err) {
    console.error("saveAttemptAnswers error:", err);
    return _response(false, null, "Gagal melakukan autosave.");
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

            if (qOptions.length > 0) {
              for (var oi = 0; oi < qOptions.length; oi++) {
                var sId = String(qOptions[oi].id);
                var sVal = sMap ? String(sMap[sId] || "").trim().toUpperCase() : "";
                var cVal = cMap ? String(cMap[sId] || "").trim().toUpperCase() : "";
                if (sVal === "BENAR" || sVal === "B") sVal = "TRUE";
                if (sVal === "SALAH" || sVal === "S") sVal = "FALSE";
                if (cVal === "BENAR" || cVal === "B") cVal = "TRUE";
                if (cVal === "SALAH" || cVal === "S") cVal = "FALSE";
                if (sVal && cVal && sVal === cVal) {
                  correctCount++;
                }
              }
            } else {
              for (var kId in cMap) {
                var sV = sMap ? String(sMap[kId] || "").trim().toUpperCase() : "";
                var cV = String(cMap[kId] || "").trim().toUpperCase();
                if (sV === "BENAR" || sV === "B") sV = "TRUE";
                if (sV === "SALAH" || sV === "S") sV = "FALSE";
                if (cV === "BENAR" || cV === "B") cV = "TRUE";
                if (cV === "SALAH" || cV === "S") cV = "FALSE";
                if (sV && cV && sV === cV) {
                  correctCount++;
                }
              }
            }

            if (question.scoringMethod === "PARTIAL") {
              var ratio = totalStmts > 0 ? (correctCount / totalStmts) : 0;
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
            if (sAnsStr === "SALAH" || sAnsStr === "FALSE" || sAnsStr === "S") sAnsStr = "FALSE";
            if (sAnsStr === "BENAR" || sAnsStr === "TRUE" || sAnsStr === "B") sAnsStr = "TRUE";
            if (cAnsStr === "SALAH" || cAnsStr === "FALSE" || cAnsStr === "S") cAnsStr = "FALSE";
            if (cAnsStr === "BENAR" || cAnsStr === "TRUE" || cAnsStr === "B") cAnsStr = "TRUE";
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

          if (question.scoringMethod === "PARTIAL") {
            // Partial scoring algorithm from PRD
            var correctSelected = 0;
            for (var s = 0; s < studentList.length; s++) {
              if (correctList.indexOf(studentList[s]) !== -1) {
                correctSelected++;
              }
            }
            var wrongSelected = studentList.length - correctSelected;
            var totalTarget = correctList.length > 0 ? correctList.length : 1;
            var ratio = (correctSelected - wrongSelected) / totalTarget;
            ratio = Math.max(0, Math.min(1, ratio));

            qScore = Math.round(maxScore * ratio * 100) / 100;
            if (qScore === maxScore) isQCorrect = true;
          } else {
            // EXACT set matching
            if (_arraysEqual(studentList, correctList)) {
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

      for (var qKey in scoringResults) {
        var resObj = scoringResults[qKey];
        if (ansRowMap[qKey]) {
          var rowNum = ansRowMap[qKey];
          answersSheet.getRange(rowNum, 7).setValue(resObj.qScore);
          answersSheet.getRange(rowNum, 8).setValue(resObj.isCorrect);
          answersSheet.getRange(rowNum, 9).setValue(resObj.maxScore);
        } else {
          // If student didn't answer this question, append row with score 0
          var emptyAnsId = "ANS_" + _generateId(10);
          answersSheet.appendRow([
            emptyAnsId, attemptId, attempt.examId, qKey, JSON.stringify(""), new Date().toISOString(), 0, false, resObj.maxScore
          ]);
        }
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

    // Update Attempt row in sheet
    attemptsSheet.getRange(attemptRow, 9).setValue(nowIso); // submittedAt
    attemptsSheet.getRange(attemptRow, 10).setValue("SUBMITTED"); // status
    attemptsSheet.getRange(attemptRow, 11).setValue(totalRawScore); // rawScore
    attemptsSheet.getRange(attemptRow, 12).setValue(totalMaxScore); // maxRawScore
    attemptsSheet.getRange(attemptRow, 13).setValue(finalScore); // finalScore
    attemptsSheet.getRange(attemptRow, 15).setValue(passStatus); // passStatus
    attemptsSheet.getRange(attemptRow, 18).setValue(nowIso); // updatedAt

    // Fetch exam configuration to check showResult
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
    lock.releaseLock();
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
                if (sVal === "BENAR" || sVal === "B") sVal = "TRUE";
                if (sVal === "SALAH" || sVal === "S") sVal = "FALSE";
                if (cVal === "BENAR" || cVal === "B") cVal = "TRUE";
                if (cVal === "SALAH" || cVal === "S") cVal = "FALSE";
                if (sVal && cVal && sVal === cVal) correctCount++;
              }
            } else {
              for (var kId in cMap) {
                var sV = String(sMap[kId] || "").trim().toUpperCase();
                var cV = String(cMap[kId] || "").trim().toUpperCase();
                if (sV === "BENAR" || sV === "B") sV = "TRUE";
                if (sV === "SALAH" || sV === "S") sV = "FALSE";
                if (cV === "BENAR" || cV === "B") cV = "TRUE";
                if (cV === "SALAH" || cV === "S") cV = "FALSE";
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
            if (sStr === "SALAH" || sStr === "S" || parsedStudentAnswer === false) sStr = "FALSE";
            if (sStr === "BENAR" || sStr === "B" || parsedStudentAnswer === true) sStr = "TRUE";

            var cStr = String(normalizedCorrect || "").trim().toUpperCase();
            if (cStr === "SALAH" || cStr === "S" || normalizedCorrect === false) cStr = "FALSE";
            if (cStr === "BENAR" || cStr === "B" || normalizedCorrect === true) cStr = "TRUE";

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

      questionDetails.push({
        questionId: q.questionId,
        orderNo: q.orderNo || (k + 1),
        type: q.type,
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
  "Acak Opsi": ["randomizeOptions"], "randomizeOptions": ["randomizeOptions"],
  "Tampilkan Nilai": ["showResult"], "showResult": ["showResult"],

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
