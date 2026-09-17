Router.addRoute('/exam-editor', async (params) => {
    // Check auth
    if (!AppState.user || (AppState.user.role !== 'TEACHER' && AppState.user.role !== 'ADMIN')) {
        setTimeout(() => Router.navigate('/login'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const examId = params.get('id');
    let exam = {
        title: '', subject: '', material: '', className: '',
        durationMinutes: 60, kkm: 75, maxAttempts: 1, attemptScoring: 'HIGHEST',
        randomizeQuestions: false, randomizeOptions: false, showResult: true, status: 'DRAFT'
    };
    
    let isEdit = false;

    if (examId) {
        const res = await api.getExam(AppState.user.sessionId, examId);
        if (res.success && res.data) {
            exam = { ...exam, ...res.data };
            isEdit = true;
        } else {
            UI.showToast('Gagal memuat ujian', 'error');
            setTimeout(() => Router.navigate('/dashboard'), 0);
            return `<div class="loading-full">Error...</div>`;
        }
    }

    return `
        <div class="view">
            <nav class="navbar glass">
                <div class="container flex justify-between items-center" style="gap: 0.5rem;">
                    <div class="flex items-center gap-3">
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/dashboard')" title="Kembali ke Dashboard">
                            <i class="ph ph-arrow-left"></i>
                        </button>
                        <h3 style="margin:0; font-size: 1.15rem;">${isEdit ? 'Edit Ujian' : 'Buat Ujian Baru'}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="teacher-profile-chip" title="${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}">
                            <i class="ph ph-user-circle"></i>
                            <span>${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}</span>
                        </div>
                    </div>
                </div>
            </nav>

            <div class="container mt-6">
                <div class="card container-sm" style="margin: 0 auto;">
                    <form id="examForm" onsubmit="handleSaveExam(event)">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="input-group" style="grid-column: span 2;">
                                <label class="input-label" for="title">Judul Ujian <span class="text-error">*</span></label>
                                <input type="text" id="title" class="input-control" value="${exam.title}" required>
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="subject">Mata Pelajaran <span class="text-error">*</span></label>
                                <input type="text" id="subject" class="input-control" value="${exam.subject}" required>
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="className">Kelas <span class="text-error">*</span></label>
                                <input type="text" id="className" class="input-control" value="${exam.className}" required>
                            </div>

                            <div class="input-group" style="grid-column: span 2;">
                                <label class="input-label" for="material">Materi</label>
                                <input type="text" id="material" class="input-control" value="${exam.material || ''}">
                            </div>

                            <div class="input-group" style="grid-column: span 2;">
                                <label class="input-label" for="description">Deskripsi Ujian</label>
                                <textarea id="description" class="input-control" rows="2">${exam.description || ''}</textarea>
                            </div>
                            
                            <div class="input-group" style="grid-column: span 2;">
                                <label class="input-label" for="instructions">Petunjuk Pengerjaan</label>
                                <textarea id="instructions" class="input-control" rows="2">${exam.instructions || ''}</textarea>
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="dateStart">Tanggal & Waktu Mulai (Opsional)</label>
                                <input type="datetime-local" id="dateStart" class="input-control" value="${exam.dateStart || ''}">
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="dateEnd">Tanggal & Waktu Selesai (Opsional)</label>
                                <input type="datetime-local" id="dateEnd" class="input-control" value="${exam.dateEnd || ''}">
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="durationMinutes">Durasi (Menit) <span class="text-error">*</span></label>
                                <input type="number" id="durationMinutes" class="input-control" value="${exam.durationMinutes}" min="1" required>
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="kkm">KKM <span class="text-error">*</span></label>
                                <input type="number" id="kkm" class="input-control" value="${exam.kkm}" min="0" max="100" required>
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="maxAttempts">Maksimal Percobaan</label>
                                <input type="number" id="maxAttempts" class="input-control" value="${exam.maxAttempts}" min="1">
                            </div>
                            
                            <div class="input-group">
                                <label class="input-label" for="attemptScoring">Metode Nilai Percobaan</label>
                                <select id="attemptScoring" class="input-control">
                                    <option value="HIGHEST" ${exam.attemptScoring === 'HIGHEST' ? 'selected' : ''}>Nilai Tertinggi</option>
                                    <option value="LATEST" ${exam.attemptScoring === 'LATEST' ? 'selected' : ''}>Nilai Terakhir</option>
                                    <option value="AVERAGE" ${exam.attemptScoring === 'AVERAGE' ? 'selected' : ''}>Rata-rata</option>
                                </select>
                            </div>
                            
                            <div class="input-group" style="grid-column: span 2;">
                                <label class="input-label" for="status">Status Ujian</label>
                                <select id="status" class="input-control">
                                    <option value="DRAFT" ${exam.status === 'DRAFT' ? 'selected' : ''}>DRAFT (Belum Publik)</option>
                                    <option value="ACTIVE" ${exam.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE (Dapat Dikerjakan)</option>
                                    <option value="INACTIVE" ${exam.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE (Ditutup)</option>
                                </select>
                            </div>
                        </div>

                        <hr style="border:0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
                        
                        <div class="flex-col gap-3">
                            <label class="flex items-center gap-2" style="cursor: pointer;">
                                <input type="checkbox" id="randomizeQuestions" ${exam.randomizeQuestions ? 'checked' : ''}>
                                <span class="text-sm">Acak Urutan Soal</span>
                            </label>
                            
                            <label class="flex items-center gap-2" style="cursor: pointer;">
                                <input type="checkbox" id="randomizeOptions" ${exam.randomizeOptions ? 'checked' : ''}>
                                <span class="text-sm">Acak Urutan Opsi (Pilihan Ganda)</span>
                            </label>
                            
                            <label class="flex items-center gap-2" style="cursor: pointer;">
                                <input type="checkbox" id="showResult" ${exam.showResult ? 'checked' : ''}>
                                <span class="text-sm">Tampilkan Nilai Akhir ke Peserta</span>
                            </label>
                        </div>
                        
                        <div class="flex justify-between mt-6">
                            <button type="button" class="btn btn-secondary" onclick="Router.navigate('/dashboard')">Batal</button>
                            <button type="submit" id="saveExamBtn" class="btn btn-primary">
                                <i class="ph ph-floppy-disk"></i> Simpan Ujian
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
});

window.handleSaveExam = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('saveExamBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';

    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const examId = params.get('id');

    const examData = {
        examId: examId || undefined,
        title: document.getElementById('title').value.trim(),
        subject: document.getElementById('subject').value.trim(),
        className: document.getElementById('className').value.trim(),
        material: document.getElementById('material').value.trim(),
        description: document.getElementById('description').value.trim(),
        instructions: document.getElementById('instructions').value.trim(),
        durationMinutes: Number(document.getElementById('durationMinutes').value || 60),
        kkm: Number(document.getElementById('kkm').value || 75),
        maxAttempts: Number(document.getElementById('maxAttempts').value || 1),
        attemptScoring: document.getElementById('attemptScoring').value,
        status: document.getElementById('status').value,
        dateStart: document.getElementById('dateStart').value,
        dateEnd: document.getElementById('dateEnd').value,
        randomizeQuestions: document.getElementById('randomizeQuestions').checked,
        randomizeOptions: document.getElementById('randomizeOptions').checked,
        showResult: document.getElementById('showResult').checked
    };

    try {
        const res = await api.saveExam(AppState.user.sessionId, examData);
        if (res.success) {
            UI.showToast(res.message || 'Ujian berhasil disimpan!', 'success');
            Router.navigate('/dashboard');
        } else {
            UI.showToast(res.message || 'Gagal menyimpan ujian.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan Ujian';
        }
    } catch (e) {
        UI.showToast('Terjadi kesalahan koneksi server.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan Ujian';
    }
};
