// ============================================================================
// STUDENT DASHBOARD - PORTAL UJIAN SISWA (PUBLIC / TANPA LOGIN)
// ============================================================================

(function() {
    let activeExamsList = [];
    let currentSearch = '';
    let currentSubject = 'ALL';
    let currentClass = 'ALL';

    const renderExamsGrid = () => {
        const gridEl = document.getElementById('studentExamsGrid');
        const countEl = document.getElementById('activeExamCountBadge');
        if (!gridEl) return;

        const filtered = activeExamsList.filter(e => {
            const matchesSearch = !currentSearch || 
                (e.title && e.title.toLowerCase().includes(currentSearch.toLowerCase())) ||
                (e.material && e.material.toLowerCase().includes(currentSearch.toLowerCase())) ||
                (e.subject && e.subject.toLowerCase().includes(currentSearch.toLowerCase())) ||
                (e.teacherName && e.teacherName.toLowerCase().includes(currentSearch.toLowerCase()));

            const matchesSubject = currentSubject === 'ALL' || e.subject === currentSubject;
            const matchesClass = currentClass === 'ALL' || e.className === currentClass;

            return matchesSearch && matchesSubject && matchesClass;
        });

        if (countEl) {
            countEl.textContent = `${filtered.length} Ujian Aktif`;
        }

        if (filtered.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1;" class="card text-center py-8">
                    <div class="flex justify-center mb-3 text-muted">
                        <i class="ph ph-file-dashed" style="font-size: 3.5rem;"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">Tidak Ada Ujian yang Cocok</h3>
                    <p class="text-sm text-muted mb-4" style="max-width: 420px; margin: 0 auto 1.25rem;">
                        ${activeExamsList.length === 0 
                            ? 'Saat ini belum ada ujian yang sedang dibuka oleh bapak/ibu guru. Silakan tanyakan ke guru mata pelajaran atau muat ulang halaman.' 
                            : 'Tidak ada ujian yang sesuai dengan kata kunci atau filter yang Anda pilih.'}
                    </p>
                    <button class="btn btn-secondary btn-sm" onclick="resetStudentFilters()">
                        <i class="ph ph-arrow-counter-clockwise"></i> Reset Filter & Segarkan
                    </button>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = filtered.map(exam => {
            return `
                <div class="card student-exam-card flex flex-col justify-between" style="border-radius: var(--radius-md); padding: 1.25rem; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid var(--border-color); background: #ffffff;">
                    <div>
                        <!-- Header Kartu -->
                        <div class="flex justify-between items-start gap-2 mb-3">
                            <span class="badge" style="background: var(--primary-50); color: var(--primary-700); font-weight: 700; border: 1px solid var(--primary-200); font-size: 0.78rem;">
                                <i class="ph ph-book-open"></i> ${escapeHtml(exam.subject || 'Umum')}
                            </span>
                            <span class="badge badge-active flex items-center gap-1.5" style="font-size: 0.72rem; padding: 2px 8px; font-weight: 600;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#16a34a; box-shadow:0 0 6px #16a34a;"></span>
                                Dibuka
                            </span>
                        </div>

                        <!-- Judul Ujian -->
                        <h3 class="font-bold text-base mb-1" style="color: var(--text-primary); line-height: 1.4; word-break: break-word;">
                            ${escapeHtml(exam.title)}
                        </h3>

                        ${exam.material ? `
                            <div class="text-xs text-muted mb-3 flex items-center gap-1" style="word-break: break-word;">
                                <i class="ph ph-tag"></i> <span>Materi: <strong>${escapeHtml(exam.material)}</strong></span>
                            </div>
                        ` : '<div class="mb-3"></div>'}

                        ${exam.description ? `
                            <p class="text-xs text-muted mb-3" style="line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${escapeHtml(exam.description)}
                            </p>
                        ` : ''}

                        <!-- Rincian Informasi Ujian -->
                        <div class="grid grid-cols-2 gap-2 mb-4 p-2.5" style="background: var(--bg-base); border-radius: var(--radius-sm); font-size: 0.8rem; border: 1px solid var(--border-color);">
                            <div class="flex items-center gap-1.5 text-secondary">
                                <i class="ph ph-users text-primary" style="font-size: 1rem;"></i>
                                <span class="truncate">Kelas: <strong>${escapeHtml(exam.className || 'Semua')}</strong></span>
                            </div>
                            <div class="flex items-center gap-1.5 text-secondary">
                                <i class="ph ph-clock text-primary" style="font-size: 1rem;"></i>
                                <span>Durasi: <strong>${exam.durationMinutes || 60} Menit</strong></span>
                            </div>
                            <div class="flex items-center gap-1.5 text-secondary">
                                <i class="ph ph-list-numbers text-primary" style="font-size: 1rem;"></i>
                                <span>Soal: <strong>${exam.totalQuestions || 0} Butir</strong></span>
                            </div>
                            <div class="flex items-center gap-1.5 text-secondary">
                                <i class="ph ph-target text-primary" style="font-size: 1rem;"></i>
                                <span>KKM: <strong>${exam.kkm || 75}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between text-xs text-muted mb-3 pt-2" style="border-top: 1px dashed var(--border-color);">
                            <span class="flex items-center gap-1 truncate" title="${escapeHtml(exam.teacherName || 'Guru')}">
                                <i class="ph ph-user-circle"></i> ${escapeHtml(exam.teacherName || 'Guru')}
                            </span>
                            <span class="text-xs font-semibold text-primary">Maks. ${exam.maxAttempts || 1}x Coba</span>
                        </div>

                        <!-- Tombol Masuk Ujian -->
                        <button class="btn btn-primary w-full justify-center" onclick="goToExam('${exam.examId}')" style="padding: 0.6rem 1rem; font-weight: 700; letter-spacing: 0.02em;">
                            Mulai Kerjakan <i class="ph ph-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    window.goToExam = function(examId) {
        Router.navigate('/student/landing?examId=' + encodeURIComponent(examId));
    };

    window.filterStudentExams = function() {
        const searchInput = document.getElementById('studentSearchInput');
        const subjectSelect = document.getElementById('studentSubjectSelect');
        const classSelect = document.getElementById('studentClassSelect');

        if (searchInput) currentSearch = searchInput.value.trim();
        if (subjectSelect) currentSubject = subjectSelect.value;
        if (classSelect) currentClass = classSelect.value;

        renderExamsGrid();
    };

    window.resetStudentFilters = function() {
        currentSearch = '';
        currentSubject = 'ALL';
        currentClass = 'ALL';

        const searchInput = document.getElementById('studentSearchInput');
        const subjectSelect = document.getElementById('studentSubjectSelect');
        const classSelect = document.getElementById('studentClassSelect');

        if (searchInput) searchInput.value = '';
        if (subjectSelect) subjectSelect.value = 'ALL';
        if (classSelect) classSelect.value = 'ALL';

        renderExamsGrid();
    };

    window.reloadStudentDashboard = async function() {
        const gridEl = document.getElementById('studentExamsGrid');
        if (gridEl) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1;" class="text-center py-8">
                    <i class="ph ph-spinner ph-spin text-primary" style="font-size: 2.5rem;"></i>
                    <p class="mt-2 text-sm text-muted">Memuat ulang daftar ujian aktif...</p>
                </div>
            `;
        }
        try {
            const res = await api.getActivePublicExams();
            activeExamsList = (res.success && Array.isArray(res.data)) ? res.data : [];
            renderExamsGrid();
        } catch (e) {
            UI.showToast('Gagal memuat ujian', 'error');
        }
    };

    const routeHandler = async () => {
        // Set mode state to student
        AppState.update({ mode: 'student' });

        // Initial fetch
        let initialLoadingHtml = `
            <div class="view" style="background-color: var(--bg-base); min-height: 100vh; padding-bottom: 3rem;">
                <!-- Header Publik Siswa -->
                <header class="glass" style="position: sticky; top: 0; z-index: 50; border-bottom: 1px solid var(--border-color);">
                    <div class="container flex justify-between items-center py-3" style="flex-wrap: wrap; gap: 0.5rem;">
                        <div class="flex items-center gap-2.5">
                            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--primary-600); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="ph ph-graduation-cap" style="font-size: 1.35rem;"></i>
                            </div>
                            <div>
                                <h1 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--primary-700); line-height: 1.2;">CBT Online</h1>
                                <span class="text-xs text-muted font-medium">Portal Ujian Siswa</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-secondary btn-sm" onclick="reloadStudentDashboard()" title="Muat Ulang Data">
                                <i class="ph ph-arrows-clockwise"></i> <span class="hidden sm-inline">Segarkan</span>
                            </button>
                            <a href="#/login" class="btn btn-outline-primary btn-sm" style="text-decoration: none;">
                                <i class="ph ph-chalkboard-teacher"></i> <span class="hidden sm-inline">Portal</span> Guru
                            </a>
                        </div>
                    </div>
                </header>

                <div class="container mt-4">
                    <!-- Hero Banner -->
                    <div class="card mb-4" style="background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border: 1px solid var(--primary-200); padding: 1.5rem 1.25rem;">
                        <div class="flex items-start justify-between" style="flex-wrap: wrap; gap: 1rem;">
                            <div style="max-width: 600px;">
                                <div class="badge badge-active text-xs mb-2 font-semibold">
                                    <i class="ph ph-sparkle"></i> Akses Ujian Mandiri & Praktis
                                </div>
                                <h2 style="font-size: 1.45rem; font-weight: 800; margin-bottom: 0.4rem; color: var(--primary-900);">
                                    Selamat Datang di Portal Ujian Siswa 👋
                                </h2>
                                <p class="text-xs sm:text-sm text-secondary" style="margin: 0; line-height: 1.5;">
                                    Silakan temukan mata pelajaran yang sedang diujikan hari ini, lalu klik <strong>Mulai Kerjakan</strong> untuk mengisi identitas dan mulai menjawab soal.
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="activeExamCountBadge" class="badge" style="background: #ffffff; border: 1px solid var(--primary-300); color: var(--primary-700); font-weight: 700; padding: 0.4rem 0.8rem; font-size: 0.85rem; box-shadow: var(--shadow-sm);">
                                    Memuat...
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Filter & Search Controls -->
                    <div class="card mb-4" style="padding: 1rem;">
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div style="grid-column: span 1 / span 1;">
                                <label class="input-label text-xs mb-1">Pencarian Ujian</label>
                                <div class="flex items-center" style="position: relative;">
                                    <input type="text" id="studentSearchInput" class="input-control text-sm" 
                                           placeholder="Cari judul ujian / materi..." 
                                           oninput="filterStudentExams()" 
                                           style="padding-left: 2rem; width: 100%;">
                                    <i class="ph ph-magnifying-glass text-muted" style="position: absolute; left: 0.75rem; font-size: 1rem;"></i>
                                </div>
                            </div>
                            <div>
                                <label class="input-label text-xs mb-1">Mata Pelajaran</label>
                                <select id="studentSubjectSelect" class="input-control text-sm" onchange="filterStudentExams()">
                                    <option value="ALL">Semua Mata Pelajaran</option>
                                </select>
                            </div>
                            <div>
                                <label class="input-label text-xs mb-1">Target Kelas</label>
                                <select id="studentClassSelect" class="input-control text-sm" onchange="filterStudentExams()">
                                    <option value="ALL">Semua Kelas</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Grid Daftar Ujian -->
                    <div id="studentExamsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
                        <div style="grid-column: 1 / -1;" class="text-center py-10">
                            <i class="ph ph-spinner ph-spin text-primary" style="font-size: 2.5rem;"></i>
                            <p class="mt-2 text-sm text-muted">Mengambil data ujian aktif dari database sekolah...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Async load data after view mounts
        setTimeout(async () => {
            try {
                const res = await api.getActivePublicExams();
                activeExamsList = (res.success && Array.isArray(res.data)) ? res.data : [];

                // Populate filter dropdown options dynamically
                const subjects = Array.from(new Set(activeExamsList.map(e => e.subject).filter(Boolean))).sort();
                const classes = Array.from(new Set(activeExamsList.map(e => e.className).filter(Boolean))).sort();

                const subSelect = document.getElementById('studentSubjectSelect');
                if (subSelect) {
                    subSelect.innerHTML = `<option value="ALL">Semua Mata Pelajaran (${subjects.length})</option>` + 
                        subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
                }

                const clsSelect = document.getElementById('studentClassSelect');
                if (clsSelect) {
                    clsSelect.innerHTML = `<option value="ALL">Semua Kelas (${classes.length})</option>` + 
                        classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
                }

                renderExamsGrid();
            } catch (err) {
                console.error("Gagal memuat ujian aktif:", err);
                const gridEl = document.getElementById('studentExamsGrid');
                if (gridEl) {
                    gridEl.innerHTML = `
                        <div style="grid-column: 1 / -1;" class="card text-center py-6 text-error">
                            <i class="ph ph-warning-circle mb-2" style="font-size: 2.5rem;"></i>
                            <div class="font-bold">Gagal terhubung ke database ujian</div>
                            <div class="text-xs text-muted mt-1">Periksa koneksi internet Anda atau coba muat ulang.</div>
                            <button class="btn btn-secondary btn-sm mt-3" onclick="reloadStudentDashboard()">Coba Lagi</button>
                        </div>
                    `;
                }
            }
        }, 30);

        return initialLoadingHtml;
    };

    Router.addRoute('/student/dashboard', routeHandler);
    Router.addRoute('/student', routeHandler);
})();
