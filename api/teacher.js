// ============================================================================
// API Endpoint: /api/teacher (Teacher Operations & Real-Time Gateway)
// ============================================================================
const { callGoogleAppsScript } = require('./_sheets');
const { kv } = require('./_redis');

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

        // --------------------------------------------------------------------
        // 1. GET_EXAM_RESULTS (Real-time student submissions from Vercel DB)
        // --------------------------------------------------------------------
        if (action === 'get_exam_results') {
            const { examId, sessionId } = payload;
            if (!examId) {
                return res.status(400).json({ success: false, message: 'examId is required' });
            }

            // A. Fetch real-time attempts directly from Vercel Redis
            const attemptIds = await kv.lrange(`exam:attempts:${examId}`, 0, -1) || [];
            const redisAttempts = [];
            for (const attId of attemptIds) {
                const rec = await kv.get(`attempt:record:${attId}`);
                if (rec) {
                    redisAttempts.push({
                        attemptId: rec.attemptId,
                        examId: rec.examId,
                        nis: rec.nis || '',
                        name: rec.participantName || '',
                        className: rec.className || '',
                        attemptNumber: rec.attemptNumber || 1,
                        status: rec.status || 'SUBMITTED',
                        score: rec.finalScore !== undefined ? rec.finalScore : rec.rawScore,
                        kkm: rec.kkm || 75,
                        passStatus: rec.passStatus || 'BELUM LULUS',
                        submittedAt: rec.submittedAt || rec.startedAt
                    });
                }
            }

            // B. Optional: Fetch from Google Apps Script if reachable, and merge (deduplicate)
            let combinedResults = [...redisAttempts];
            try {
                const gasRes = await callGoogleAppsScript('get_exam_results', { sessionId, examId });
                if (gasRes && gasRes.success && gasRes.data && Array.isArray(gasRes.data.results)) {
                    const existingIds = new Set(redisAttempts.map(r => r.attemptId));
                    gasRes.data.results.forEach(sheetAtt => {
                        if (!existingIds.has(sheetAtt.attemptId)) {
                            combinedResults.push(sheetAtt);
                        }
                    });
                }
            } catch (gasErr) {
                console.warn('[Teacher Results] GAS fetch skipped, serving real-time Vercel DB:', gasErr.message);
            }

            // C. Calculate Summary Statistics
            const submitted = combinedResults.filter(a => a.status === 'SUBMITTED');
            const scores = submitted.map(a => Number(a.score || 0));
            const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const passCount = submitted.filter(a => a.passStatus === 'LULUS').length;

            const summary = {
                totalParticipants: combinedResults.length,
                submittedCount: submitted.length,
                inProgressCount: combinedResults.length - submitted.length,
                avgScore: Math.round(avg * 10) / 10,
                highestScore: scores.length > 0 ? Math.max(...scores) : 0,
                lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
                passRate: submitted.length > 0 ? Math.round((passCount / submitted.length) * 100) : 0
            };

            return res.status(200).json({
                success: true,
                data: {
                    summary,
                    results: combinedResults
                }
            });
        }

        // --------------------------------------------------------------------
        // 2. GET_STUDENT_ATTEMPT_DETAIL (Question-by-Question Real-time Answers)
        // --------------------------------------------------------------------
        if (action === 'get_student_attempt_detail') {
            const { attemptId, sessionId } = payload;
            if (!attemptId) {
                return res.status(400).json({ success: false, message: 'attemptId is required' });
            }

            const rec = await kv.get(`attempt:record:${attemptId}`);
            if (rec) {
                let fullExam = await kv.get(`exam:full:${rec.examId}`);
                if (!fullExam) {
                    try {
                        const gasRes = await callGoogleAppsScript('get_exam_with_questions', { examId: rec.examId });
                        if (gasRes && gasRes.success && gasRes.data) fullExam = gasRes.data;
                    } catch (e) {}
                }

                const questions = (fullExam && Array.isArray(fullExam.questions)) ? fullExam.questions : [];
                const answersMap = {};
                if (Array.isArray(rec.answers)) {
                    rec.answers.forEach(a => { answersMap[a.questionId] = a; });
                }

                const questionDetails = questions.map((q, idx) => {
                    const ansObj = answersMap[q.id] || {};
                    return {
                        questionId: q.id,
                        orderNo: q.orderNo || (idx + 1),
                        type: q.type,
                        questionText: q.text,
                        imageUrl: q.imageUrl || '',
                        score: Number(q.score || 10),
                        options: q.options || [],
                        correctAnswer: q.correctAnswer,
                        scoringMethod: q.scoringMethod || 'EXACT',
                        studentAnswer: ansObj.studentAnswer !== undefined ? ansObj.studentAnswer : null,
                        scoreAwarded: ansObj.scoreAwarded !== undefined ? ansObj.scoreAwarded : 0,
                        isCorrect: ansObj.isCorrect === true
                    };
                });

                return res.status(200).json({
                    success: true,
                    data: {
                        attempt: {
                            attemptId: rec.attemptId,
                            examId: rec.examId,
                            name: rec.participantName,
                            className: rec.className,
                            nis: rec.nis,
                            score: rec.finalScore !== undefined ? rec.finalScore : rec.rawScore,
                            status: rec.status,
                            passStatus: rec.passStatus,
                            submittedAt: rec.submittedAt
                        },
                        exam: {
                            title: (fullExam && fullExam.title) || 'Ujian',
                            kkm: rec.kkm || 75
                        },
                        questions: questionDetails
                    }
                });
            }

            // Fallback to GAS if not in Redis
            const gasRes = await callGoogleAppsScript('get_student_attempt_detail', { sessionId, attemptId });
            return res.status(200).json(gasRes);
        }

        // --------------------------------------------------------------------
        // 3. GET_EXAM_RESULTS_EXPORT_DATA (Real-Time Excel Download Generator)
        // --------------------------------------------------------------------
        if (action === 'get_exam_results_export_data') {
            const { examId, sessionId } = payload;
            if (!examId) {
                return res.status(400).json({ success: false, message: 'examId is required' });
            }

            let fullExam = await kv.get(`exam:full:${examId}`);
            if (!fullExam) {
                try {
                    const gasRes = await callGoogleAppsScript('get_exam_with_questions', { examId });
                    if (gasRes && gasRes.success && gasRes.data) fullExam = gasRes.data;
                } catch (e) {}
            }

            const exam = fullExam || { examId, title: 'Ujian' };
            const questions = (fullExam && Array.isArray(fullExam.questions)) ? fullExam.questions : [];

            // Retrieve all attempts from Vercel Redis
            const attemptIds = await kv.lrange(`exam:attempts:${examId}`, 0, -1) || [];
            const attempts = [];

            for (const attId of attemptIds) {
                const rec = await kv.get(`attempt:record:${attId}`);
                if (rec) {
                    const answersMap = {};
                    let totalCorrect = 0;
                    let totalWrong = 0;

                    if (Array.isArray(rec.answers)) {
                        rec.answers.forEach(ans => {
                            answersMap[ans.questionId] = {
                                studentAnswer: ans.studentAnswer,
                                isCorrect: ans.isCorrect,
                                awardedScore: ans.scoreAwarded,
                                maxScore: ans.maxScore
                            };
                            if (ans.isCorrect) totalCorrect++;
                            else totalWrong++;
                        });
                    }

                    attempts.push({
                        attemptId: rec.attemptId,
                        examId: rec.examId,
                        nis: rec.nis || '',
                        name: rec.participantName || '',
                        className: rec.className || '',
                        attemptNumber: rec.attemptNumber || 1,
                        status: rec.status || 'SUBMITTED',
                        score: rec.finalScore !== undefined ? rec.finalScore : rec.rawScore,
                        kkm: rec.kkm || 75,
                        passStatus: rec.passStatus || 'BELUM LULUS',
                        startedAt: rec.startedAt,
                        submittedAt: rec.submittedAt,
                        totalCorrect: totalCorrect,
                        totalWrong: totalWrong,
                        answers: answersMap
                    });
                }
            }

            // Fallback / merge with Google Apps Script if empty
            if (attempts.length === 0) {
                try {
                    const gasRes = await callGoogleAppsScript('get_exam_results_export_data', { sessionId, examId });
                    if (gasRes && gasRes.success && gasRes.data) {
                        return res.status(200).json(gasRes);
                    }
                } catch (e) {}
            }

            return res.status(200).json({
                success: true,
                data: {
                    exam,
                    questions,
                    attempts
                }
            });
        }

        // --------------------------------------------------------------------
        // 4. SAVE_QUESTIONS (Save to Vercel Redis & Sync to GAS)
        // --------------------------------------------------------------------
        if (action === 'save_questions') {
            const { examId, questionsList, sessionId } = payload;
            if (!examId || !Array.isArray(questionsList)) {
                return res.status(400).json({ success: false, message: 'examId and questionsList required' });
            }

            // Save in Redis full cache so answer keys are preserved for server-side grading
            let fullExam = await kv.get(`exam:full:${examId}`) || {};
            fullExam.examId = examId;
            fullExam.questions = questionsList;
            await kv.set(`exam:full:${examId}`, fullExam, { ex: 86400 * 30 }); // 30 days
            await kv.del('exams:active_list'); // Invalidate public exams list cache

            // Sync to Google Apps Script asynchronously
            callGoogleAppsScript('save_questions', { sessionId, examId, questionsList }).catch(err => {
                console.warn('[Teacher Save Questions] Background GAS sync failed:', err.message);
            });

            return res.status(200).json({
                success: true,
                message: 'Soal berhasil disimpan ke database Vercel dan disinkronkan ke Google Spreadsheet.'
            });
        }

        // --------------------------------------------------------------------
        // 5. GET_QUESTIONS
        // --------------------------------------------------------------------
        if (action === 'get_questions') {
            const { examId, sessionId } = payload;
            let fullExam = await kv.get(`exam:full:${examId}`);
            if (fullExam && Array.isArray(fullExam.questions) && fullExam.questions.length > 0) {
                return res.status(200).json({
                    success: true,
                    data: fullExam.questions
                });
            }

            // Fallback to GAS
            try {
                const gasRes = await callGoogleAppsScript('get_questions', { sessionId, examId });
                if (gasRes && gasRes.success && Array.isArray(gasRes.data)) {
                    if (!fullExam) fullExam = { examId };
                    fullExam.questions = gasRes.data;
                    await kv.set(`exam:full:${examId}`, fullExam, { ex: 86400 * 30 });
                    return res.status(200).json(gasRes);
                }
            } catch (e) {}

            return res.status(200).json({ success: true, data: [] });
        }

        // --------------------------------------------------------------------
        // 6. SAVE_EXAM
        // --------------------------------------------------------------------
        if (action === 'save_exam') {
            const { examData, sessionId } = payload;
            if (examData && examData.examId) {
                let fullExam = await kv.get(`exam:full:${examData.examId}`) || {};
                fullExam = { ...fullExam, ...examData };
                await kv.set(`exam:full:${examData.examId}`, fullExam, { ex: 86400 * 30 });
                await kv.del('exams:active_list');
            }

            try {
                const gasRes = await callGoogleAppsScript('save_exam', { sessionId, examData });
                return res.status(200).json(gasRes || { success: true, message: 'Ujian berhasil disimpan.' });
            } catch (gasErr) {
                return res.status(200).json({
                    success: true,
                    data: { examId: (examData && examData.examId) },
                    message: 'Ujian tersimpan di database Vercel.'
                });
            }
        }

        // --------------------------------------------------------------------
        // 7. GET_EXAM
        // --------------------------------------------------------------------
        if (action === 'get_exam') {
            const { examId, sessionId } = payload;
            let fullExam = await kv.get(`exam:full:${examId}`);
            if (fullExam && fullExam.title) {
                return res.status(200).json({ success: true, data: fullExam });
            }

            const gasRes = await callGoogleAppsScript('get_exam', { sessionId, examId });
            if (gasRes && gasRes.success && gasRes.data) {
                await kv.set(`exam:full:${examId}`, gasRes.data, { ex: 86400 * 30 });
            }
            return res.status(200).json(gasRes);
        }

        // --------------------------------------------------------------------
        // 8. ALL OTHER ACTIONS: Forward to Google Apps Script
        // --------------------------------------------------------------------
        const gasRes = await callGoogleAppsScript(action, payload);

        // If action was deleting or toggling exam portal, invalidate active cache
        if (action === 'toggle_exam_portal' || action === 'delete_exam') {
            try {
                await kv.del('exams:active_list');
            } catch (e) {}
        }

        return res.status(200).json(gasRes || { success: false, message: 'Tidak ada respon dari server.' });
    } catch (err) {
        console.error('API /api/teacher error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server guru: ' + err.message
        });
    }
};
