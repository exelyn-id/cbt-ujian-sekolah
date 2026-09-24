Router.addRoute('/dashboard', async () => {
    // Check auth (supports both TEACHER and ADMIN)
    if (!AppState.user || (AppState.user.role !== 'TEACHER' && AppState.user.role !== 'ADMIN')) {
        setTimeout(() => Router.navigate('/login'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const isAdmin = AppState.user && AppState.user.role === 'ADMIN';

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
                <td class="py-3 px-4 font-medium">
                    <div style="line-height: 1.35;">${escapeHtml(e.title)}</div>
                    ${isAdmin && e.ownerTeacherName ? `<div class="text-xs text-muted font-normal mt-0.5 flex items-center gap-1"><i class="ph ph-chalkboard-teacher"></i> ${escapeHtml(e.ownerTeacherName)}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-sm">${escapeHtml(e.subject)} - ${escapeHtml(e.className)}</td>
                <td class="py-3 px-4">
                    <span class="badge badge-${(e.status || '').toLowerCase()}">${e.status}</span>
                </td>
                <td class="py-3 px-4 text-center">
                    <button class="btn btn-sm ${e.showInPortal !== false ? 'btn-portal-active' : 'btn-portal-inactive'}"
                            id="portal-btn-${e.examId}"
                            onclick="${isAdmin ? `handleTogglePortal('${e.examId}', ${e.showInPortal !== false})` : ''}"
                            title="${isAdmin ? (e.showInPortal !== false ? 'Klik untuk sembunyikan dari portal siswa' : 'Klik untuk tampilkan di portal siswa') : (e.showInPortal !== false ? 'Tampil di portal siswa' : 'Disembunyikan dari portal siswa')}"
                            ${!isAdmin ? 'disabled style="cursor: default;"' : ''}
                            style="padding: 0.25rem 0.65rem; font-size: 0.75rem; border-radius: var(--radius-full); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="ph ${e.showInPortal !== false ? 'ph-eye' : 'ph-eye-slash'}"></i>
                        <span>${e.showInPortal !== false ? 'Tampil' : 'Sembunyi'}</span>
                    </button>
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
                        <button class="btn btn-icon btn-secondary text-success" onclick="downloadExamQuestionsFromDashboard('${e.examId}', '${escapeHtml(e.title)}')" title="Download Soal Excel (.xlsx)">
                            <i class="ph ph-file-arrow-down"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary" style="color: var(--primary-600);" onclick="downloadExamResultsFromDashboard('${e.examId}', '${escapeHtml(e.title)}')" title="Download Hasil Ujian Siswa (.xlsx)">
                            <i class="ph ph-microsoft-excel-logo"></i>
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
                        <div class="exam-title-mobile">${escapeHtml(e.title)}</div>
                        ${isAdmin && e.ownerTeacherName ? `<div class="text-xs text-muted mt-0.5"><i class="ph ph-chalkboard-teacher"></i> Guru: <strong>${escapeHtml(e.ownerTeacherName)}</strong></div>` : ''}
                        <div class="meta-tags mt-2">
                            <span class="meta-tag"><i class="ph ph-book-open"></i> ${escapeHtml(e.subject)}</span>
                            <span class="meta-tag"><i class="ph ph-chalkboard-teacher"></i> ${escapeHtml(e.className)}</span>
                            <span class="meta-tag"><i class="ph ph-users"></i> ${e.participantCount} Peserta</span>
                        </div>
                    </div>
                    <div>
                        <span class="badge badge-${(e.status || '').toLowerCase()}">${e.status}</span>
                    </div>
                </div>

                <!-- Visibilitas di Portal Siswa -->
                <div class="flex justify-between items-center py-2 px-2.5 my-2.5" style="background: var(--bg-base); border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.8rem;">
                    <span class="text-secondary font-medium flex items-center gap-1.5">
                        <i class="ph ph-squares-four text-primary"></i> Portal Siswa:
                    </span>
                    <button class="btn btn-sm ${e.showInPortal !== false ? 'btn-portal-active' : 'btn-portal-inactive'}"
                            id="mobile-portal-btn-${e.examId}"
                            onclick="${isAdmin ? `handleTogglePortal('${e.examId}', ${e.showInPortal !== false})` : ''}"
                            title="${isAdmin ? 'Klik untuk mengubah visibilitas di portal siswa' : ''}"
                            ${!isAdmin ? 'disabled style="cursor: default;"' : ''}
                            style="padding: 0.25rem 0.65rem; font-size: 0.76rem; border-radius: var(--radius-full); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="ph ${e.showInPortal !== false ? 'ph-eye' : 'ph-eye-slash'}"></i>
                        <span>${e.showInPortal !== false ? 'Tampil di Portal' : 'Disembunyikan'}</span>
                    </button>
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

                <div class="action-group-secondary" style="margin-top: 0.35rem;">
                    <button class="btn btn-secondary text-success" onclick="downloadExamQuestionsFromDashboard('${e.examId}', '${escapeHtml(e.title)}')">
                        <i class="ph ph-file-arrow-down"></i> Soal (.xlsx)
                    </button>
                    <button class="btn btn-secondary text-primary" onclick="downloadExamResultsFromDashboard('${e.examId}', '${escapeHtml(e.title)}')">
                        <i class="ph ph-microsoft-excel-logo"></i> Hasil (.xlsx)
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
                <table style="width: 100%; border-collapse: collapse; text-align: left; min-width: 650px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-base);">
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Judul</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Mata Pelajaran</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary">Status</th>
                            <th class="py-3 px-4 text-sm font-semibold text-secondary text-center">Portal Siswa</th>
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
                        <span>${isAdmin ? 'Dashboard Admin CBT' : 'Dashboard Guru'}</span>
                    </div>
                    <div class="flex items-center gap-2 sm:gap-3">
                        ${isAdmin ? `
                            <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="openUserManagementModal()" title="Kelola Akun Guru & Administrator">
                                <i class="ph ph-users-three"></i> <span class="hidden sm-inline">Kelola Pengguna</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="copyStudentPortalLink()" title="Bagikan Link Portal Siswa (Universal)">
                            <i class="ph ph-student"></i> <span class="hidden sm-inline">Link Portal Siswa</span>
                        </button>
                        <div class="teacher-profile-chip" title="${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}">
                            <i class="ph ph-user-circle"></i>
                            <span>${isAdmin ? '<span style="background: var(--primary-100); color: var(--primary-700); font-size: 0.68rem; font-weight: 800; padding: 1px 5px; border-radius: 4px; margin-right: 3px;">ADMIN</span>' : ''}${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="handleLogout()" title="Keluar">
                            <i class="ph ph-sign-out"></i> <span class="hidden sm-inline">Keluar</span>
                        </button>
                    </div>
                </div>
            </nav>

            <div class="container mt-6">
                ${isAdmin ? `
                    <div class="card mb-4 p-3.5 flex items-center justify-between" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); font-size: 0.85rem; color: #166534; flex-wrap: wrap; gap: 0.75rem;">
                        <div class="flex items-center gap-2.5">
                            <i class="ph ph-shield-check text-success" style="font-size: 1.6rem; flex-shrink: 0;"></i>
                            <div>
                                <div class="font-bold">Mode Pengelolaan Administrator</div>
                                <div class="text-xs text-secondary mt-0.5">
                                    Sebagai Administrator, Anda dapat mengelola seluruh ujian, akun pengguna (guru & admin), dan menyinkronkan data dengan Google Spreadsheet.
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button class="btn btn-primary btn-sm flex items-center gap-1.5" onclick="openUserManagementModal()" style="font-weight: 600;">
                                <i class="ph ph-users-three"></i> Kelola Pengguna
                            </button>
                            <button class="btn btn-outline-secondary btn-sm flex items-center gap-1.5" onclick="handleSyncPullFromSheets()" style="background: #ffffff;" title="Tarik seluruh data dari Google Spreadsheet ke Vercel Database">
                                <i class="ph ph-cloud-arrow-down"></i> Tarik Data Sheets
                            </button>
                            <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="copyStudentPortalLink()" style="background: #ffffff;">
                                <i class="ph ph-share-network"></i> Link Portal Siswa
                            </button>
                        </div>
                    </div>
                ` : ''}
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

window.handleTogglePortal = async function(examId, currentStatus) {
    if (!AppState.user || AppState.user.role !== 'ADMIN') {
        UI.showToast('Hanya akun Admin yang berwenang mengubah visibilitas ujian di portal.', 'warning');
        return;
    }
    const newStatus = !currentStatus;
    const btn1 = document.getElementById('portal-btn-' + examId);
    const btn2 = document.getElementById('mobile-portal-btn-' + examId);

    // Optimistic UI update (instant visual feedback <1ms)
    function updateBtnVisual(btn, status) {
        if (!btn) return;
        btn.className = `btn btn-sm ${status ? 'btn-portal-active' : 'btn-portal-inactive'}`;
        btn.innerHTML = `<i class="ph ${status ? 'ph-eye' : 'ph-eye-slash'}"></i> <span>${status ? 'Tampil' : 'Sembunyi'}</span>`;
        btn.setAttribute('onclick', `handleTogglePortal('${examId}', ${status})`);
        btn.disabled = false;
    }

    updateBtnVisual(btn1, newStatus);
    updateBtnVisual(btn2, newStatus);

    try {
        const res = await api.toggleExamPortalVisibility(AppState.user.sessionId, examId, newStatus);
        if (res.success) {
            UI.showToast(res.message || (newStatus ? 'Ujian kini ditampilkan di Portal Siswa.' : 'Ujian disembunyikan dari Portal Siswa.'), 'success');
        } else {
            // Revert on error
            updateBtnVisual(btn1, currentStatus);
            updateBtnVisual(btn2, currentStatus);
            UI.showToast(res.message || 'Gagal mengubah visibilitas.', 'error');
        }
    } catch (err) {
        updateBtnVisual(btn1, currentStatus);
        updateBtnVisual(btn2, currentStatus);
        UI.showToast('Terjadi kesalahan koneksi.', 'error');
    }
};

// ============================================================================
// USER MANAGEMENT MODAL (Vercel Primary DB + Google Sheets Backup Mirror)
// ============================================================================
window.openUserManagementModal = async function() {
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    if (!modalContainer || !modalBody) return;

    modalBody.innerHTML = `
        <div style="padding: 1.5rem; max-width: 680px; width: 100%;">
            <div class="flex justify-between items-center mb-4 pb-3" style="border-bottom: 1px solid var(--border-color);">
                <div class="flex items-center gap-2.5">
                    <div class="btn-icon" style="background: var(--primary-100); color: var(--primary-700); width: 38px; height: 38px; font-size: 1.3rem;">
                        <i class="ph ph-users-three"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem;">Kelola Pengguna Sistem</h3>
                        <p class="text-xs text-muted" style="margin: 2px 0 0 0;">Tambah dan atur akun Guru atau Administrator CBT</p>
                    </div>
                </div>
                <button class="btn-icon btn-secondary" onclick="closeModal()" title="Tutup"><i class="ph ph-x"></i></button>
            </div>

            <!-- Form Tambah Pengguna Baru -->
            <div class="card p-3.5 mb-4" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <h4 style="margin: 0 0 0.75rem 0; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
                    <i class="ph ph-user-plus text-primary"></i> Tambah Pengguna Baru
                </h4>
                <form id="add-user-form" onsubmit="handleAddUserSubmit(event)">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="form-label text-xs">Nama Lengkap & Gelar</label>
                            <input type="text" id="new-user-name" class="form-control text-sm" placeholder="Contoh: Pak Budi Santoso, S.Pd" required>
                        </div>
                        <div>
                            <label class="form-label text-xs">Username (Login)</label>
                            <input type="text" id="new-user-username" class="form-control text-sm" placeholder="Contoh: budi" required autocomplete="off">
                        </div>
                        <div>
                            <label class="form-label text-xs">Password</label>
                            <input type="text" id="new-user-password" class="form-control text-sm" placeholder="Minimal 6 karakter" required autocomplete="new-password">
                        </div>
                        <div>
                            <label class="form-label text-xs">Peran / Hak Akses (Role)</label>
                            <select id="new-user-role" class="form-control text-sm" required>
                                <option value="TEACHER">Guru / Pengajar</option>
                                <option value="ADMIN">Administrator Sistem</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" id="btn-save-user" class="btn btn-primary btn-sm flex items-center gap-1.5 font-medium">
                            <i class="ph ph-plus-circle"></i> Simpan Pengguna
                        </button>
                    </div>
                </form>
            </div>

            <!-- Daftar Pengguna Terdaftar -->
            <div class="card p-0" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
                <div class="p-3 flex justify-between items-center" style="background: var(--bg-hover); border-bottom: 1px solid var(--border-color);">
                    <h4 style="margin: 0; font-size: 0.88rem;" class="font-semibold">Daftar Pengguna Terdaftar</h4>
                    <span id="user-count-badge" class="badge badge-info text-xs">0 Pengguna</span>
                </div>
                <div id="users-table-container" style="max-height: 250px; overflow-y: auto;">
                    <div class="text-center py-6">
                        <i class="ph ph-spinner ph-spin text-primary" style="font-size: 1.5rem;"></i>
                        <p class="text-xs text-muted mt-1.5">Memuat data pengguna...</p>
                    </div>
                </div>
            </div>

            <div class="flex justify-between items-center mt-4 pt-3" style="border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
                <button class="btn btn-outline-secondary btn-sm flex items-center gap-1.5 text-xs" onclick="handleSyncPullFromSheets()" title="Tarik data terbaru dari Google Spreadsheet">
                    <i class="ph ph-cloud-arrow-down"></i> Tarik Data dari Spreadsheet
                </button>
                <button class="btn btn-secondary btn-sm" onclick="closeModal()">Selesai</button>
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');

    await loadAndRenderUsersList();
};

window.loadAndRenderUsersList = async function() {
    const container = document.getElementById('users-table-container');
    const badge = document.getElementById('user-count-badge');
    if (!container) return;

    try {
        const res = await api.getUsers(AppState.user ? AppState.user.sessionId : '');
        const users = (res && res.success && Array.isArray(res.data)) ? res.data : [];
        if (badge) badge.innerText = `${users.length} Pengguna`;

        if (users.length === 0) {
            container.innerHTML = `<div class="text-center py-6 text-xs text-muted">Belum ada data pengguna.</div>`;
            return;
        }

        container.innerHTML = `
            <table class="w-full text-left" style="font-size: 0.85rem; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-surface);">
                        <th class="py-2 px-3 text-xs text-muted">Nama Lengkap</th>
                        <th class="py-2 px-3 text-xs text-muted">Username</th>
                        <th class="py-2 px-3 text-xs text-muted text-center">Peran</th>
                        <th class="py-2 px-3 text-xs text-muted text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td class="py-2.5 px-3 font-medium">
                                <div>${escapeHtml(u.name || u.username)}</div>
                                <div class="text-xs text-muted">${escapeHtml(u.userId || '')}</div>
                            </td>
                            <td class="py-2.5 px-3"><code>${escapeHtml(u.username)}</code></td>
                            <td class="py-2.5 px-3 text-center">
                                <span class="badge ${u.role === 'ADMIN' ? 'badge-primary' : 'badge-active'}" style="font-size: 0.7rem; font-weight: 700;">
                                    ${u.role || 'TEACHER'}
                                </span>
                            </td>
                            <td class="py-2.5 px-3 text-center">
                                ${u.username !== 'admin' && (AppState.user && AppState.user.username !== u.username) ? `
                                    <button class="btn btn-icon btn-sm text-danger" onclick="handleDeleteUser('${escapeHtml(u.username)}', '${escapeHtml(u.userId || '')}')" title="Hapus Pengguna" style="padding: 4px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;">
                                        <i class="ph ph-trash"></i>
                                    </button>
                                ` : '<span class="text-xs text-muted">-</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = `<div class="text-center py-4 text-xs text-danger">Gagal memuat pengguna: ${escapeHtml(e.message)}</div>`;
    }
};

window.handleAddUserSubmit = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-user');
    const nameInput = document.getElementById('new-user-name');
    const usernameInput = document.getElementById('new-user-username');
    const passwordInput = document.getElementById('new-user-password');
    const roleSelect = document.getElementById('new-user-role');

    if (!usernameInput || !nameInput || !passwordInput) return;
    const name = nameInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    const role = roleSelect ? roleSelect.value : 'TEACHER';

    if (!name || !username || !password) {
        UI.showToast('Semua field wajib diisi!', 'warning');
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...'; }

    try {
        const res = await api.saveUser(AppState.user ? AppState.user.sessionId : '', {
            name: name,
            username: username,
            password: password,
            role: role
        });

        if (res && res.success) {
            UI.showToast(`Pengguna "${username}" berhasil disimpan & dicadangkan ke Sheets!`, 'success');
            nameInput.value = '';
            usernameInput.value = '';
            passwordInput.value = '';
            await loadAndRenderUsersList();
        } else {
            UI.showToast((res && res.message) || 'Gagal menyimpan pengguna.', 'error');
        }
    } catch (err) {
        UI.showToast('Terjadi kesalahan: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-plus-circle"></i> Simpan Pengguna'; }
    }
};

window.handleDeleteUser = async function(username, userId) {
    if (!confirm(`Hapus pengguna "${username}"? Pengguna tidak akan dapat login lagi.`)) return;

    try {
        const res = await api.deleteUser(AppState.user ? AppState.user.sessionId : '', username, userId);
        if (res && res.success) {
            UI.showToast(`Pengguna "${username}" berhasil dihapus.`, 'success');
            await loadAndRenderUsersList();
        } else {
            UI.showToast((res && res.message) || 'Gagal menghapus pengguna.', 'error');
        }
    } catch (err) {
        UI.showToast('Terjadi kesalahan: ' + err.message, 'error');
    }
};

window.handleSyncPullFromSheets = async function() {
    if (!confirm('Tarik seluruh database terbaru dari Google Spreadsheet ke Vercel Database? Ini akan memperbarui akun guru, daftar ujian, dan bank soal.')) return;

    UI.showToast('Sedang menarik database dari Google Spreadsheet...', 'info');

    try {
        const res = await api.syncPullFromSheets(AppState.user ? AppState.user.sessionId : '');
        if (res && res.success) {
            UI.showToast(res.message || 'Database berhasil disinkronkan dari Google Spreadsheet!', 'success');
            if (typeof loadAndRenderUsersList === 'function') {
                loadAndRenderUsersList();
            }
            setTimeout(() => {
                Router.handleRoute(); // refresh dashboard
            }, 800);
        } else {
            UI.showToast((res && res.message) || 'Gagal menarik data dari Spreadsheet.', 'error');
        }
    } catch (err) {
        UI.showToast('Terjadi kesalahan: ' + err.message, 'error');
    }
};

