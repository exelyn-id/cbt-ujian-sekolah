// ============================================================================
// API Endpoint: /api/exams (Public Exams & Exam Questions for Students)
// ============================================================================
const { kv } = require('./_redis');
const { callGoogleAppsScript } = require('./_sheets');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // --------------------------------------------------------------------
        // 1. GET: Fetch Active Exams or Single Exam Details
        // --------------------------------------------------------------------
        if (req.method === 'GET') {
            const { id } = req.query;

            // Scenario A: Get single exam with questions for taking test
            if (id) {
                // Try to get from Redis cache
                let fullExam = await kv.get(`exam:full:${id}`);

                // If not in Redis, fetch from Google Apps Script and cache
                if (!fullExam) {
                    const gasRes = await callGoogleAppsScript('get_exam_with_questions', { examId: id });
                    if (gasRes && gasRes.success && gasRes.data) {
                        fullExam = gasRes.data;
                        await kv.set(`exam:full:${id}`, fullExam, { ex: 86400 }); // cache 24h
                    }
                }

                if (!fullExam) {
                    return res.status(404).json({
                        success: false,
                        message: 'Ujian tidak ditemukan atau link sudah kadaluarsa.'
                    });
                }

                // SECURITY: Strip out correctAnswer before sending to student browser!
                const sanitizedQuestions = (fullExam.questions || []).map(q => {
                    const { correctAnswer, ...safeQuestion } = q;
                    return safeQuestion;
                });

                const studentExam = {
                    ...fullExam,
                    questions: sanitizedQuestions
                };

                return res.status(200).json({
                    success: true,
                    data: studentExam
                });
            }

            // Scenario B: Get list of active public exams for student dashboard
            let activeExams = await kv.get('exams:active_list');

            if (!activeExams || !Array.isArray(activeExams) || activeExams.length === 0) {
                // Fetch from Google Apps Script
                const gasRes = await callGoogleAppsScript('get_active_public_exams');
                if (gasRes && gasRes.success && Array.isArray(gasRes.data)) {
                    activeExams = gasRes.data;
                    await kv.set('exams:active_list', activeExams, { ex: 300 }); // cache 5 mins
                } else {
                    activeExams = [];
                }
            }

            return res.status(200).json({
                success: true,
                data: activeExams
            });
        }

        // --------------------------------------------------------------------
        // 2. POST: Publish / Cache Exam from Teacher Dashboard or Sync Worker
        // --------------------------------------------------------------------
        if (req.method === 'POST') {
            const body = req.body || {};
            const { action, exam, questions } = body;

            if (action === 'publish' && exam && exam.examId) {
                const fullPayload = {
                    ...exam,
                    questions: questions || []
                };

                // Store in Redis with answer keys preserved for server-side grading
                await kv.set(`exam:full:${exam.examId}`, fullPayload, { ex: 86400 * 7 }); // 7 days

                // Update active list
                let activeList = await kv.get('exams:active_list') || [];
                activeList = activeList.filter(e => e.examId !== exam.examId);
                if (exam.status === 'ACTIVE' && exam.showInPortal !== false) {
                    activeList.unshift({
                        examId: exam.examId,
                        title: exam.title,
                        subject: exam.subject,
                        material: exam.material,
                        className: exam.className,
                        durationMinutes: exam.durationMinutes,
                        kkm: exam.kkm,
                        status: exam.status,
                        teacherName: exam.teacherName || ''
                    });
                }
                await kv.set('exams:active_list', activeList, { ex: 86400 });

                return res.status(200).json({
                    success: true,
                    message: `Ujian ${exam.examId} berhasil dipublikasikan ke cache Vercel.`
                });
            }

            return res.status(400).json({ success: false, message: 'Aksi POST tidak valid.' });
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
