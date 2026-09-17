Router.addRoute('/dashboard', async () => {
    // Check auth
    if (!AppState.user || AppState.user.role !== 'TEACHER') {
        setTimeout(() => Router.navigate('/login'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    // Fetch exams
    const sessionId = AppState.user.sessionId;
    const res = await api.getTeacherExams(sessionId);
    const exams = res.success ? res.data : [];

    const stats = {
        total: exams.length,
        active: exams.filter(e => e.status === 'ACTIVE').length,
        participants: exams.reduce((sum, e) => sum + (e.participantCount || 0), 0)
    };

    let examListHtml = '';
    if (exams.length === 0) {
        examListHtml = `
            <div class="text-center py-8">
                <i class="ph ph-file-dashed text-muted" style="font-size: 3rem;"></i>
                <p class="text-muted mt-2">Belum ada ujian.</p>
                <p class="text-sm text-muted mb-4">Buat ujian pertama Anda untuk mulai membuat soal.</p>
                <button class="btn btn-primary" onclick="Router.navigate('/exam-editor')">
                    <i class="ph ph-plus"></i> Buat Ujian Baru
                </button>
            </div>
        `;
    } else {
        const rows = exams.map(e => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td class="py-3 px-4 font-medium">${e.title}</td>
                <td class="py-3 px-4 text-sm">${e.subject} - ${e.className}</td>
                <td class="py-3 px-4">
                    <span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>
                </td>
                <td class="py-3 px-4 text-sm text-center">${e.participantCount}</td>
                <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/exam-editor?id=${e.examId}')" title="Edit Konfigurasi">
                            <i class="ph ph-gear"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/question-builder?examId=${e.examId}')" title="Kelola Soal">
                            <i class="ph ph-list-numbers"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/results?examId=${e.examId}')" title="Lihat Hasil">
                            <i class="ph ph-chart-bar"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary" onclick="handleDuplicateExam('${e.examId}')" title="Duplikasi Ujian">
                            <i class="ph ph-copy"></i>
                        </button>
                        <button class="btn btn-icon btn-outline-primary" onclick="copyExamLink('${e.examId}')" title="Salin Link">
                            <i class="ph ph-link"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary text-error" onclick="handleDeleteExam('${e.examId}')" title="Hapus/Arsipkan">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        const mobileCards = exams.map(e => `
            <div class="exam-card-mobile">
                <div class="card-header-mobile">
                    <div>
                        <div class="exam-title-mobile">${e.title}</div>
                        <div class="meta-tags mt-2">
                            <span class="meta-tag"><i class="ph ph-book-open"></i> ${e.subject}</span>
                            <span class="meta-tag"><i class="ph ph-chalkboard-teacher"></i> ${e.className}</span>
                            <span class="meta-tag"><i class="ph ph-users"></i> ${e.participantCount} Peserta</span>
                        </div>
                    </div>
                    <div>
                        <span class="badge badge-${e.status.toLowerCase()}">${e.status}</span>
                    </div>
                </div>

                <div class="action-group-primary">
                    <button class="btn btn-primary" onclick="Router.navigate('/question-builder?examId=${e.examId}')">
                        <i class="ph ph-list-numbers"></i> Kelola Soal
                    </button>
                    <button class="btn btn-outline-primary" onclick="copyExamLink('${e.examId}')">
                        <i class="ph ph-link"></i> Salin Link
                    </button>
                </div>

                <div class="action-group-secondary">
                    <button class="btn btn-secondary" onclick="Router.navigate('/results?examId=${e.examId}')">
                        <i class="ph ph-chart-bar"></i> Hasil
                    </button>
                    <button class="btn btn-secondary" onclick="Router.navigate('/exam-editor?id=${e.examId}')">
                        <i class="ph ph-gear"></i> Edit
                    </button>
                    <button class="btn btn-secondary" onclick="handleDuplicateExam('${e.examId}')">
                        <i class="ph ph-copy"></i> Duplikat
                    </button>
                </div>

                <div class="flex justify-end pt-1" style="border-top: 1px solid var(--border-color); margin-top: 0.25rem;">
                    <button class="btn btn-link text-error text-xs" onclick="handleDeleteExam('${e.examId}')" style="padding: 0.25rem 0; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
                        <i class="ph ph-trash"></i> Hapus / Arsipkan Ujian
                    </button>
                </div>
            </div>
        `).join('');

        examListHtml = `
            <!-- Desktop Table View (>= 768px) -->
            <div class="desktop-only table-responsive">
                <table style="width: 100%; border-collapse: collapse; text-align: left; min-width: 580px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-base);">
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Judul</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Mata Pelajaran</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Status</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary text-center">Peserta</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Mobile Card View (< 768px, no horizontal scroll) -->
            <div class="mobile-only">
                ${mobileCards}
            </div>
        `;
    }

    return `
        <div class="view">
            <!-- Navbar -->
            <nav class="navbar glass">
                <div class="container flex justify-between items-center" style="gap: 0.5rem;">
                    <div class="brand" style="font-size: 1.05rem;">
                        <i class="ph ph-graduation-cap ph-fill text-primary"></i>
                        <span>Dashboard Guru</span>
                    </div>
                    <div class="flex items-center gap-2 sm:gap-3">
                        <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="copyStudentPortalLink()" title="Bagikan Link Portal Siswa (Universal)">
                            <i class="ph ph-student"></i> <span class="hidden sm-inline">Link Portal Siswa</span>
                        </button>
                        <div class="teacher-profile-chip" title="${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}">
                            <i class="ph ph-user-circle"></i>
                            <span>${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="handleLogout()" title="Keluar">
                            <i class="ph ph-sign-out"></i> <span class="hidden sm-inline">Keluar</span>
                        </button>
                    </div>
                </div>
            </nav>

            <div class="container mt-6">
                <!-- Stats -->
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="card flex items-center gap-4">
                        <div class="btn-icon" style="background-color: var(--primary-100); color: var(--primary-600); font-size: 1.5rem; padding: 0.75rem;">
                            <i class="ph ph-files"></i>
                        </div>
                        <div>
                            <p class="text-sm text-muted">Total Ujian</p>
                            <h3 style="margin: 0; font-size: 1.5rem;">${stats.total}</h3>
                        </div>
                    </div>
                    <div class="card flex items-center gap-4">
                        <div class="btn-icon" style="background-color: rgba(16, 185, 129, 0.1); color: var(--success); font-size: 1.5rem; padding: 0.75rem;">
                            <i class="ph ph-check-circle"></i>
                        </div>
                        <div>
                            <p class="text-sm text-muted">Ujian Aktif</p>
                            <h3 style="margin: 0; font-size: 1.5rem;">${stats.active}</h3>
                        </div>
                    </div>
                    <div class="card flex items-center gap-4">
                        <div class="btn-icon" style="background-color: rgba(59, 130, 246, 0.1); color: var(--info); font-size: 1.5rem; padding: 0.75rem;">
                            <i class="ph ph-users"></i>
                        </div>
                        <div>
                            <p class="text-sm text-muted">Total Peserta</p>
                            <h3 style="margin: 0; font-size: 1.5rem;">${stats.participants}</h3>
                        </div>
                    </div>
                </div>

                <!-- Exam List -->
                <div class="card">
                    <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h3 style="margin:0;">Daftar Ujian Terbaru</h3>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="copyStudentPortalLink()" title="Bagikan Link Portal Siswa ke Seluruh Siswa">
                                <i class="ph ph-share-network"></i> Link Portal Siswa
                            </button>
                            ${exams.length > 0 ? `<button class="btn btn-primary btn-sm" onclick="Router.navigate('/exam-editor')"><i class="ph ph-plus"></i> Ujian Baru</button>` : ''}
                        </div>
                    </div>
                    ${examListHtml}
                </div>
            </div>
        </div>
    `;
});

window.handleLogout = async function() {
    if (AppState.user && AppState.user.sessionId) {
        await api.logoutTeacher(AppState.user.sessionId);
    }
    AppState.update({ user: null, mode: null });
    Router.navigate('/login');
    UI.showToast('Berhasil keluar', 'success');
};

window.copyExamLink = function(examId) {
    let baseUrl = (typeof window !== 'undefined' && (window.__WEB_APP_URL__ || window.WEB_APP_URL)) || '';
    if (!baseUrl || baseUrl.indexOf('googleusercontent.com') !== -1) {
        baseUrl = ['https:', '', 'script.' + 'google.com', 'macros', 's', 'AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w', 'exec'].join('/');
    }
    const cleanBase = baseUrl.split('?')[0].split('#')[0];
    const url = cleanBase + '?exam=' + encodeURIComponent(examId);

    try {
        navigator.clipboard.writeText(url).then(() => {
            UI.showToast('Link ujian berhasil disalin ke clipboard!', 'success');
        }).catch(() => {});
    } catch (e) {}

    UI.showModal(`
        <div class="text-center">
            <div class="flex items-center justify-center text-primary mb-2">
                <i class="ph ph-link-simple" style="font-size: 3rem;"></i>
            </div>
            <h3 class="mb-2">Link Pengerjaan Siswa</h3>
            <p class="text-sm text-muted mb-4">Bagikan link ini kepada siswa untuk langsung mengakses ujian:</p>
            <div class="input-group mb-4">
                <input type="text" id="examShareLink" class="input-control text-center text-sm font-semibold" value="${url}" readonly onclick="this.select()" style="background: var(--bg-base); font-family: monospace;">
            </div>
            <div class="flex justify-center gap-2">
                <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
                <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${url}'); UI.showToast('Link berhasil disalin!', 'success'); closeModal();">
                    <i class="ph ph-copy"></i> Salin Link
                </button>
            </div>
        </div>
    `);
};

window.copyStudentPortalLink = function() {
    let baseUrl = (typeof window !== 'undefined' && (window.__WEB_APP_URL__ || window.WEB_APP_URL)) || '';
    if (!baseUrl || baseUrl.indexOf('googleusercontent.com') !== -1) {
        baseUrl = ['https:', '', 'script.' + 'google.com', 'macros', 's', 'AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w', 'exec'].join('/');
    }
    const cleanBase = baseUrl.split('?')[0].split('#')[0];
    const url = cleanBase + '?page=student';

    try {
        navigator.clipboard.writeText(url).then(() => {
            UI.showToast('Link portal siswa berhasil disalin ke clipboard!', 'success');
        }).catch(() => {});
    } catch (e) {}

    UI.showModal(`
        <div class="text-center">
            <div class="flex items-center justify-center text-primary mb-2">
                <i class="ph ph-student" style="font-size: 3rem;"></i>
            </div>
            <h3 class="mb-2">Link Portal Ujian Siswa</h3>
            <p class="text-sm text-muted mb-4">Bagikan link universal ini kepada siswa. Siswa dapat melihat semua daftar ujian aktif dari berbagai mapel tanpa perlu login:</p>
            <div class="input-group mb-4">
                <input type="text" id="studentPortalShareLink" class="input-control text-center text-sm font-semibold" value="${url}" readonly onclick="this.select()" style="background: var(--bg-base); font-family: monospace;">
            </div>
            <div class="flex justify-center gap-2">
                <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
                <a href="${url}" target="_blank" class="btn btn-secondary" style="text-decoration:none;">
                    <i class="ph ph-arrow-square-out"></i> Buka Portal
                </a>
                <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${url}'); UI.showToast('Link berhasil disalin!', 'success'); closeModal();">
                    <i class="ph ph-copy"></i> Salin Link
                </button>
            </div>
        </div>
    `);
};

window.handleDuplicateExam = async function(examId) {
    if (!confirm('Duplikasi ujian ini beserta seluruh soalnya?')) return;
    const res = await api.duplicateExam(AppState.user.sessionId, examId);
    if (res.success) {
        UI.showToast('Ujian berhasil diduplikasi!', 'success');
        Router.handleRoute(); // refresh view
    } else {
        UI.showToast(res.message || 'Gagal menduplikasi ujian', 'error');
    }
};

window.handleDeleteExam = async function(examId) {
    if (!confirm('Apakah Anda yakin ingin mengarsipkan ujian ini?')) return;
    const res = await api.deleteExam(AppState.user.sessionId, examId);
    if (res.success) {
        UI.showToast('Ujian berhasil diarsipkan', 'success');
        Router.handleRoute(); // refresh view
    } else {
        UI.showToast(res.message || 'Gagal menghapus ujian', 'error');
    }
};
