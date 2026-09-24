// ============================================================================
// API Endpoint: /api/submit (High-Concurrency Server-Side Exam Scoring & Storage)
// ============================================================================
const { kv } = require('./_redis');
const db = require('./_db');

function normalizeTFBool(val) {
    if (val === undefined || val === null) return '';
    const s = String(val).trim().toUpperCase();
    if (s === 'BENAR' || s === 'TRUE' || s === 'B' || s === 'SESUAI' || s === 'TEPAT' || s === '1') return 'T';
    if (s === 'SALAH' || s === 'FALSE' || s === 'S' || s === 'TS' || s === 'TT' || s === 'TIDAK SESUAI' || s === 'TIDAK TEPAT' || s === '0') return 'F';
    return s;
}

function calculateQuestionScore(q, studentAns) {
    const maxScore = Number(q.score || 10);
    const method = (q.scoringMethod || 'EXACT').toUpperCase();
    const type = (q.type || 'MCQ').toUpperCase();
    let key = q.correctAnswer;

    if (studentAns === undefined || studentAns === null || studentAns === '' || (typeof studentAns === 'object' && !Array.isArray(studentAns) && Object.keys(studentAns).length === 0)) {
        return { isCorrect: false, score: 0, maxScore };
    }

    // Parse JSON string keys if stored as string
    if (typeof key === 'string' && (key.trim().startsWith('{') || key.trim().startsWith('['))) {
        try { key = JSON.parse(key); } catch (e) {}
    }

    // Parse JSON string answers if sent as string
    if (typeof studentAns === 'string' && (studentAns.trim().startsWith('{') || studentAns.trim().startsWith('['))) {
        try { studentAns = JSON.parse(studentAns); } catch (e) {}
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
        // Multi-statement object format: { '1': 'TRUE', '2': 'FALSE' }
        if (typeof key === 'object' && key !== null && !Array.isArray(key)) {
            const sMap = (typeof studentAns === 'object' && studentAns !== null && !Array.isArray(studentAns)) ? studentAns : {};
            let correctCount = 0;
            const qOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : null;
            const keyIds = qOptions ? qOptions.map(o => String(o.id)) : Object.keys(key);
            const totalItems = keyIds.length > 0 ? keyIds.length : 1;

            keyIds.forEach(kId => {
                const normAns = normalizeTFBool(sMap[kId]);
                const normKey = normalizeTFBool(key[kId]);
                if (normAns && normKey && normAns === normKey) {
                    correctCount++;
                }
            });

            if (method === 'PARTIAL') {
                const ratio = correctCount / totalItems;
                const awarded = Math.round(ratio * maxScore * 100) / 100;
                return {
                    isCorrect: correctCount === totalItems,
                    score: awarded,
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

        // Multi-statement array or comma-separated
        if (Array.isArray(key) || (typeof key === 'string' && key.includes(',')) || Array.isArray(studentAns)) {
            const keyArr = Array.isArray(key) ? key : String(key).split(',').map(s => s.trim());
            const ansArr = Array.isArray(studentAns) ? studentAns : String(studentAns).split(',').map(s => s.trim());
            let correctCount = 0;
            const totalItems = keyArr.length;

            for (let i = 0; i < totalItems; i++) {
                const normAns = normalizeTFBool(ansArr[i]);
                const normKey = normalizeTFBool(keyArr[i]);
                if (normAns && normKey && normAns === normKey) correctCount++;
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
        const normAns = normalizeTFBool(studentAns);
        const normKey = normalizeTFBool(key);
        const isMatch = normAns !== '' && normKey !== '' && (normAns === normKey);

        return {
            isCorrect: isMatch,
            score: isMatch ? maxScore : 0,
            maxScore
        };
    }

    // 3. Complex MCQ (Multiple Selection)
    if (type === 'MCQ_COMPLEX') {
        let keyList = [];
        if (Array.isArray(key)) keyList = key;
        else if (typeof key === 'string') keyList = key.split(',').map(x => x.trim());

        const studentList = Array.isArray(studentAns) ? studentAns : [studentAns];
        const studentSet = new Set(studentList.map(x => String(x).trim().toUpperCase()));
        const keySet = new Set(keyList.map(x => String(x).trim().toUpperCase()));

        let truePositives = 0;
        let falsePositives = 0;

        studentSet.forEach(ans => {
            if (keySet.has(ans)) truePositives++;
            else falsePositives++;
        });

        const targetCount = keySet.size || 1;
        if (method === 'PARTIAL') {
            const raw = (truePositives - falsePositives) / targetCount;
            const ratio = Math.max(0, Math.min(1, raw));
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

        // 1. Fetch full exam & questions directly from Vercel DB
        const fullExam = (await db.getExam(examId)) || {};
        const questions = (await db.getQuestions(examId)) || [];
        const kkm = Number(fullExam.kkm || 75);
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
                studentAnswer: studentAns !== undefined ? studentAns : null,
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
            participantName: (participant && participant.name) || (participant && participant.participantName) || 'Siswa',
            className: (participant && participant.className) || 'Umum',
            nis: (participant && participant.nis) || '',
            attemptNumber: Number((participant && participant.attemptNumber) || 1),
            startedAt: (participant && participant.startedAt) || nowIso,
            submittedAt: nowIso,
            status: 'SUBMITTED',
            rawScore: totalScore,
            maxRawScore: totalMaxScore,
            finalScore: normalizedScore,
            score: normalizedScore,
            kkm: kkm,
            passStatus: passStatus,
            tabSwitchCount: Number(req.body.tabSwitchCount !== undefined ? req.body.tabSwitchCount : ((participant && participant.tabSwitchCount) || 0)),
            answers: answerRecords
        };

        // 4. Save Attempt and Answers in Vercel Redis (persistent 30 days)
        await kv.set(`attempt:record:${attemptId}`, attemptRecord, { ex: 86400 * 30 });
        await kv.set(`attempt:answers:${attemptId}`, answerRecords, { ex: 86400 * 30 });

        // 5. Index attemptId for real-time teacher viewing & download
        try {
            const examAttemptsKey = `exam:attempts:${examId}`;
            await kv.rpush(examAttemptsKey, attemptId);
        } catch (indexErr) {
            console.error('Failed to index exam attempt in Redis:', indexErr);
        }

        // 6. Return response to student instantly
        return res.status(200).json({
            success: true,
            data: {
                attemptId: attemptId,
                status: 'SUBMITTED',
                showResult: fullExam.showResult !== false,
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
