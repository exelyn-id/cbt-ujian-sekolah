// ============================================================================
// API Endpoint: /api/submit (High-Concurrency Server-Side Exam Scoring & Queue)
// ============================================================================
const { kv } = require('./_redis');
const { callGoogleAppsScript } = require('./_sheets');

function calculateQuestionScore(q, studentAns) {
    const maxScore = Number(q.score || 10);
    const method = (q.scoringMethod || 'EXACT').toUpperCase();
    const type = (q.type || 'MCQ').toUpperCase();
    const key = q.correctAnswer;

    if (studentAns === undefined || studentAns === null || studentAns === '') {
        return { isCorrect: false, score: 0, maxScore };
    }

    // 1. Single Choice (MCQ)
    if (type === 'MCQ') {
        const isMatch = String(studentAns).trim().toUpperCase() === String(key).trim().toUpperCase();
        return {
            isCorrect: isMatch,
            score: isMatch ? maxScore : 0,
            maxScore
        };
    }

    // 2. True / False (TRUE_FALSE)
    if (type === 'TRUE_FALSE') {
        // Handle array or comma-separated sub-statements
        if (Array.isArray(studentAns) || (typeof key === 'string' && key.includes(','))) {
            const keyArr = Array.isArray(key) ? key : String(key).split(',').map(s => s.trim().toUpperCase());
            const ansArr = Array.isArray(studentAns) ? studentAns : String(studentAns).split(',').map(s => s.trim().toUpperCase());

            let correctCount = 0;
            const totalItems = keyArr.length;

            for (let i = 0; i < totalItems; i++) {
                const studentVal = (ansArr[i] || '').toUpperCase();
                const keyVal = (keyArr[i] || '').toUpperCase();
                // Normalize "BENAR"/"B"/"TRUE" and "SALAH"/"S"/"FALSE"
                const normAns = (studentVal === 'B' || studentVal === 'BENAR' || studentVal === 'TRUE' || studentVal === 'SESUAI' || studentVal === 'TEPAT') ? 'T' : 'F';
                const normKey = (keyVal === 'B' || keyVal === 'BENAR' || keyVal === 'TRUE' || keyVal === 'SESUAI' || keyVal === 'TEPAT') ? 'T' : 'F';
                if (normAns === normKey) correctCount++;
            }

            if (method === 'PARTIAL') {
                const awarded = totalItems > 0 ? (correctCount / totalItems) * maxScore : 0;
                return {
                    isCorrect: correctCount === totalItems,
                    score: Math.round(awarded * 100) / 100,
                    maxScore
                };
            } else {
                const isAllCorrect = correctCount === totalItems;
                return {
                    isCorrect: isAllCorrect,
                    score: isAllCorrect ? maxScore : 0,
                    maxScore
                };
            }
        }

        // Single statement True/False
        const normAns = String(studentAns).trim().toUpperCase();
        const normKey = String(key).trim().toUpperCase();
        const isMatch = (normAns === normKey) ||
            ((normAns === 'B' || normAns === 'BENAR' || normAns === 'TRUE') && (normKey === 'B' || normKey === 'BENAR' || normKey === 'TRUE')) ||
            ((normAns === 'S' || normAns === 'SALAH' || normAns === 'FALSE') && (normKey === 'S' || normKey === 'SALAH' || normKey === 'FALSE'));

        return {
            isCorrect: isMatch,
            score: isMatch ? maxScore : 0,
            maxScore
        };
    }

    // 3. Complex MCQ (Multiple Selection)
    if (type === 'MCQ_COMPLEX') {
        const studentSet = new Set((Array.isArray(studentAns) ? studentAns : [studentAns]).map(x => String(x).trim().toUpperCase()));
        const keySet = new Set((Array.isArray(key) ? key : String(key).split(',')).map(x => String(x).trim().toUpperCase()));

        let truePositives = 0;
        let falsePositives = 0;

        studentSet.forEach(ans => {
            if (keySet.has(ans)) truePositives++;
            else falsePositives++;
        });

        if (method === 'PARTIAL') {
            const raw = (truePositives - falsePositives) / (keySet.size || 1);
            const ratio = Math.max(0, raw);
            const awarded = Math.round(ratio * maxScore * 100) / 100;
            return {
                isCorrect: truePositives === keySet.size && falsePositives === 0,
                score: awarded,
                maxScore
            };
        } else {
            const isMatch = truePositives === keySet.size && falsePositives === 0;
            return {
                isCorrect: isMatch,
                score: isMatch ? maxScore : 0,
                maxScore
            };
        }
    }

    // Fallback
    const isMatch = JSON.stringify(studentAns) === JSON.stringify(key);
    return { isCorrect: isMatch, score: isMatch ? maxScore : 0, maxScore };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { attemptId, examId, participant, answers } = req.body || {};

        if (!attemptId || !examId) {
            return res.status(400).json({ success: false, message: 'attemptId dan examId wajib diisi.' });
        }

        // 1. Fetch full exam (with answer keys) from Redis or Google Apps Script
        let fullExam = await kv.get(`exam:full:${examId}`);
        if (!fullExam) {
            const gasRes = await callGoogleAppsScript('get_exam_with_questions', { examId });
            if (gasRes && gasRes.success && gasRes.data) {
                fullExam = gasRes.data;
                await kv.set(`exam:full:${examId}`, fullExam, { ex: 86400 });
            }
        }

        const questions = (fullExam && fullExam.questions) ? fullExam.questions : [];
        const kkm = Number((fullExam && fullExam.kkm) || 75);
        const finalAnswers = answers || {};

        // 2. Score evaluation
        let totalScore = 0;
        let totalMaxScore = 0;
        let correctCount = 0;
        let wrongCount = 0;
        const answerRecords = [];

        questions.forEach(q => {
            const studentAns = finalAnswers[q.id];
            const result = calculateQuestionScore(q, studentAns);

            totalScore += result.score;
            totalMaxScore += result.maxScore;
            if (result.isCorrect) correctCount++;
            else wrongCount++;

            answerRecords.push({
                questionId: q.id,
                studentAnswer: studentAns || null,
                scoreAwarded: result.score,
                isCorrect: result.isCorrect,
                maxScore: result.maxScore
            });
        });

        // Normalize score to 0 - 100
        const normalizedScore = totalMaxScore > 0 
            ? Math.round((totalScore / totalMaxScore) * 1000) / 10 
            : 0;

        const passStatus = normalizedScore >= kkm ? 'LULUS' : 'BELUM LULUS';
        const nowIso = new Date().toISOString();

        // 3. Assemble complete Attempt Record
        const attemptRecord = {
            attemptId,
            examId,
            participantName: (participant && participant.name) || 'Siswa',
            className: (participant && participant.className) || 'Umum',
            nis: (participant && participant.nis) || '',
            attemptNumber: 1,
            startedAt: (participant && participant.startedAt) || nowIso,
            submittedAt: nowIso,
            status: 'SUBMITTED',
            rawScore: totalScore,
            maxRawScore: totalMaxScore,
            finalScore: normalizedScore,
            kkm: kkm,
            passStatus: passStatus,
            answers: answerRecords
        };

        // 4. Save Attempt in Redis buffer (persisted 30 days)
        await kv.set(`attempt:record:${attemptId}`, attemptRecord, { ex: 86400 * 30 });

        // 5. Enqueue for Google Spreadsheet Batch Synchronization
        await kv.rpush('queue:sync_to_sheets', attemptId);

        // 6. Trigger background sync without awaiting to keep client response sub-second
        if (req.headers && req.headers.host && !req.headers.host.includes('test') && !process.env.TEST_MODE) {
            const syncUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/sync-to-sheets`;
            fetch(syncUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'after_submit' }) })
                .catch(() => {});
        }

        // 7. Instant Return to Student!
        return res.status(200).json({
            success: true,
            data: {
                attemptId: attemptId,
                status: 'SUBMITTED',
                showResult: fullExam ? fullExam.showResult !== false : true,
                score: normalizedScore,
                kkm: kkm,
                passStatus: passStatus,
                totalCorrect: correctCount,
                totalWrong: wrongCount,
                totalQuestions: questions.length
            },
            message: 'Ujian berhasil dikumpulkan dan nilai berhasil dihitung!'
        });
    } catch (err) {
        console.error('API /api/submit error:', err);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengumpulkan ujian: ' + err.message
        });
    }
};
