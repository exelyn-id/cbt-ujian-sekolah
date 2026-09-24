// ============================================================================
// API Endpoint: /api/exams (Public Exams & Student Taking Gateway - 100% Vercel DB)
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
        if (req.method === 'GET') {
            const { id } = req.query;

            // Scenario A: Get single exam with sanitized questions for taking test
            if (id) {
                const exam = await db.getPublicExam(id);
                if (!exam) {
                    return res.status(404).json({
                        success: false,
                        message: 'Ujian tidak ditemukan atau link sudah kadaluarsa.'
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: exam
                });
            }

            // Scenario B: Get list of active public exams for student portal
            const activeList = await db.getActivePublicExams();
            return res.status(200).json({
                success: true,
                data: activeList
            });
        }

        if (req.method === 'POST') {
            const { action, examId, participantData } = req.body || {};

            if (action === 'start_attempt' || examId) {
                const targetExamId = examId || (req.body && req.body.examId);
                const exam = await db.getPublicExam(targetExamId);
                if (!exam) {
                    return res.status(404).json({
                        success: false,
                        message: 'Ujian tidak ditemukan atau link sudah kadaluarsa.'
                    });
                }

                const attemptId = 'ATT_' + Date.now().toString(36).toUpperCase() + '_' + Math.floor(Math.random() * 9000 + 1000);
                const deadlineAt = Date.now() + (Number(exam.durationMinutes || 60) * 60 * 1000);
                const nowIso = new Date().toISOString();

                // Persist initial IN_PROGRESS attempt record in Redis
                const p = participantData || (req.body && req.body.participant) || {};
                const initialRecord = {
                    attemptId,
                    examId: targetExamId,
                    participantName: p.name || p.participantName || 'Siswa',
                    className: p.className || 'Umum',
                    nis: p.nis || '',
                    attemptNumber: 1,
                    startedAt: nowIso,
                    status: 'IN_PROGRESS',
                    score: null,
                    kkm: exam.kkm || 75
                };
                const { kv } = require('./_redis');
                await kv.set(`attempt:record:${attemptId}`, initialRecord, { ex: 86400 * 30 });

                // Index attemptId in exam:attempts:${examId}
                try {
                    const examAttemptsKey = `exam:attempts:${targetExamId}`;
                    const currentList = (await kv.lrange(examAttemptsKey, 0, -1)) || [];
                    if (!currentList.includes(attemptId)) {
                        await kv.rpush(examAttemptsKey, attemptId);
                    }
                } catch (indexErr) {
                    console.error('Failed to index attempt in Redis:', indexErr);
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        attemptId: attemptId,
                        deadlineAt: deadlineAt,
                        participantName: p.name || p.participantName || 'Siswa',
                        className: p.className || 'Umum',
                        nis: p.nis || '',
                        questions: exam.questions || []
                    }
                });
            }
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (err) {
        console.error('API /api/exams error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server: ' + err.message
        });
    }
};
