// ============================================================================
// Universal API Client (Google Apps Script + Seamless Local Dev Mock)
// ============================================================================

const isGAS = typeof google !== 'undefined' && Boolean(google.script && google.script.run);
const isVercel = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    (!isGAS && Boolean(window.location.origin && window.location.origin.startsWith('http')))
);

async function _callVercel(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(endpoint, options);
        if (!res.ok) {
            const errData = await res.json().catch(() => null);
            return {
                success: false,
                data: null,
                message: (errData && errData.message) || `HTTP Error ${res.status}`
            };
        }
        return await res.json();
    } catch (err) {
        console.warn(`[Vercel API] ${endpoint} request failed:`, err.message);
        return null;
    }
}

function _singleCallGAS(functionName, args) {
    return new Promise((resolve) => {
        try {
            google.script.run
                .withSuccessHandler((res) => {
                    resolve(res || { success: true, data: null, message: "" });
                })
                .withFailureHandler((err) => {
                    console.error(`Apps Script Error in ${functionName}:`, err);
                    var msg = err && err.message ? err.message : (typeof err === 'string' ? err : "Terjadi kesalahan server Google Apps Script.");
                    resolve({ 
                        success: false, 
                        data: null, 
                        message: msg
                    });
                })[functionName](...args);
        } catch (e) {
            console.error(`Call failed for ${functionName}:`, e);
            resolve({ success: false, data: null, message: e.message });
        }
    });
}

async function _callGAS(functionName, ...args) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await _singleCallGAS(functionName, args);
        if (res && res.success) {
            return res;
        }

        const msg = ((res && res.message) || '').toLowerCase();
        const isTransient = msg.includes('penguncian') || 
                            msg.includes('lock') || 
                            msg.includes('terlalu banyak skrip') || 
                            msg.includes('concurrent') || 
                            msg.includes('quota') || 
                            msg.includes('limit') || 
                            msg.includes('exceeded') || 
                            msg.includes('rate') || 
                            msg.includes('busy') ||
                            msg.includes('service invoked too many times') ||
                            msg.includes('proses lain menahan kunci');

        if (isTransient && attempt < maxRetries) {
            const delay = Math.floor(700 + Math.random() * 600) * (attempt + 1);
            console.warn(`[GAS Concurrency Retry] ${functionName} got: "${res.message}". Menunggu ${delay}ms sebelum mencoba lagi (percobaan ${attempt + 1}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        return res;
    }
}

// Local mock database storage key
const STORAGE_KEY = 'UJIAN_MOCK_DB';
function _getMockDB() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Default mock data
    const defaultDB = {
        exams: [
            {
                examId: 'EXM_001',
                ownerTeacherId: 'TCH_001',
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
                status: 'ACTIVE',
                participantCount: 3,
                avgScore: 84.5
            }
        ],
        questions: {
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
        },
        attempts: [
            {
                attemptId: 'ATT_001',
                examId: 'EXM_001',
                nis: '1001',
                name: 'Budi Santoso',
                className: 'XII IPA 1',
                attemptNumber: 1,
                status: 'SUBMITTED',
                score: 85,
                kkm: 75,
                passStatus: 'LULUS',
                submittedAt: Date.now() - 3600000
            },
            {
                attemptId: 'ATT_002',
                examId: 'EXM_001',
                nis: '1002',
                name: 'Siti Aminah',
                className: 'XII IPA 1',
                attemptNumber: 1,
                status: 'SUBMITTED',
                score: 92,
                kkm: 75,
                passStatus: 'LULUS',
                submittedAt: Date.now() - 7200000
            },
            {
                attemptId: 'ATT_003',
                examId: 'EXM_001',
                nis: '1003',
                name: 'Andi Wijaya',
                className: 'XII IPA 1',
                attemptNumber: 1,
                status: 'IN_PROGRESS',
                score: null,
                kkm: 75,
                passStatus: null,
                submittedAt: null
            }
        ]
    };
    return defaultDB;
}

function _saveMockDB(db) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {}
}

const api = {
    _delay(ms = 400) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // 1. AUTH
    async loginTeacher(username, password) {
        if (isGAS) return _callGAS('loginTeacher', username, password);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=login_teacher', 'POST', { username, password });
            if (vRes) return vRes;
        }

        await this._delay();
        const mockUsers = {
            'admin': { pass: 'admin123', id: 'ADM_001', name: 'Administrator Sistem' },
            'andi': { pass: '123456', id: 'TCH_001', name: 'Pak Andi Prasetyo, S.Kom' },
            'budi': { pass: 'guru123', id: 'TCH_002', name: 'Pak Budi Santoso, S.Pd' },
            'siti': { pass: 'guru123', id: 'TCH_003', name: 'Ibu Siti Rahmawati, M.Pd' },
            'dewi': { pass: 'guru123', id: 'TCH_004', name: 'Ibu Dewi Lestari, M.Kom' }
        };
        const u = String(username).trim().toLowerCase();
        const p = String(password).trim();
        if (mockUsers[u] && mockUsers[u].pass === p) {
            const role = (u === 'admin' || mockUsers[u].id.startsWith('ADM')) ? 'ADMIN' : 'TEACHER';
            return {
                success: true,
                data: {
                    sessionId: 'MOCK_SES_' + u,
                    teacherId: mockUsers[u].id,
                    teacherName: mockUsers[u].name,
                    username: u,
                    role: role
                },
                message: 'Login berhasil'
            };
        }
        return { success: false, data: null, message: 'Username atau password salah.' };
    },

    async logoutTeacher(sessionId) {
        if (isGAS) return _callGAS('logoutTeacher', sessionId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=logout_teacher', 'POST', { sessionId });
            if (vRes) return vRes;
        }
        await this._delay(200);
        return { success: true, message: 'Berhasil keluar' };
    },

    // 2. EXAM CRUD
    async getTeacherExams(sessionId) {
        if (isGAS) return _callGAS('getTeacherExams', sessionId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_teacher_exams', 'POST', { sessionId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const isAdmin = (typeof AppState !== 'undefined') && AppState.user && AppState.user.role === 'ADMIN';
        const currentTeacherId = (typeof AppState !== 'undefined') && AppState.user && AppState.user.teacherId;
        const currentUsername = (typeof AppState !== 'undefined') && AppState.user && AppState.user.username;

        const filtered = (db.exams || []).filter(e => {
            if (e.status === 'ARCHIVED') return false;
            if (isAdmin) return true;
            return (e.ownerTeacherId && e.ownerTeacherId === currentTeacherId) ||
                   (e.ownerUsername && e.ownerUsername === currentUsername) ||
                   (e.teacherId && e.teacherId === currentTeacherId);
        });

        return {
            success: true,
            data: filtered.map(e => ({
                ...e,
                showInPortal: e.showInPortal !== false
            }))
        };
    },

    async toggleExamPortalVisibility(sessionId, examId, showInPortal) {
        if (isGAS) return _callGAS('toggleExamPortalVisibility', sessionId, examId, showInPortal);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=toggle_exam_portal', 'POST', { sessionId, examId, showInPortal });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const exam = (db.exams || []).find(e => e.examId === examId);
        if (exam) {
            const newVis = (showInPortal !== undefined) ? Boolean(showInPortal) : (exam.showInPortal === false);
            exam.showInPortal = newVis;
            _saveMockDB(db);
            return {
                success: true,
                data: { examId, showInPortal: newVis },
                message: 'Visibilitas ujian di portal siswa berhasil ' + (newVis ? 'diaktifkan (Tampil)' : 'dinonaktifkan (Disembunyikan)') + '.'
            };
        }
        return { success: false, data: null, message: 'Ujian tidak ditemukan.' };
    },

    async getExam(sessionId, examId) {
        if (isGAS) return _callGAS('getExam', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_exam', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const exam = db.exams.find(e => e.examId === examId);
        if (exam) return { success: true, data: exam };
        return { success: false, data: null, message: 'Ujian tidak ditemukan.' };
    },

    async saveExam(sessionId, examData) {
        if (isGAS) return _callGAS('saveExam', sessionId, examData);
        if (isVercel) {
            const enriched = {
                ...examData,
                ownerTeacherId: examData.ownerTeacherId || ((typeof AppState !== 'undefined') && AppState.user ? AppState.user.teacherId : undefined),
                ownerUsername: examData.ownerUsername || ((typeof AppState !== 'undefined') && AppState.user ? AppState.user.username : undefined),
                ownerTeacherName: examData.ownerTeacherName || examData.teacherName || ((typeof AppState !== 'undefined') && AppState.user ? AppState.user.teacherName : undefined),
                teacherName: examData.teacherName || ((typeof AppState !== 'undefined') && AppState.user ? AppState.user.teacherName : undefined)
            };
            const vRes = await _callVercel('/api/teacher?action=save_exam', 'POST', { sessionId, examData: enriched });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        if (examData.examId) {
            const idx = db.exams.findIndex(e => e.examId === examData.examId);
            if (idx !== -1) {
                db.exams[idx] = { ...db.exams[idx], ...examData };
                _saveMockDB(db);
                return { success: true, data: { examId: examData.examId }, message: 'Ujian berhasil diperbarui.' };
            }
        }
        const newExamId = 'EXM_' + Math.floor(Math.random() * 90000 + 10000);
        const userObj = (typeof AppState !== 'undefined' && AppState.user) ? AppState.user : {};
        const newExam = {
            ...examData,
            examId: newExamId,
            ownerTeacherId: userObj.teacherId || 'TCH_001',
            ownerUsername: userObj.username || 'guru',
            ownerTeacherName: userObj.teacherName || 'Guru',
            teacherName: userObj.teacherName || 'Guru',
            participantCount: 0,
            avgScore: 0
        };
        db.exams.unshift(newExam);
        _saveMockDB(db);
        return { success: true, data: { examId: newExamId }, message: 'Ujian berhasil dibuat.' };
    },

    async deleteExam(sessionId, examId) {
        if (isGAS) return _callGAS('deleteExam', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=delete_exam', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const exam = db.exams.find(e => e.examId === examId);
        if (exam) {
            exam.status = 'ARCHIVED';
            _saveMockDB(db);
            return { success: true, message: 'Ujian berhasil diarsipkan.' };
        }
        return { success: false, message: 'Ujian tidak ditemukan.' };
    },

    async duplicateExam(sessionId, examId) {
        if (isGAS) return _callGAS('duplicateExam', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=duplicate_exam', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const src = db.exams.find(e => e.examId === examId);
        if (!src) return { success: false, message: 'Ujian tidak ditemukan.' };

        const newExamId = 'EXM_' + Math.floor(Math.random() * 90000 + 10000);
        const userObj = (typeof AppState !== 'undefined' && AppState.user) ? AppState.user : {};
        const copy = {
            ...src,
            examId: newExamId,
            title: src.title + ' (Salinan)',
            status: 'DRAFT',
            ownerTeacherId: userObj.teacherId || src.ownerTeacherId,
            ownerUsername: userObj.username || src.ownerUsername,
            ownerTeacherName: userObj.teacherName || src.ownerTeacherName,
            teacherName: userObj.teacherName || src.teacherName,
            participantCount: 0,
            avgScore: 0
        };
        db.exams.unshift(copy);
        if (db.questions[examId]) {
            db.questions[newExamId] = JSON.parse(JSON.stringify(db.questions[examId]));
        }
        _saveMockDB(db);
        return { success: true, data: { examId: newExamId }, message: 'Ujian berhasil diduplikasi.' };
    },

    // 3. QUESTIONS
    async getQuestions(sessionId, examId) {
        if (isGAS) return _callGAS('getQuestions', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_questions', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const qList = db.questions[examId] || [];
        return { success: true, data: qList };
    },

    async saveQuestions(sessionId, examId, questionsList) {
        if (isGAS) return _callGAS('saveQuestions', sessionId, examId, questionsList);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=save_questions', 'POST', { sessionId, examId, questionsList });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        db.questions[examId] = questionsList;
        _saveMockDB(db);
        return { success: true, message: 'Soal berhasil disimpan.' };
    },

    // 4. PARTICIPANT / STUDENT
    async getActivePublicExams() {
        if (isGAS) return _callGAS('getActivePublicExams');
        if (isVercel) {
            const vRes = await _callVercel('/api/exams');
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const activeList = (db.exams || []).filter(e => e.status === 'ACTIVE' && e.showInPortal !== false).map(e => ({
            examId: e.examId,
            title: e.title,
            subject: e.subject,
            material: e.material || '',
            className: e.className,
            description: e.description || '',
            instructions: e.instructions || '',
            durationMinutes: Number(e.durationMinutes || 60),
            totalQuestions: (db.questions[e.examId] || []).length,
            kkm: Number(e.kkm || 75),
            maxAttempts: Number(e.maxAttempts || 1),
            startAt: e.startAt || '',
            endAt: e.endAt || '',
            teacherName: 'Pak Andi Prasetyo, S.Kom'
        }));
        return { success: true, data: activeList, message: 'Daftar ujian aktif berhasil dimuat.' };
    },

    async getPublicExam(examId) {
        if (isGAS) return _callGAS('getPublicExam', examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/exams?id=' + encodeURIComponent(examId));
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const exam = db.exams.find(e => e.examId === examId || examId === 'EXM123');
        if (!exam) return { success: false, message: 'Ujian tidak ditemukan atau link salah.' };

        const qCount = (db.questions[exam.examId] || []).length;
        return {
            success: true,
            data: {
                ...exam,
                totalQuestions: qCount
            }
        };
    },

    async startExamAttempt(examId, participantData) {
        if (isGAS) return _callGAS('startExamAttempt', examId, participantData);
        if (isVercel) {
            const vRes = await _callVercel('/api/exams', 'POST', {
                action: 'start_attempt',
                examId: examId,
                participantData: participantData
            });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const exam = db.exams.find(e => e.examId === examId || examId === 'EXM123');
        if (!exam) return { success: false, message: 'Ujian tidak valid.' };

        const qList = db.questions[exam.examId] || [];
        if (qList.length === 0) return { success: false, message: 'Ujian ini belum memiliki soal.' };

        const attemptId = 'ATT_' + Math.floor(Math.random() * 900000 + 100000);
        const deadlineAt = Date.now() + (exam.durationMinutes * 60 * 1000);

        // Sanitize questions
        const sanitized = qList.map(q => ({
            id: q.id,
            type: q.type,
            tfType: q.tfType || 'BENAR_SALAH',
            text: q.text,
            imageUrl: q.imageUrl || '',
            options: (q.options || []).map(o => ({ id: o.id, text: o.text, imageUrl: o.imageUrl || '' }))
        }));

        return {
            success: true,
            data: {
                attemptId: attemptId,
                deadlineAt: deadlineAt,
                participantName: participantData.name,
                className: participantData.className,
                nis: participantData.nis,
                questions: sanitized
            }
        };
    },

    async saveAttemptAnswers(attemptId, answersMap) {
        if (isGAS) return _callGAS('saveAttemptAnswers', attemptId, answersMap);
        if (isVercel) {
            const examId = (AppState.currentExam && AppState.currentExam.examId) || '';
            const vRes = await _callVercel('/api/autosave', 'POST', {
                attemptId: attemptId,
                examId: examId,
                answersMap: answersMap
            });
            if (vRes) return vRes;
        }

        await this._delay(200);
        return { success: true, savedAt: Date.now() };
    },

    async submitExamAttempt(attemptId, finalAnswersMap) {
        if (isGAS) return _callGAS('submitExamAttempt', attemptId, finalAnswersMap);
        if (isVercel) {
            const examId = (AppState.currentExam && AppState.currentExam.examId) || '';
            const vRes = await _callVercel('/api/submit', 'POST', {
                attemptId: attemptId,
                examId: examId,
                participant: AppState.attempt,
                answers: finalAnswersMap
            });
            if (vRes) return vRes;
        }

        await this._delay(800);
        const db = _getMockDB();
        const exam = AppState.currentExam || db.exams[0];
        const kkm = exam ? exam.kkm : 75;
        const qList = (exam && db.questions[exam.examId]) ? db.questions[exam.examId] : [];

        let correct = 0;
        let total = qList.length > 0 ? qList.length : 3;

        // Simple mock score calculation
        qList.forEach(q => {
            const ans = (finalAnswersMap || {})[q.id];
            if (ans && (ans === q.correctAnswer || (Array.isArray(ans) && Array.isArray(q.correctAnswer) && ans.length === q.correctAnswer.length))) {
                correct++;
            }
        });

        const finalScore = total > 0 ? Math.round((correct / total) * 100) : 80;
        const passStatus = finalScore >= kkm ? 'LULUS' : 'BELUM LULUS';

        return {
            success: true,
            data: {
                attemptId: attemptId,
                status: 'SUBMITTED',
                showResult: exam ? exam.showResult : true,
                score: finalScore,
                kkm: kkm,
                passStatus: passStatus,
                totalCorrect: correct,
                totalWrong: total - correct,
                totalQuestions: total
            },
            message: 'Ujian berhasil dikumpulkan!'
        };
    },

    // 5. RESULTS & EXPORT
    async getExamResults(sessionId, examId) {
        if (isGAS) return _callGAS('getExamResults', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_exam_results', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const attempts = db.attempts.filter(a => a.examId === examId || examId === 'EXM_001');

        const submitted = attempts.filter(a => a.status === 'SUBMITTED');
        const scores = submitted.map(a => a.score);
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const passCount = submitted.filter(a => a.passStatus === 'LULUS').length;

        return {
            success: true,
            data: {
                summary: {
                    totalParticipants: attempts.length,
                    submittedCount: submitted.length,
                    inProgressCount: attempts.length - submitted.length,
                    avgScore: Math.round(avg * 10) / 10,
                    highestScore: scores.length > 0 ? Math.max(...scores) : 0,
                    lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
                    passRate: submitted.length > 0 ? Math.round((passCount / submitted.length) * 100) : 0
                },
                results: attempts
            }
        };
    },

    async getStudentAttemptDetail(sessionId, attemptId) {
        if (isGAS) return _callGAS('getStudentAttemptDetail', sessionId, attemptId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_student_attempt_detail', 'POST', { sessionId, attemptId });
            if (vRes) return vRes;
        }

        await this._delay();
        const db = _getMockDB();
        const attempt = db.attempts.find(a => a.attemptId === attemptId) || {
            attemptId: attemptId,
            examId: 'EXM_001',
            name: 'Ahmad Fauzi',
            className: 'XII IPA 1',
            nis: '1001',
            score: 100,
            status: 'SUBMITTED',
            passStatus: 'LULUS',
            submittedAt: new Date().toISOString()
        };

        const exam = db.exams.find(e => e.examId === attempt.examId) || { title: 'Ujian Penilaian Tengah Semester Informatika', kkm: 75 };
        const questions = db.questions[attempt.examId] || [
            { id: 'Q1', type: 'MCQ', questionText: 'Apa kepanjangan dari HTML?', score: 10, correctAnswer: 'A', options: [{ id: 'A', text: 'Hyper Text Markup Language' }, { id: 'B', text: 'High Tech Modern Language' }] },
            { id: 'Q2', type: 'TRUE_FALSE', questionText: 'Matahari terbit dari sebelah timur.', score: 10, correctAnswer: 'TRUE', options: [{ id: 'TRUE', text: 'Benar' }, { id: 'FALSE', text: 'Salah' }] }
        ];

        const questionDetails = questions.map((q, idx) => ({
            questionId: q.id,
            orderNo: idx + 1,
            type: q.type,
            tfType: q.tfType || 'BENAR_SALAH',
            questionText: q.questionText,
            questionImageUrl: q.imageUrl || '',
            score: q.score || 10,
            scoringMethod: q.scoringMethod || 'EXACT',
            correctAnswer: q.correctAnswer,
            options: q.options || [],
            studentAnswer: q.correctAnswer,
            isCorrect: true,
            awardedScore: q.score || 10,
            savedAt: attempt.submittedAt
        }));

        return {
            success: true,
            data: {
                attempt: {
                    attemptId: attempt.attemptId,
                    examId: attempt.examId,
                    examTitle: exam.title,
                    participantName: attempt.name || attempt.participantName || 'Siswa',
                    className: attempt.className || 'XII IPA 1',
                    nis: attempt.nis || '1001',
                    attemptNumber: attempt.attemptNumber || 1,
                    status: attempt.status,
                    score: attempt.score,
                    finalScore: attempt.score,
                    kkm: attempt.kkm || exam.kkm || 75,
                    passStatus: attempt.passStatus || 'LULUS',
                    totalCorrect: questions.length,
                    totalWrong: 0,
                    totalQuestions: questions.length,
                    startedAt: attempt.startedAt || new Date().toISOString(),
                    submittedAt: attempt.submittedAt || new Date().toISOString()
                },
                questions: questionDetails
            }
        };
    },

    async exportExamResults(sessionId, examId) {
        if (isGAS) return _callGAS('exportExamResults', sessionId, examId);

        await this._delay(1000);
        return {
            success: true,
            data: {
                url: '#/results?exported=true',
                title: 'Rekap_Nilai_' + examId
            },
            message: 'Data rekap berhasil disiapkan.'
        };
    },

    async getExamResultsExportData(sessionId, examId) {
        if (isGAS) return _callGAS('getExamResultsExportData', sessionId, examId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_exam_results_export_data', 'POST', { sessionId, examId });
            if (vRes) return vRes;
        }

        await this._delay(800);
        const exam = MOCK_EXAMS.find(e => e.examId === examId) || {
            examId: examId,
            title: 'Ujian Simulasi',
            subject: 'Umum',
            className: 'XII.1',
            kkm: 75,
            durationMinutes: 60
        };
        const questions = MOCK_QUESTIONS.filter(q => q.examId === examId);
        const attempts = (MOCK_ATTEMPTS || []).filter(a => a.examId === examId).map(att => {
            const answers = {};
            questions.forEach(q => {
                answers[q.questionId] = {
                    studentAnswer: q.type === 'TRUE_FALSE' ? { '1': 'TRUE', '2': 'FALSE' } : (q.type === 'MCQ_COMPLEX' ? ['A'] : 'A'),
                    isCorrect: true,
                    awardedScore: q.score || 10
                };
            });
            return {
                ...att,
                totalCorrect: questions.length,
                totalWrong: 0,
                answers: answers
            };
        });

        return {
            success: true,
            data: {
                exam: exam,
                questions: questions,
                attempts: attempts
            }
        };
    },

    // 6. USER MANAGEMENT (Admin)
    async getUsers(sessionId) {
        if (isGAS) return _callGAS('getUsers', sessionId);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=get_users', 'POST', { sessionId });
            if (vRes) return vRes;
        }
        await this._delay(300);
        return {
            success: true,
            data: [
                { id: 'ADM_001', username: 'admin', name: 'Administrator Sekolah', role: 'ADMIN' },
                { id: 'TCH_001', username: 'guru', name: 'Pak Andi Prasetyo, S.Kom', role: 'TEACHER' },
                { id: 'TCH_002', username: 'andi', name: 'Pak Andi Prasetyo, S.Kom', role: 'TEACHER' },
                { id: 'TCH_003', username: 'budi', name: 'Pak Budi Santoso, S.Pd', role: 'TEACHER' }
            ]
        };
    },

    async saveUser(sessionId, userData) {
        if (isGAS) return _callGAS('saveUser', sessionId, userData);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=save_user', 'POST', { sessionId, userData });
            if (vRes) return vRes;
        }
        await this._delay(300);
        return { success: true, message: 'Akun pengguna berhasil disimpan.' };
    },

    async deleteUser(sessionId, username) {
        if (isGAS) return _callGAS('deleteUser', sessionId, username);
        if (isVercel) {
            const vRes = await _callVercel('/api/teacher?action=delete_user', 'POST', { sessionId, username });
            if (vRes) return vRes;
        }
        await this._delay(300);
        return { success: true, message: 'Akun pengguna berhasil dihapus.' };
    },

    async uploadImage(sessionId, base64Data, filename, mimeType) {
        if (isGAS) return _callGAS('uploadImage', sessionId, base64Data, filename, mimeType);

        await this._delay(600);
        // On local mock, return the base64 data as data URI so it immediately displays
        return {
            success: true,
            data: {
                url: base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`
            },
            message: 'Gambar berhasil diunggah'
        };
    }
};
