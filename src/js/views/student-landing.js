Router.addRoute('/student/landing', async (params) => {
    const examId = params.get('examId');
    
    if (!examId) {
        return `
            <div class="view flex items-center justify-center" style="background-color: var(--primary-50); min-height: 100vh;">
                <div class="card text-center" style="width: 100%; max-width: 400px; margin: 1rem;">
                    <i class="ph ph-warning-circle text-error mb-2" style="font-size: 3rem;"></i>
                    <h3 class="mb-2">Link Tidak Valid</h3>
                    <p class="text-muted text-sm mb-4">Parameter ID ujian tidak ditemukan.</p>
                    <a href="#/student/dashboard" class="btn btn-primary btn-sm inline-flex items-center gap-1.5" style="text-decoration:none;">
                        <i class="ph ph-squares-four"></i> Ke Portal Ujian Siswa
                    </a>
                </div>
            </div>
        `;
    }

    const res = await api.getPublicExam(examId);
    if (!res.success || !res.data) {
        return `
            <div class="view flex items-center justify-center" style="background-color: var(--primary-50); min-height: 100vh;">
                <div class="card text-center" style="width: 100%; max-width: 400px; margin: 1rem;">
                    <i class="ph ph-warning-circle text-error mb-2" style="font-size: 3rem;"></i>
                    <h3 class="mb-2">Ujian Tidak Tersedia</h3>
                    <p class="text-muted text-sm mb-4">${res.message || 'Ujian tidak ditemukan atau link sudah tidak berlaku.'}</p>
                    <a href="#/student/dashboard" class="btn btn-primary btn-sm inline-flex items-center gap-1.5" style="text-decoration:none;">
                        <i class="ph ph-squares-four"></i> Ke Portal Ujian Siswa
                    </a>
                </div>
            </div>
        `;
    }

    const exam = res.data;
    AppState.update({ currentExam: exam, mode: 'student' });

    const classList = ["X", "XI", "XII"];

    return `
        <div class="view flex items-center justify-center" style="background-color: var(--bg-base); min-height: 100vh;">
            <div class="card" style="width: 100%; max-width: 500px; margin: 1rem;">
                <div class="text-center mb-6">
                    <div class="flex items-center justify-center gap-2 text-primary mb-2">
                        <i class="ph ph-graduation-cap ph-fill" style="font-size: 3rem;"></i>
                    </div>
                    <h2 class="mb-2">${exam.title}</h2>
                    <div class="flex justify-center gap-4 text-sm text-muted">
                        <span class="flex items-center gap-1"><i class="ph ph-book-open"></i> ${exam.subject}</span>
                        <span class="flex items-center gap-1"><i class="ph ph-users"></i> ${exam.className}</span>
                    </div>
                </div>

                <div class="mb-6" style="background: var(--primary-50); padding: 1rem; border-radius: var(--radius-md);">
                    <div class="flex justify-between mb-2">
                        <span class="text-sm font-semibold text-secondary">Jumlah Soal</span>
                        <span class="text-sm font-bold text-primary">${exam.totalQuestions || 0} Soal</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-semibold text-secondary">Waktu Pengerjaan</span>
                        <span class="text-sm font-bold text-primary">${exam.durationMinutes} Menit</span>
                    </div>
                    ${exam.description ? `
                    <div class="mt-4 pt-4" style="border-top: 1px solid var(--primary-200);">
                        <span class="text-sm font-semibold text-secondary block mb-1">Deskripsi</span>
                        <p class="text-sm text-muted">${exam.description}</p>
                    </div>` : ''}
                    ${exam.instructions ? `
                    <div class="mt-4 pt-4" style="border-top: 1px solid var(--primary-200);">
                        <span class="text-sm font-semibold text-secondary block mb-1">Petunjuk Ujian</span>
                        <p class="text-sm text-muted">${exam.instructions}</p>
                    </div>` : ''}
                </div>
                
                <form id="startExamForm" onsubmit="handleStartExam(event)">
                    <h4 class="mb-4">Data Peserta</h4>
                    <div class="input-group">
                        <label class="input-label" for="participantName">Nama Lengkap</label>
                        <input type="text" id="participantName" class="input-control" placeholder="Masukkan nama Anda" required>
                    </div>
                    
                    <div class="input-group">
                        <label class="input-label" for="classNameInput">Kelas</label>
                        <select id="classNameInput" class="input-control" required style="background-color: #ffffff; cursor: pointer;">
                            <option value="" disabled ${!classList.includes(exam.className) ? 'selected' : ''}>-- Pilih Kelas --</option>
                            ${classList.map(cls => `
                                <option value="${cls}" ${exam.className === cls ? 'selected' : ''}>${cls}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="nis">NIS (Nomor Induk Siswa) <span class="text-xs text-muted font-normal">(Opsional)</span></label>
                        <input type="text" id="nis" class="input-control" placeholder="Masukkan NIS Anda (opsional, boleh dikosongkan)">
                    </div>
                    
                    <button type="submit" id="startBtn" class="btn btn-primary w-full mt-4 btn-lg">
                        Mulai Ujian Sekarang
                    </button>

                    <div class="text-center mt-4 pt-3" style="border-top: 1px dashed var(--border-color);">
                        <a href="#/student/dashboard" class="text-xs text-muted flex items-center justify-center gap-1 hover:text-primary" style="text-decoration: none;">
                            <i class="ph ph-arrow-left"></i> Kembali ke Portal Daftar Ujian
                        </a>
                    </div>
                </form>
            </div>
        </div>
    `;
});

window.handleStartExam = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('startBtn');
    
    const name = document.getElementById('participantName').value.trim();
    const className = document.getElementById('classNameInput').value.trim();
    const nis = document.getElementById('nis').value.trim() || '-';

    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyiapkan ujian...';
    
    try {
        const examId = AppState.currentExam.examId;
        const res = await api.startExamAttempt(examId, { name, className, nis });
        
        if (res.success && res.data) {
            AppState.update({ 
                attempt: res.data,
                questions: res.data.questions,
                answers: {}
            });
            UI.showToast('Ujian dimulai. Selamat mengerjakan!', 'success');
            Router.navigate('/student/exam');
        } else {
            UI.showToast(res.message || 'Gagal memulai ujian.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Mulai Ujian Sekarang';
        }
    } catch (e) {
        UI.showToast('Terjadi kesalahan koneksi.', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Mulai Ujian Sekarang';
    }
};
