// ============================================================================
// API Endpoint: /api/teacher (Teacher & Admin Operations - 100% Vercel DB)
// ============================================================================
const db = require('./_db');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const action = req.query.action || (req.body && req.body.action);
        const payload = req.body || req.query || {};

        if (!action) {
            return res.status(400).json({ success: false, message: 'Action parameter is required' });
        }

        // 1. Auth: Login
        if (action === 'login_teacher') {
            const { username, password } = payload;
            const authRes = await db.authenticateUser(username, password);
            return res.status(200).json(authRes);
        }

        // 2. Auth: Logout
        if (action === 'logout_teacher') {
            const { sessionId } = payload;
            await db.destroySession(sessionId);
            return res.status(200).json({ success: true, message: 'Berhasil keluar' });
        }

        // Verify session for all authenticated actions
        const sessionId = payload.sessionId || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);
        const session = sessionId ? await db.verifySession(sessionId) : null;

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Sesi Anda telah berakhir atau tidak valid. Silakan login kembali.'
            });
        }

        // 3. Exams List (Admin sees all, Teachers see only their own)
        if (action === 'get_teacher_exams') {
            const exams = await db.getTeacherExams(session.teacherId, session.role, session.username);
            return res.status(200).json({ success: true, data: exams });
        }

        // 4. Single Exam Meta
        if (action === 'get_exam') {
            const exam = await db.getExam(payload.examId);
            if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
            if (!db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Ujian ini bukan milik Anda.' });
            }
            return res.status(200).json({ success: true, data: exam });
        }

        // 5. Save Exam Meta
        if (action === 'save_exam') {
            const saveRes = await db.saveExam(payload.examData || payload, session);
            return res.status(saveRes.success ? 200 : 403).json(saveRes);
        }

        // 6. Toggle Portal Visibility
        if (action === 'toggle_exam_portal') {
            const toggleRes = await db.toggleExamPortal(payload.examId, payload.showInPortal, session);
            return res.status(toggleRes.success ? 200 : 403).json(toggleRes);
        }

        // 7. Delete Exam
        if (action === 'delete_exam') {
            const delRes = await db.deleteExam(payload.examId, session);
            return res.status(delRes.success ? 200 : 403).json(delRes);
        }

        // 8. Duplicate Exam
        if (action === 'duplicate_exam') {
            const dupRes = await db.duplicateExam(payload.examId || payload.sourceExamId, session);
            return res.status(dupRes.success ? 200 : 403).json(dupRes);
        }

        // 9. Questions: Get
        if (action === 'get_questions') {
            const exam = await db.getExam(payload.examId);
            if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
            if (!db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Soal ini bukan milik Anda.' });
            }
            const questions = await db.getQuestions(payload.examId);
            return res.status(200).json({ success: true, data: questions });
        }

        // 10. Questions: Save
        if (action === 'save_questions') {
            const exam = await db.getExam(payload.examId);
            if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
            if (!db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak mengubah soal ujian milik guru lain.' });
            }
            const saveQRes = await db.saveQuestions(payload.examId, payload.questionsList || payload.questions || []);
            return res.status(200).json(saveQRes);
        }

        // 11. Results: Live Exam Results
        if (action === 'get_exam_results') {
            const exam = await db.getExam(payload.examId);
            if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
            if (!db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak melihat hasil ujian milik guru lain.' });
            }
            const resultsData = await db.getExamResults(payload.examId);
            return res.status(200).json({ success: true, data: resultsData });
        }

        // 12. Results: Student Answer Sheet Detail
        if (action === 'get_student_attempt_detail') {
            const detailData = await db.getStudentAttemptDetail(payload.attemptId);
            if (!detailData) {
                return res.status(404).json({ success: false, message: 'Data pengerjaan tidak ditemukan.' });
            }
            const exam = await db.getExam(detailData.attempt?.examId);
            if (exam && !db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak melihat detail pengerjaan ujian guru lain.' });
            }
            return res.status(200).json({ success: true, data: detailData });
        }

        // 13. Results: Excel Export Generator Data
        if (action === 'get_exam_results_export_data') {
            const exam = await db.getExam(payload.examId);
            if (!exam) return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
            if (!db.isExamOwnerOrAdmin(exam, session)) {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak mengunduh data rekap ujian guru lain.' });
            }
            const exportData = await db.getExamResultsExportData(payload.examId);
            return res.status(200).json({ success: true, data: exportData });
        }

        // 14. User Management (Admin Only)
        if (action === 'get_users') {
            if (session.role !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
            }
            const users = await db.listUsers();
            return res.status(200).json({ success: true, data: users });
        }
        if (action === 'save_user') {
            if (session.role !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
            }
            const userRes = await db.saveUser(payload.userData || payload);
            return res.status(200).json(userRes);
        }
        if (action === 'delete_user') {
            if (session.role !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
            }
            const delUserRes = await db.deleteUser(payload.username);
            return res.status(200).json(delUserRes);
        }

        return res.status(400).json({ success: false, message: 'Aksi tidak dikenali: ' + action });
    } catch (err) {
        console.error('API /api/teacher error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server guru: ' + err.message
        });
    }
};
