// ============================================================================
// Core Database Layer: 100% Vercel Database (Upstash Redis / Vercel KV)
// ============================================================================
const { kv } = require('./_redis');

const DEFAULT_USERS = [
    { id: 'ADM_001', username: 'admin', password: 'admin123', name: 'Administrator Sekolah', role: 'ADMIN' },
    { id: 'TCH_001', username: 'guru', password: 'guru123', name: 'Pak Andi Prasetyo, S.Kom', role: 'TEACHER' },
    { id: 'TCH_002', username: 'andi', password: '123456', name: 'Pak Andi Prasetyo, S.Kom', role: 'TEACHER' },
    { id: 'TCH_003', username: 'budi', password: 'guru123', name: 'Pak Budi Santoso, S.Pd', role: 'TEACHER' },
    { id: 'TCH_004', username: 'siti', password: 'guru123', name: 'Ibu Siti Rahmawati, M.Pd', role: 'TEACHER' },
    { id: 'TCH_005', username: 'dewi', password: 'guru123', name: 'Ibu Dewi Lestari, M.Kom', role: 'TEACHER' },
    { id: 'TCH_006', username: 'guru_ipa', password: 'guru123', name: 'Ibu Siti Rahmawati, M.Pd', role: 'TEACHER' },
    { id: 'TCH_007', username: 'guru_mtk', password: 'guru123', name: 'Drs. Bambang Sutrisno', role: 'TEACHER' }
];

const DEFAULT_EXAMS = [
    {
        examId: 'EXM_001',
        ownerTeacherId: 'TCH_001',
        ownerUsername: 'guru',
        ownerTeacherName: 'Pak Andi Prasetyo, S.Kom',
        title: 'Ujian Tengah Semester Informatika',
        subject: 'Informatika',
        material: 'Dasar Web & Pemrograman',
        className: 'XII IPA 1',
        description: 'Ujian evaluasi kompetensi materi HTML, Web, dan Logika Komputasi.',
        instructions: 'Kerjakan dengan mandiri dan teliti. Timer berjalan otomatis.',
        durationMinutes: 60,
        kkm: 75,
        maxAttempts: 2,
        attemptScoring: 'HIGHEST',
        randomizeQuestions: false,
        randomizeOptions: false,
        showResult: true,
        showInPortal: true,
        status: 'ACTIVE',
        teacherName: 'Pak Andi Prasetyo, S.Kom'
    }
];

const DEFAULT_QUESTIONS = {
    'EXM_001': [
        {
            id: 'Q_001',
            orderNo: 1,
            type: 'MCQ',
            text: 'Apa kepanjangan dari HTML?',
            imageUrl: '',
            score: 10,
            scoringMethod: 'EXACT',
            correctAnswer: 'A',
            options: [
                { id: 'A', text: 'Hyper Text Markup Language', imageUrl: '' },
                { id: 'B', text: 'Hyperlinks and Text Markup Language', imageUrl: '' },
                { id: 'C', text: 'Home Tool Markup Language', imageUrl: '' }
            ]
        },
        {
            id: 'Q_002',
            orderNo: 2,
            type: 'TRUE_FALSE',
            tfType: 'BENAR_SALAH',
            text: 'JavaScript adalah bahasa pemrograman yang hanya bisa berjalan di browser client.',
            imageUrl: '',
            score: 10,
            scoringMethod: 'EXACT',
            correctAnswer: 'FALSE',
            options: [
                { id: 'TRUE', text: 'Benar', imageUrl: '' },
                { id: 'FALSE', text: 'Salah', imageUrl: '' }
            ]
        },
        {
            id: 'Q_003',
            orderNo: 3,
            type: 'MCQ_COMPLEX',
            text: 'Manakah di bawah ini yang merupakan komponen organ dalam sistem pernapasan? (Pilih semua yang benar)',
            imageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
            score: 20,
            scoringMethod: 'PARTIAL',
            correctAnswer: ['A', 'C'],
            options: [
                { id: 'A', text: 'Paru-paru', imageUrl: '' },
                { id: 'B', text: 'Lambung', imageUrl: '' },
                { id: 'C', text: 'Trakea', imageUrl: '' }
            ]
        }
    ]
};

/**
 * Initializes default database seed if empty
 */
async function ensureDbInitialized() {
    const isSeeded = await kv.get('db:seeded');
    if (!isSeeded) {
        // 1. Seed Users
        const usersMap = {};
        for (const u of DEFAULT_USERS) {
            usersMap[u.username] = u;
        }
        await kv.set('db:users', usersMap);

        // 2. Seed Exams
        const examsMap = {};
        const examIds = [];
        for (const e of DEFAULT_EXAMS) {
            examsMap[e.examId] = e;
            examIds.push(e.examId);
            if (DEFAULT_QUESTIONS[e.examId]) {
                await kv.set(`exam:questions:${e.examId}`, DEFAULT_QUESTIONS[e.examId]);
                await kv.set(`exam:full:${e.examId}`, { ...e, questions: DEFAULT_QUESTIONS[e.examId] });
            }
        }
        await kv.set('db:exams', examsMap);
        await kv.set('db:exam_ids', examIds);

        // 3. Mark seeded
        await kv.set('db:seeded', true);
    }
}

// ============================================================================
// AUTH & USERS
// ============================================================================
async function authenticateUser(username, password) {
    await ensureDbInitialized();
    const usersMap = (await kv.get('db:users')) || {};
    const lowerU = String(username || '').trim().toLowerCase();
    const u = usersMap[lowerU] || usersMap[username];
    if (u && String(u.password).trim() === String(password).trim()) {
        const sessionId = 'SES_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const sessionData = {
            sessionId: sessionId,
            teacherId: u.id,
            teacherName: u.name,
            username: u.username,
            role: u.role
        };
        // Store session for 24 hours
        await kv.set(`session:${sessionId}`, sessionData, { ex: 86400 });
        return { success: true, data: sessionData };
    }
    return { success: false, message: 'Username atau password salah.' };
}

async function verifySession(sessionId) {
    if (!sessionId) return null;
    return await kv.get(`session:${sessionId}`);
}

async function destroySession(sessionId) {
    if (sessionId) await kv.del(`session:${sessionId}`);
    return { success: true };
}

async function listUsers() {
    await ensureDbInitialized();
    const usersMap = (await kv.get('db:users')) || {};
    return Object.values(usersMap).map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role
    }));
}

async function saveUser(userData) {
    await ensureDbInitialized();
    const usersMap = (await kv.get('db:users')) || {};
    const id = userData.id || ('USR_' + Date.now().toString(36).toUpperCase());
    const username = String(userData.username).trim();
    const lowerKey = username.toLowerCase();
    const userObj = {
        id: id,
        username: username,
        password: userData.password || '123456',
        name: userData.name || username,
        role: userData.role || 'TEACHER'
    };
    usersMap[lowerKey] = userObj;
    usersMap[username] = userObj;
    await kv.set('db:users', usersMap);
    return { success: true, data: { id, username } };
}

async function deleteUser(username) {
    await ensureDbInitialized();
    const usersMap = (await kv.get('db:users')) || {};
    const lowerKey = String(username).trim().toLowerCase();
    let found = false;
    if (usersMap[lowerKey]) { delete usersMap[lowerKey]; found = true; }
    if (usersMap[username]) { delete usersMap[username]; found = true; }
    if (found) {
        await kv.set('db:users', usersMap);
        return { success: true };
    }
    return { success: false, message: 'User tidak ditemukan.' };
}

// ============================================================================
// EXAM OPERATIONS
// ============================================================================
function isExamOwnerOrAdmin(exam, session) {
    if (!exam || !session) return false;
    if (session.role === 'ADMIN') return true;
    const teacherId = session.teacherId || session.id;
    const username = session.username;
    if (teacherId && (exam.ownerTeacherId === teacherId || exam.teacherId === teacherId)) return true;
    if (username && (exam.ownerUsername === username || exam.ownerTeacherId === username)) return true;
    return false;
}

async function getTeacherExams(teacherId, role, username) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const usersMap = (await kv.get('db:users')) || {};
    let examList = Object.values(examsMap).filter(e => e.status !== 'ARCHIVED');

    // Role-based visibility:
    // Only ADMIN can see all exams. Teachers can only see their own exams.
    if (role !== 'ADMIN') {
        examList = examList.filter(e => {
            const matchId = Boolean(teacherId && (e.ownerTeacherId === teacherId || e.teacherId === teacherId));
            const matchUser = Boolean(username && (e.ownerUsername === username || e.ownerTeacherId === username));
            return matchId || matchUser;
        });
    }

    // Calculate dynamic participant counts and avg scores
    const enriched = [];
    for (const e of examList) {
        const attemptIds = (await kv.lrange(`exam:attempts:${e.examId}`, 0, -1)) || [];
        let totalScore = 0;
        let submittedCount = 0;

        for (let i = 0; i < attemptIds.length; i += 50) {
            const chunk = attemptIds.slice(i, i + 50);
            const chunkKeys = chunk.map(id => `attempt:record:${id}`);
            const recs = (await kv.mget(chunkKeys)) || [];
            for (const att of recs) {
                if (att && att.status === 'SUBMITTED') {
                    submittedCount++;
                    totalScore += Number(att.finalScore || 0);
                }
            }
        }

        const avgScore = submittedCount > 0 ? Math.round((totalScore / submittedCount) * 10) / 10 : 0;

        // Resolve teacher display name
        let ownerTeacherName = e.ownerTeacherName || e.teacherName;
        if (!ownerTeacherName && e.ownerTeacherId) {
            const foundUser = Object.values(usersMap).find(u => u.id === e.ownerTeacherId || u.username === e.ownerTeacherId);
            if (foundUser) ownerTeacherName = foundUser.name;
        }

        enriched.push({
            ...e,
            ownerTeacherName: ownerTeacherName || 'Guru',
            participantCount: attemptIds.length,
            avgScore: avgScore,
            showInPortal: e.showInPortal !== false
        });
    }

    return enriched;
}

async function getExam(examId) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    return examsMap[examId] || null;
}

async function saveExam(examData, userSession) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const examIds = (await kv.get('db:exam_ids')) || [];

    const examId = examData.examId || ('EXM_' + Math.floor(Math.random() * 90000 + 10000));
    const existing = examsMap[examId];
    const isNew = !existing;

    // Check permission if editing
    if (!isNew && userSession && typeof userSession === 'object' && userSession.role !== 'ADMIN') {
        if (!isExamOwnerOrAdmin(existing, userSession)) {
            return { success: false, message: 'Akses ditolak. Anda tidak berhak mengubah ujian milik guru lain.' };
        }
    }

    const sessionObj = typeof userSession === 'object' ? userSession : null;
    const sessionTeacherId = sessionObj ? sessionObj.teacherId : (typeof userSession === 'string' ? userSession : null);

    const ownerTeacherId = isNew 
        ? (sessionTeacherId || examData.ownerTeacherId || 'TCH_001')
        : (existing.ownerTeacherId || sessionTeacherId || 'TCH_001');

    const ownerUsername = isNew
        ? (sessionObj?.username || examData.ownerUsername || '')
        : (existing.ownerUsername || sessionObj?.username || '');

    const ownerTeacherName = isNew
        ? (sessionObj?.teacherName || examData.ownerTeacherName || examData.teacherName || 'Guru')
        : (existing.ownerTeacherName || sessionObj?.teacherName || 'Guru');

    const updated = {
        ...(existing || {}),
        ...examData,
        examId: examId,
        ownerTeacherId: ownerTeacherId,
        ownerUsername: ownerUsername,
        ownerTeacherName: ownerTeacherName,
        teacherName: ownerTeacherName,
        showInPortal: examData.showInPortal !== undefined ? Boolean(examData.showInPortal) : (existing ? existing.showInPortal !== false : true),
        status: examData.status || (existing ? existing.status : 'ACTIVE'),
        updatedAt: new Date().toISOString(),
        createdAt: isNew ? new Date().toISOString() : (existing.createdAt || new Date().toISOString())
    };

    examsMap[examId] = updated;
    if (isNew) examIds.unshift(examId);

    await kv.set('db:exams', examsMap);
    await kv.set('db:exam_ids', examIds);

    // Keep exam:full synced
    let full = (await kv.get(`exam:full:${examId}`)) || {};
    full = { ...full, ...updated };
    await kv.set(`exam:full:${examId}`, full);

    return { success: true, data: { examId }, message: isNew ? 'Ujian baru berhasil dibuat.' : 'Ujian berhasil diperbarui.' };
}

async function toggleExamPortal(examId, showInPortal, userSession) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const existing = examsMap[examId];
    if (!existing) {
        return { success: false, message: 'Ujian tidak ditemukan.' };
    }

    if (userSession && typeof userSession === 'object' && userSession.role !== 'ADMIN') {
        if (!isExamOwnerOrAdmin(existing, userSession)) {
            return { success: false, message: 'Akses ditolak. Hanya pemilik ujian atau Admin yang dapat mengubah visibilitas.' };
        }
    }

    const newVis = showInPortal !== undefined ? Boolean(showInPortal) : (existing.showInPortal === false);
    existing.showInPortal = newVis;
    examsMap[examId] = existing;
    await kv.set('db:exams', examsMap);

    let full = (await kv.get(`exam:full:${examId}`)) || {};
    full.showInPortal = newVis;
    await kv.set(`exam:full:${examId}`, full);

    return {
        success: true,
        data: { examId, showInPortal: newVis },
        message: 'Visibilitas ujian berhasil diubah.'
    };
}

async function deleteExam(examId, userSession) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const existing = examsMap[examId];
    if (!existing) {
        return { success: false, message: 'Ujian tidak ditemukan.' };
    }

    if (userSession && typeof userSession === 'object' && userSession.role !== 'ADMIN') {
        if (!isExamOwnerOrAdmin(existing, userSession)) {
            return { success: false, message: 'Akses ditolak. Anda tidak berhak menghapus ujian milik guru lain.' };
        }
    }

    existing.status = 'ARCHIVED';
    examsMap[examId] = existing;
    await kv.set('db:exams', examsMap);

    return { success: true, message: 'Ujian berhasil diarsipkan.' };
}

async function duplicateExam(sourceExamId, userSession) {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const src = examsMap[sourceExamId];
    if (!src) return { success: false, message: 'Ujian tidak ditemukan.' };

    if (userSession && typeof userSession === 'object' && userSession.role !== 'ADMIN') {
        if (!isExamOwnerOrAdmin(src, userSession)) {
            return { success: false, message: 'Akses ditolak. Anda tidak berhak menduplikasi ujian milik guru lain.' };
        }
    }

    const sessionObj = typeof userSession === 'object' ? userSession : null;
    const newExamId = 'EXM_' + Math.floor(Math.random() * 90000 + 10000);
    const newExam = {
        ...src,
        examId: newExamId,
        title: src.title + ' (Salinan)',
        status: 'DRAFT',
        ownerTeacherId: sessionObj?.teacherId || (typeof userSession === 'string' ? userSession : src.ownerTeacherId),
        ownerUsername: sessionObj?.username || src.ownerUsername,
        ownerTeacherName: sessionObj?.teacherName || src.ownerTeacherName,
        teacherName: sessionObj?.teacherName || src.teacherName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    examsMap[newExamId] = newExam;
    const examIds = (await kv.get('db:exam_ids')) || [];
    examIds.unshift(newExamId);

    await kv.set('db:exams', examsMap);
    await kv.set('db:exam_ids', examIds);

    // Duplicate questions
    const srcQuestions = (await kv.get(`exam:questions:${sourceExamId}`)) || [];
    if (srcQuestions.length > 0) {
        await kv.set(`exam:questions:${newExamId}`, srcQuestions);
        await kv.set(`exam:full:${newExamId}`, { ...newExam, questions: srcQuestions });
    }

    return { success: true, data: { examId: newExamId }, message: 'Ujian berhasil diduplikasi.' };
}

// ============================================================================
// QUESTIONS
// ============================================================================
async function getQuestions(examId) {
    await ensureDbInitialized();
    const questions = await kv.get(`exam:questions:${examId}`);
    if (Array.isArray(questions)) return questions;
    const full = await kv.get(`exam:full:${examId}`);
    return (full && Array.isArray(full.questions)) ? full.questions : [];
}

async function saveQuestions(examId, questionsList) {
    await ensureDbInitialized();
    await kv.set(`exam:questions:${examId}`, questionsList);

    // Sync to full exam cache
    let full = await kv.get(`exam:full:${examId}`) || {};
    full.examId = examId;
    full.questions = questionsList;
    await kv.set(`exam:full:${examId}`, full);

    return { success: true, message: 'Soal berhasil disimpan.' };
}

// ============================================================================
// STUDENT PUBLIC EXAMS
// ============================================================================
async function getActivePublicExams() {
    await ensureDbInitialized();
    const examsMap = (await kv.get('db:exams')) || {};
    const active = [];

    for (const e of Object.values(examsMap)) {
        if (e.status === 'ACTIVE' && e.showInPortal !== false) {
            const qList = await getQuestions(e.examId);
            active.push({
                examId: e.examId,
                title: e.title,
                subject: e.subject,
                material: e.material || '',
                className: e.className,
                description: e.description || '',
                instructions: e.instructions || '',
                durationMinutes: Number(e.durationMinutes || 60),
                totalQuestions: qList.length,
                kkm: Number(e.kkm || 75),
                maxAttempts: Number(e.maxAttempts || 1),
                startAt: e.startAt || '',
                endAt: e.endAt || '',
                teacherName: e.teacherName || 'Guru Pengampu'
            });
        }
    }
    return active;
}

async function getPublicExam(examId) {
    await ensureDbInitialized();
    const exam = await getExam(examId);
    if (!exam || exam.status === 'ARCHIVED') return null;

    const rawQuestions = await getQuestions(examId);
    // Sanitize questions: strip correctAnswer for student client
    const sanitizedQuestions = rawQuestions.map(q => {
        const { correctAnswer, ...safe } = q;
        return safe;
    });

    return {
        ...exam,
        totalQuestions: sanitizedQuestions.length,
        questions: sanitizedQuestions
    };
}

// ============================================================================
// ATTEMPTS & RESULTS
// ============================================================================
async function getExamResults(examId) {
    await ensureDbInitialized();
    const attemptIds = (await kv.lrange(`exam:attempts:${examId}`, 0, -1)) || [];
    const results = [];

    for (let i = 0; i < attemptIds.length; i += 50) {
        const chunk = attemptIds.slice(i, i + 50);
        const chunkKeys = chunk.map(id => `attempt:record:${id}`);
        const recs = (await kv.mget(chunkKeys)) || [];
        for (const rec of recs) {
            if (rec) {
                results.push({
                    attemptId: rec.attemptId,
                    examId: rec.examId,
                    nis: rec.nis || '',
                    name: rec.participantName || '',
                    className: rec.className || '',
                    attemptNumber: rec.attemptNumber || 1,
                    status: rec.status || 'SUBMITTED',
                    score: rec.status === 'SUBMITTED' ? (rec.finalScore !== undefined ? rec.finalScore : rec.rawScore) : null,
                    kkm: rec.kkm || 75,
                    passStatus: rec.status === 'SUBMITTED' ? (rec.passStatus || 'BELUM LULUS') : null,
                    tabSwitchCount: Number(rec.tabSwitchCount || 0),
                    submittedAt: rec.submittedAt || rec.startedAt
                });
            }
        }
    }

    const submitted = results.filter(a => a.status === 'SUBMITTED');
    const scores = submitted.map(a => Number(a.score || 0));
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const passCount = submitted.filter(a => a.passStatus === 'LULUS').length;

    const summary = {
        totalParticipants: results.length,
        submittedCount: submitted.length,
        inProgressCount: results.length - submitted.length,
        avgScore: Math.round(avg * 10) / 10,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
        passRate: submitted.length > 0 ? Math.round((passCount / submitted.length) * 100) : 0
    };

    return { summary, results };
}

async function getStudentAttemptDetail(attemptId) {
    await ensureDbInitialized();
    const rec = await kv.get(`attempt:record:${attemptId}`);
    if (!rec) return null;

    const exam = await getExam(rec.examId) || { title: 'Ujian', kkm: 75 };
    const rawQuestions = await getQuestions(rec.examId);

    const answersMap = {};
    if (Array.isArray(rec.answers)) {
        rec.answers.forEach(a => { 
            answersMap[a.questionId] = a;
            answersMap[a.id] = a;
        });
    }

    let totalCorrect = 0;
    let totalWrong = 0;

    const questions = rawQuestions.map((q, idx) => {
        const ansObj = answersMap[q.id] || answersMap[q.questionId] || {};
        const isCorr = ansObj.isCorrect === true;
        if (isCorr) totalCorrect++;
        else totalWrong++;
        const awarded = ansObj.scoreAwarded !== undefined ? ansObj.scoreAwarded : (ansObj.awardedScore !== undefined ? ansObj.awardedScore : 0);

        return {
            id: q.id,
            questionId: q.id,
            orderNo: q.orderNo || (idx + 1),
            type: q.type,
            tfType: q.tfType || 'BENAR_SALAH',
            text: q.text,
            questionText: q.text,
            bottomText: q.bottomText || '',
            imageUrl: q.imageUrl || '',
            questionImageUrl: q.imageUrl || '',
            score: Number(q.score || 10),
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            scoringMethod: q.scoringMethod || 'EXACT',
            studentAnswer: ansObj.studentAnswer !== undefined ? ansObj.studentAnswer : null,
            scoreAwarded: awarded,
            awardedScore: awarded,
            isCorrect: isCorr,
            explanation: q.explanation || ''
        };
    });

    return {
        attempt: {
            attemptId: rec.attemptId,
            examId: rec.examId,
            examTitle: exam.title,
            name: rec.participantName,
            participantName: rec.participantName,
            className: rec.className,
            nis: rec.nis,
            attemptNumber: rec.attemptNumber || 1,
            score: rec.finalScore !== undefined ? rec.finalScore : rec.rawScore,
            finalScore: rec.finalScore !== undefined ? rec.finalScore : rec.rawScore,
            status: rec.status,
            passStatus: rec.passStatus,
            tabSwitchCount: Number(rec.tabSwitchCount || 0),
            startedAt: rec.startedAt,
            submittedAt: rec.submittedAt,
            endAt: rec.submittedAt,
            totalCorrect: totalCorrect,
            totalWrong: totalWrong,
            totalQuestions: questions.length
        },
        exam: {
            title: exam.title,
            kkm: rec.kkm || exam.kkm || 75
        },
        questions: questions
    };
}

async function getExamResultsExportData(examId) {
    await ensureDbInitialized();
    const exam = await getExam(examId) || { examId, title: 'Ujian' };
    const rawQuestions = await getQuestions(examId);
    const questions = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id,
        questionId: q.id,
        orderNo: q.orderNo || (idx + 1)
    }));
    const attemptIds = (await kv.lrange(`exam:attempts:${examId}`, 0, -1)) || [];
    const attempts = [];

    for (let i = 0; i < attemptIds.length; i += 50) {
        const chunk = attemptIds.slice(i, i + 50);
        const chunkKeys = chunk.map(id => `attempt:record:${id}`);
        const recs = (await kv.mget(chunkKeys)) || [];
        for (const rec of recs) {
            if (rec) {
                const answersMap = {};
                let totalCorrect = 0;
                let totalWrong = 0;

                if (Array.isArray(rec.answers)) {
                    rec.answers.forEach(ans => {
                        const ansItem = {
                            studentAnswer: ans.studentAnswer,
                            isCorrect: ans.isCorrect,
                            awardedScore: ans.scoreAwarded !== undefined ? ans.scoreAwarded : (ans.awardedScore !== undefined ? ans.awardedScore : 0),
                            maxScore: ans.maxScore !== undefined ? ans.maxScore : 10
                        };
                        answersMap[ans.questionId] = ansItem;
                        answersMap[ans.id] = ansItem;
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
                    score: rec.status === 'SUBMITTED' ? (rec.finalScore !== undefined ? rec.finalScore : rec.rawScore) : null,
                    kkm: rec.kkm || 75,
                    passStatus: rec.status === 'SUBMITTED' ? (rec.passStatus || 'BELUM LULUS') : null,
                    tabSwitchCount: Number(rec.tabSwitchCount || 0),
                    startedAt: rec.startedAt,
                    submittedAt: rec.submittedAt,
                    totalCorrect: totalCorrect,
                    totalWrong: totalWrong,
                    answers: answersMap
                });
            }
        }
    }

    return { exam, questions, attempts };
}

module.exports = {
    ensureDbInitialized,
    authenticateUser,
    verifySession,
    destroySession,
    listUsers,
    saveUser,
    deleteUser,
    getTeacherExams,
    getExam,
    saveExam,
    toggleExamPortal,
    deleteExam,
    duplicateExam,
    getQuestions,
    saveQuestions,
    getActivePublicExams,
    getPublicExam,
    getExamResults,
    getStudentAttemptDetail,
    getExamResultsExportData,
    isExamOwnerOrAdmin
};
