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
                                    Sebagai Administrator, Anda dapat mengelola seluruh ujian dan menentukan ujian mana saja yang ditampilkan di <strong>Portal Siswa</strong> via tombol di kolom <em>Portal Siswa</em>.
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="openUserManagementModal()" style="background: #ffffff;">
                                <i class="ph ph-users-three"></i> Kelola Pengguna (Guru/Admin)
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
                            ${isAdmin ? `
                                <button class="btn btn-outline-primary btn-sm flex items-center gap-1.5" onclick="openUserManagementModal()" title="Kelola Akun Guru & Administrator">
                                    <i class="ph ph-users-three"></i> Kelola Pengguna
                                </button>
                            ` : ''}
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
    let baseUrl = '';
    const isGoogleScript = typeof window !== 'undefined' && window.location.hostname && (
        window.location.hostname.includes('script.google.com') ||
        window.location.hostname.includes('googleusercontent.com')
    );
    if (!isGoogleScript && typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
        baseUrl = window.location.origin + window.location.pathname;
    } else {
        baseUrl = (typeof window !== 'undefined' && (window.__WEB_APP_URL__ || window.WEB_APP_URL)) || '';
        if (!baseUrl || baseUrl.indexOf('googleusercontent.com') !== -1) {
            baseUrl = ['https:', '', 'script.' + 'google.com', 'macros', 's', 'AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w', 'exec'].join('/');
        }
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
    let baseUrl = '';
    const isGoogleScript = typeof window !== 'undefined' && window.location.hostname && (
        window.location.hostname.includes('script.google.com') ||
        window.location.hostname.includes('googleusercontent.com')
    );
    if (!isGoogleScript && typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
        baseUrl = window.location.origin + window.location.pathname;
    } else {
        baseUrl = (typeof window !== 'undefined' && (window.__WEB_APP_URL__ || window.WEB_APP_URL)) || '';
        if (!baseUrl || baseUrl.indexOf('googleusercontent.com') !== -1) {
            baseUrl = ['https:', '', 'script.' + 'google.com', 'macros', 's', 'AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w', 'exec'].join('/');
        }
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
    const btn1 = document.getElementById('portal-btn-' + examId);
    const btn2 = document.getElementById('mobile-portal-btn-' + examId);
    if (btn1) { btn1.disabled = true; btn1.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...'; }
    if (btn2) { btn2.disabled = true; btn2.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...'; }

    try {
        const newStatus = !currentStatus;
        const res = await api.toggleExamPortalVisibility(AppState.user.sessionId, examId, newStatus);
        if (res.success) {
            UI.showToast(res.message || (newStatus ? 'Ujian kini ditampilkan di Portal Siswa.' : 'Ujian disembunyikan dari Portal Siswa.'), 'success');
            Router.handleRoute();
        } else {
            UI.showToast(res.message || 'Gagal mengubah visibilitas.', 'error');
            if (btn1) btn1.disabled = false;
            if (btn2) btn2.disabled = false;
        }
    } catch (err) {
        UI.showToast('Terjadi kesalahan koneksi.', 'error');
        if (btn1) btn1.disabled = false;
        if (btn2) btn2.disabled = false;
    }
};

window.openUserManagementModal = async function() {
    if (!AppState.user || AppState.user.role !== 'ADMIN') {
        UI.showToast('Hanya administrator yang dapat mengelola pengguna.', 'warning');
        return;
    }

    UI.showModal(`
        <div class="text-center py-6">
            <i class="ph ph-spinner ph-spin text-primary" style="font-size: 2.5rem;"></i>
            <p class="mt-3 text-sm text-muted">Memuat data pengguna...</p>
        </div>
    `);

    try {
        const res = await api.getUsers(AppState.user.sessionId);
        const users = (res && res.success && Array.isArray(res.data)) ? res.data : [];

        const renderModalContent = (userList) => {
            return `
                <div style="max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="flex justify-between items-center mb-4 pb-3" style="border-bottom: 1px solid var(--border-color);">
                        <div>
                            <h3 style="margin:0; font-size: 1.2rem; color: var(--text-primary);">Kelola Pengguna (Guru & Admin)</h3>
                            <p class="text-xs text-muted mt-0.5">Tambah akun guru langsung dari Vercel Database</p>
                        </div>
                        <button class="btn btn-icon btn-secondary btn-sm" onclick="closeModal()">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>

                    <!-- Form Tambah User -->
                    <div class="card mb-4 p-3" style="background: var(--bg-base); border: 1px solid var(--border-color);">
                        <h4 class="text-xs font-bold uppercase mb-2 text-primary flex items-center gap-1.5">
                            <i class="ph ph-user-plus"></i> Tambah Akun Baru
                        </h4>
                        <form id="addUserForm" onsubmit="handleCreateUser(event)" class="grid grid-cols-2 gap-2 text-xs">
                            <div class="input-group" style="margin-bottom: 0;">
                                <label class="input-label" style="font-size: 0.72rem;">Username *</label>
                                <input type="text" id="newUsername" class="input-control" placeholder="Contoh: guru_fisika" required style="padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                            </div>
                            <div class="input-group" style="margin-bottom: 0;">
                                <label class="input-label" style="font-size: 0.72rem;">Password *</label>
                                <input type="text" id="newPassword" class="input-control" placeholder="Minimal 6 karakter" required style="padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                            </div>
                            <div class="input-group" style="margin-bottom: 0;">
                                <label class="input-label" style="font-size: 0.72rem;">Nama Lengkap Guru *</label>
                                <input type="text" id="newName" class="input-control" placeholder="Nama & Gelar" required style="padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                            </div>
                            <div class="input-group" style="margin-bottom: 0;">
                                <label class="input-label" style="font-size: 0.72rem;">Peran (Role) *</label>
                                <select id="newRole" class="input-control" style="padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                                    <option value="TEACHER">GURU (Pengampu Mapel)</option>
                                    <option value="ADMIN">ADMINISTRATOR (Akses Penuh)</option>
                                </select>
                            </div>
                            <div style="grid-column: span 2;" class="flex justify-end mt-1">
                                <button type="submit" id="btnSaveNewUser" class="btn btn-primary btn-sm flex items-center gap-1" style="font-size: 0.78rem;">
                                    <i class="ph ph-plus-circle"></i> Tambah Akun
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Tabel Daftar User -->
                    <div style="overflow-y: auto; flex-grow: 1;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                            <thead>
                                <tr style="background: var(--bg-base); border-bottom: 2px solid var(--border-color);">
                                    <th style="padding: 8px 10px;">Username</th>
                                    <th style="padding: 8px 10px;">Nama Pengguna</th>
                                    <th style="padding: 8px 10px; text-align: center;">Peran</th>
                                    <th style="padding: 8px 10px; text-align: center; width: 60px;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${userList.map(u => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 8px 10px; font-weight: 600; font-family: monospace;">${escapeHtml(u.username)}</td>
                                        <td style="padding: 8px 10px;">${escapeHtml(u.name || '-')}</td>
                                        <td style="padding: 8px 10px; text-align: center;">
                                            <span class="badge ${u.role === 'ADMIN' ? 'badge-active' : 'badge-draft'}" style="font-size: 0.7rem; padding: 2px 6px;">
                                                ${u.role || 'TEACHER'}
                                            </span>
                                        </td>
                                        <td style="padding: 8px 10px; text-align: center;">
                                            ${u.username !== 'admin' ? `
                                                <button class="btn btn-icon btn-secondary text-error btn-sm" onclick="handleDeleteUser('${escapeHtml(u.username)}')" title="Hapus Akun">
                                                    <i class="ph ph-trash"></i>
                                                </button>
                                            ` : '<span class="text-xs text-muted">-</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="flex justify-end mt-4 pt-3" style="border-top: 1px solid var(--border-color);">
                        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Tutup</button>
                    </div>
                </div>
            `;
        };

        UI.showModal(renderModalContent(users));

        window.handleCreateUser = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSaveNewUser');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...'; }

            const username = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('newPassword').value.trim();
            const name = document.getElementById('newName').value.trim();
            const role = document.getElementById('newRole').value;

            try {
                const saveRes = await api.saveUser(AppState.user.sessionId, { username, password, name, role });
                if (saveRes && saveRes.success) {
                    UI.showToast(`Akun "${username}" berhasil ditambahkan!`, 'success');
                    openUserManagementModal();
                } else {
                    UI.showToast(saveRes.message || 'Gagal menambahkan akun.', 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-plus-circle"></i> Tambah Akun'; }
                }
            } catch (err) {
                UI.showToast('Terjadi kesalahan: ' + err.message, 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph ph-plus-circle"></i> Tambah Akun'; }
            }
        };

        window.handleDeleteUser = async function(username) {
            if (!confirm(`Apakah Anda yakin ingin menghapus akun "${username}"?`)) return;
            try {
                const delRes = await api.deleteUser(AppState.user.sessionId, username);
                if (delRes && delRes.success) {
                    UI.showToast(`Akun "${username}" berhasil dihapus.`, 'success');
                    openUserManagementModal();
                } else {
                    UI.showToast(delRes.message || 'Gagal menghapus akun.', 'error');
                }
            } catch (err) {
                UI.showToast('Terjadi kesalahan: ' + err.message, 'error');
            }
        };

    } catch (e) {
        UI.showToast('Gagal memuat pengguna: ' + e.message, 'error');
        closeModal();
    }
};

