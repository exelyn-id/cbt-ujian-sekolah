// ============================================================================
// API Endpoint: /api/teacher (Teacher Operations & Operational Database Gateway)
// Primary Operational Database: Vercel KV / Upstash Redis (<20ms response)
// Secondary Backup Mirror: Google Spreadsheet via Google Apps Script (Async)
// ============================================================================
const { callGoogleAppsScript } = require('./_sheets');
const { kv } = require('./_redis');

/**
 * Fire-and-forget background sync to Google Spreadsheet
 */
function syncToSheetsBackground(action, payload) {
    callGoogleAppsScript(action, payload)
        .then(res => console.log(`[Backup Sync Success] ${action}:`, res ? res.message : 'OK'))
        .catch(err => console.error(`[Backup Sync Error] ${action}:`, err.message));
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const action = req.query.action || (req.body && req.body.action);
        if (!action) {
            return res.status(400).json({ success: false, message: 'Action parameter is required' });
        }

        // ====================================================================
        // 1. TEACHER AUTHENTICATION (Sub-20ms from Vercel KV)
        // ====================================================================
        if (action === 'login_teacher') {
            const { username, password } = req.body || {};
            const u = String(username || '').trim().toLowerCase();
            const p = String(password || '').trim();

            let users = await kv.get('db:users');
            if (!users || !Array.isArray(users) || users.length === 0) {
                // Initial bootstrap from Google Apps Script
                const gasRes = await callGoogleAppsScript('get_all_database');
                if (gasRes && gasRes.success && gasRes.data && Array.isArray(gasRes.data.users)) {
                    users = gasRes.data.users;
                    await kv.set('db:users', users);
                    if (Array.isArray(gasRes.data.exams)) await kv.set('db:exams', gasRes.data.exams);
                    if (gasRes.data.questions) {
                        for (const exId of Object.keys(gasRes.data.questions)) {
                            await kv.set(`db:questions:${exId}`, gasRes.data.questions[exId]);
                        }
                    }
                }
            }

            // Fallback default users if still empty
            if (!users || users.length === 0) {
                users = [
                    { userId: 'ADM_001', username: 'admin', password: 'admin123', name: 'Administrator Sistem', role: 'ADMIN', status: 'ACTIVE' },
                    { userId: 'TCH_001', username: 'andi', password: '123456', name: 'Pak Andi Prasetyo, S.Kom', role: 'TEACHER', status: 'ACTIVE' },
                    { userId: 'TCH_002', username: 'budi', password: 'guru123', name: 'Pak Budi Santoso, S.Pd', role: 'TEACHER', status: 'ACTIVE' },
                    { userId: 'TCH_003', username: 'siti', password: 'guru123', name: 'Ibu Siti Rahmawati, M.Pd', role: 'TEACHER', status: 'ACTIVE' },
                    { userId: 'TCH_004', username: 'dewi', password: 'guru123', name: 'Ibu Dewi Lestari, M.Kom', role: 'TEACHER', status: 'ACTIVE' }
                ];
                await kv.set('db:users', users);
            }

            const found = users.find(user => String(user.username || '').toLowerCase() === u && String(user.password || '') === p);
            if (!found) {
                return res.status(200).json({ success: false, message: 'Username atau password salah.' });
            }
            if (found.status === 'INACTIVE') {
                return res.status(200).json({ success: false, message: 'Akun Anda dinonaktifkan.' });
            }

            const sessionId = 'SES_' + u + '_' + Date.now();
            const sessionData = {
                sessionId: sessionId,
                teacherId: found.userId || found.id,
                teacherName: found.name,
                username: found.username,
                role: found.role || 'TEACHER'
            };
            await kv.set(`session:${sessionId}`, sessionData, { ex: 86400 });

            return res.status(200).json({
                success: true,
                data: sessionData,
                message: 'Login berhasil'
            });
        }

        // ====================================================================
        // 2. EXAM CRUD & MANAGEMENT (Instant read/write, async Sheets sync)
        // ====================================================================
        if (action === 'get_teacher_exams') {
            let exams = await kv.get('db:exams');
            if (!exams || !Array.isArray(exams) || exams.length === 0) {
                const gasRes = await callGoogleAppsScript('get_teacher_exams', req.body || {});
                if (gasRes && gasRes.success && Array.isArray(gasRes.data)) {
                    exams = gasRes.data;
                    await kv.set('db:exams', exams);
                } else {
                    exams = [];
                }
            }
            return res.status(200).json({ success: true, data: exams });
        }

        if (action === 'save_exam') {
            const { examData } = req.body || {};
            if (!examData) return res.status(400).json({ success: false, message: 'Data ujian wajib diisi.' });

            let exams = (await kv.get('db:exams')) || [];
            if (!Array.isArray(exams)) exams = [];

            let examId = examData.examId;
            if (examId) {
                const idx = exams.findIndex(e => e.examId === examId);
                if (idx !== -1) {
                    exams[idx] = { ...exams[idx], ...examData, updatedAt: new Date().toISOString() };
                } else {
                    exams.unshift({ ...examData, updatedAt: new Date().toISOString() });
                }
            } else {
                examId = 'EXM_' + Math.floor(Math.random() * 90000 + 10000);
                examData.examId = examId;
                examData.participantCount = 0;
                examData.avgScore = 0;
                examData.createdAt = new Date().toISOString();
                exams.unshift(examData);
            }

            await kv.set('db:exams', exams);
            await kv.del('exams:active_list');

            // Asynchronously mirror to Google Sheets in background
            syncToSheetsBackground('save_exam', req.body);

            return res.status(200).json({
                success: true,
                data: { examId: examId },
                message: 'Ujian berhasil disimpan.'
            });
        }

        if (action === 'toggle_exam_portal') {
            const { examId, showInPortal } = req.body || {};
            let exams = (await kv.get('db:exams')) || [];
            if (!Array.isArray(exams)) exams = [];

            const exam = exams.find(e => e.examId === examId);
            let newVis = true;
            if (exam) {
                newVis = (showInPortal !== undefined) ? Boolean(showInPortal) : (exam.showInPortal === false);
                exam.showInPortal = newVis;
                await kv.set('db:exams', exams);
            }
            await kv.del('exams:active_list');

            // Asynchronously mirror to Google Sheets in background
            syncToSheetsBackground('toggle_exam_portal', req.body);

            return res.status(200).json({
                success: true,
                data: { examId, showInPortal: newVis },
                message: 'Visibilitas portal berhasil ' + (newVis ? 'diaktifkan (Tampil).' : 'dinonaktifkan (Disembunyikan).')
            });
        }

        if (action === 'delete_exam') {
            const { examId } = req.body || {};
            let exams = (await kv.get('db:exams')) || [];
            if (!Array.isArray(exams)) exams = [];

            const exam = exams.find(e => e.examId === examId);
            if (exam) {
                exam.status = 'ARCHIVED';
                await kv.set('db:exams', exams);
            }
            await kv.del('exams:active_list');

            syncToSheetsBackground('delete_exam', req.body);

            return res.status(200).json({ success: true, message: 'Ujian berhasil diarsipkan.' });
        }

        // ====================================================================
        // 3. QUESTIONS MANAGEMENT (Instant KV read/write, async Sheets sync)
        // ====================================================================
        if (action === 'get_questions') {
            const { examId } = req.body || req.query || {};
            let qList = await kv.get(`db:questions:${examId}`);
            if (!qList || !Array.isArray(qList) || qList.length === 0) {
                const gasRes = await callGoogleAppsScript('get_questions', { examId });
                if (gasRes && gasRes.success && gasRes.data) {
                    qList = gasRes.data.questions || [];
                    await kv.set(`db:questions:${examId}`, qList);
                } else {
                    qList = [];
                }
            }
            return res.status(200).json({ success: true, data: qList });
        }

        if (action === 'save_questions') {
            const { examId, questionsList } = req.body || {};
            await kv.set(`db:questions:${examId}`, questionsList || []);

            // Also update full exam cache for students
            let exams = (await kv.get('db:exams')) || [];
            const ex = exams.find(e => e.examId === examId);
            if (ex) {
                ex.totalQuestions = (questionsList || []).length;
                await kv.set('db:exams', exams);
                await kv.set(`exam:full:${examId}`, {
                    ...ex,
                    questions: questionsList || []
                }, { ex: 86400 });
            }
            await kv.del('exams:active_list');

            // Mirror to Google Sheets in background
            syncToSheetsBackground('save_questions', req.body);

            return res.status(200).json({ success: true, message: 'Soal berhasil disimpan.' });
        }

        // ====================================================================
        // 4. USER MANAGEMENT (Directly from Vercel Web App)
        // ====================================================================
        if (action === 'get_users') {
            let users = await kv.get('db:users');
            if (!users || !Array.isArray(users) || users.length === 0) {
                const gasRes = await callGoogleAppsScript('get_all_database');
                if (gasRes && gasRes.success && gasRes.data && Array.isArray(gasRes.data.users)) {
                    users = gasRes.data.users;
                    await kv.set('db:users', users);
                } else {
                    users = [];
                }
            }
            const safeUsers = (users || []).map(u => ({
                userId: u.userId,
                username: u.username,
                name: u.name,
                role: u.role || 'TEACHER',
                status: u.status || 'ACTIVE'
            }));
            return res.status(200).json({ success: true, data: safeUsers });
        }

        if (action === 'save_user') {
            const { user } = req.body || {};
            if (!user || !user.username) {
                return res.status(400).json({ success: false, message: 'Username pengguna wajib diisi.' });
            }

            let users = (await kv.get('db:users')) || [];
            if (!Array.isArray(users)) users = [];

            const uName = String(user.username).trim().toLowerCase();
            const existingIdx = users.findIndex(u => String(u.username).trim().toLowerCase() === uName);

            const role = user.role ? String(user.role).toUpperCase() : (uName === 'admin' ? 'ADMIN' : 'TEACHER');
            const userId = user.userId || ((role === 'ADMIN' ? 'ADM_' : 'TCH_') + Math.floor(Math.random() * 90000 + 10000));
            const now = new Date().toISOString();

            const fullUser = {
                userId: userId,
                username: uName,
                password: String(user.password || '123456').trim(),
                name: user.name || user.fullName || uName,
                role: role,
                status: user.status || 'ACTIVE',
                updatedAt: now
            };

            if (existingIdx !== -1) {
                users[existingIdx] = { ...users[existingIdx], ...fullUser };
            } else {
                fullUser.createdAt = now;
                users.push(fullUser);
            }

            await kv.set('db:users', users);

            // Mirror to Google Sheets in background
            syncToSheetsBackground('save_user', { user: fullUser });

            return res.status(200).json({
                success: true,
                data: {
                    userId: fullUser.userId,
                    username: fullUser.username,
                    name: fullUser.name,
                    role: fullUser.role,
                    status: fullUser.status
                },
                message: 'Pengguna berhasil disimpan.'
            });
        }

        if (action === 'delete_user') {
            const { username, userId } = req.body || {};
            let users = (await kv.get('db:users')) || [];
            if (!Array.isArray(users)) users = [];

            const uName = String(username || '').trim().toLowerCase();
            users = users.filter(u => String(u.username || '').toLowerCase() !== uName && u.userId !== userId);
            await kv.set('db:users', users);

            // Mirror to Google Sheets in background
            syncToSheetsBackground('delete_user', { username: uName, userId });

            return res.status(200).json({ success: true, message: 'Pengguna berhasil dihapus.' });
        }

        // ====================================================================
        // 5. DATABASE ONE-CLICK SYNC (Pull everything from Sheets to Vercel)
        // ====================================================================
        if (action === 'sync_pull_from_sheets') {
            const gasRes = await callGoogleAppsScript('get_all_database');
            if (!gasRes || !gasRes.success || !gasRes.data) {
                return res.status(500).json({
                    success: false,
                    message: (gasRes && gasRes.message) || 'Gagal menarik data dari Google Spreadsheet.'
                });
            }

            const { users, exams, questions } = gasRes.data;
            if (Array.isArray(users)) await kv.set('db:users', users);
            if (Array.isArray(exams)) await kv.set('db:exams', exams);
            if (questions && typeof questions === 'object') {
                for (const exId of Object.keys(questions)) {
                    await kv.set(`db:questions:${exId}`, questions[exId]);
                    const ex = (exams || []).find(e => e.examId === exId);
                    if (ex) {
                        await kv.set(`exam:full:${exId}`, {
                            ...ex,
                            questions: questions[exId]
                        }, { ex: 86400 });
                    }
                }
            }
            await kv.del('exams:active_list');

            return res.status(200).json({
                success: true,
                message: `Berhasil menarik database dari Google Spreadsheet (${(users || []).length} pengguna, ${(exams || []).length} ujian).`
            });
        }

        // Default forward for any other action (e.g. get_exam_results)
        const gasRes = await callGoogleAppsScript(action, req.body || req.query);
        return res.status(200).json(gasRes || { success: false, message: 'No response from Google Apps Script' });
    } catch (err) {
        console.error('API /api/teacher error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server guru: ' + err.message
        });
    }
};
