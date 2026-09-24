Router.addRoute('/student/result', async () => {
    if (!AppState.attempt || !AppState.currentExam) {
        try {
            const savedResult = localStorage.getItem('cbt_last_result');
            if (savedResult) {
                const parsed = JSON.parse(savedResult);
                if (parsed && parsed.attempt) {
                    AppState.mode = 'student';
                    AppState.attempt = parsed.attempt;
                    AppState.currentExam = parsed.currentExam || {};
                }
            }
        } catch (e) {}
    }

    if (AppState.mode !== 'student' || !AppState.attempt) {
        setTimeout(() => Router.navigate('/student/dashboard'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const exam = AppState.currentExam || {};
    const attempt = AppState.attempt || {};
    const showResult = exam.showResult !== false; // Default true if not explicitly false
    const kkm = exam.kkm !== undefined ? exam.kkm : 75;
    const scoreVal = attempt.score !== undefined ? attempt.score : 0;
    const isPassed = scoreVal >= kkm;

    let resultHtml = '';
    
    if (showResult) {
        resultHtml = `
            <div class="mb-5">
                <div class="text-sm text-muted mb-1">Skor Akhir Anda</div>
                <div class="font-bold" style="font-size: 3.5rem; line-height: 1; color: ${isPassed ? 'var(--success)' : 'var(--error)'};">
                    ${scoreVal}
                </div>
                <div class="text-sm mt-2 font-medium">
                    Standar Kelulusan (KKM): <span class="font-bold text-primary">${kkm}</span>
                </div>
            </div>
            
            <div class="mb-5">
                <span class="badge ${isPassed ? 'badge-active' : 'badge-archived'}" style="font-size: 1.05rem; padding: 0.55rem 1.25rem; font-weight: 800; letter-spacing: 0.03em;">
                    ${isPassed ? '<i class="ph ph-check-circle"></i> LULUS' : '<i class="ph ph-x-circle"></i> BELUM LULUS'}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-3 text-left mb-4" style="background: var(--bg-base); padding: 0.85rem 1rem; border-radius: var(--radius-md);">
                <div>
                    <div class="text-xs text-muted">Total Benar</div>
                    <div class="font-bold text-success text-base">${attempt.totalCorrect !== undefined ? attempt.totalCorrect : '-'} <span class="text-xs font-normal text-muted">Soal</span></div>
                </div>
                <div>
                    <div class="text-xs text-muted">Total Salah</div>
                    <div class="font-bold text-error text-base">${attempt.totalWrong !== undefined ? attempt.totalWrong : '-'} <span class="text-xs font-normal text-muted">Soal</span></div>
                </div>
            </div>

            <!-- Pesan Penyemangat Khusus Siswa -->
            ${isPassed ? `
                <div class="encouragement-card" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 1rem 1.15rem; text-align: center; margin-top: 0.75rem;">
                    <div style="font-size: 1.6rem; margin-bottom: 0.25rem;">🎉 🏆 🌟</div>
                    <div style="font-weight: 800; color: #15803d; font-size: 0.96rem; letter-spacing: -0.01em;">Luar Biasa, Kamu Berhasil Lulus!</div>
                    <p style="font-size: 0.82rem; color: #166534; margin: 0.35rem 0 0 0; line-height: 1.45;">
                        Kerja keras dan ketekunanmu terbayar dengan hasil yang sangat membanggakan. Pertahankan prestasimu dan teruslah melangkah menjadi lebih hebat! 🚀
                    </p>
                </div>
            ` : `
                <div class="encouragement-card" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 1rem 1.15rem; text-align: center; margin-top: 0.75rem;">
                    <div style="font-size: 1.6rem; margin-bottom: 0.25rem;">💪 📖 ✨</div>
                    <div style="font-weight: 800; color: #b45309; font-size: 0.96rem; letter-spacing: -0.01em;">Tetap Semangat & Jangan Menyerah!</div>
                    <p style="font-size: 0.82rem; color: #92400e; margin: 0.35rem 0 0 0; line-height: 1.45;">
                        Setiap proses belajar memiliki tantangan tersendiri. Jadikan hasil ini bahan evaluasi untuk belajar lebih giat lagi, kamu pasti bisa meraih hasil terbaik di kesempatan berikutnya! 🔥
                    </p>
                </div>
            `}
        `;
    } else {
        resultHtml = `
            <div class="mb-6 py-4 text-center">
                <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">📬 ✨</div>
                <h3 class="mb-2" style="font-size: 1.25rem; font-weight: 800;">Ujian Berhasil Dikumpulkan!</h3>
                <p class="text-muted text-sm" style="line-height: 1.5;">Seluruh lembar jawaban Anda telah tersimpan aman di server database sekolah.</p>
                <div class="mt-4 p-3" style="background: var(--bg-base); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">
                    Pengumuman nilai akhir akan diinformasikan langsung oleh guru pengampu mata pelajaran.
                </div>
            </div>
        `;
    }

    return `
        <div class="view flex items-center justify-center" style="background-color: var(--primary-50); min-height: 100vh; padding: 1.5rem 1rem;">
            <div class="card text-center" style="width: 100%; max-width: 460px; box-shadow: var(--shadow-md);">
                <div class="mb-3 text-xs font-semibold text-primary" style="text-transform: uppercase; letter-spacing: 0.05em;">
                    ${escapeHtml(exam.title || 'Ujian Online')}
                </div>
                
                <hr style="border:0; border-top: 1px solid var(--border-color); margin: 0.75rem 0 1rem 0;">
                
                <div class="mb-4 text-left" style="background: var(--bg-base); padding: 0.75rem 0.9rem; border-radius: var(--radius-sm);">
                    <div class="text-xs text-muted">Nama Peserta:</div>
                    <div class="font-bold text-sm text-primary">${escapeHtml(attempt.participantName || '-')}</div>
                    
                    <div class="grid grid-cols-2 gap-2 mt-1.5 text-xs">
                        <div>
                            <span class="text-muted">Kelas:</span>
                            <span class="font-semibold text-primary">${escapeHtml(attempt.className || '-')}</span>
                        </div>
                        <div>
                            <span class="text-muted">NIS:</span>
                            <span class="font-semibold text-primary">${escapeHtml(attempt.nis || '-')}</span>
                        </div>
                    </div>
                </div>

                ${resultHtml}
                
                <div class="mt-6">
                    <button class="btn btn-primary w-full justify-center" onclick="handleExitExam()" style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.95rem;">
                        <i class="ph ph-sign-out"></i> Selesai & Keluar
                    </button>
                </div>
            </div>
        </div>
    `;
});

window.handleExitExam = function() {
    const pName = AppState.attempt ? AppState.attempt.participantName : '';
    const eTitle = AppState.currentExam ? AppState.currentExam.title : '';
    const isPassed = AppState.attempt && AppState.currentExam ? (AppState.attempt.score >= AppState.currentExam.kkm) : false;
    
    if (AppState.timer) {
        clearInterval(AppState.timer);
        AppState.timer = null;
    }
    
    AppState.update({ 
        attempt: null, 
        questions: null, 
        answers: {},
        completedSession: {
            name: pName,
            title: eTitle,
            isPassed: isPassed
        }
    });

    Router.navigate('/student/completed');
};

Router.addRoute('/student/completed', async () => {
    const info = AppState.completedSession || {};
    return `
        <div class="view flex items-center justify-center" style="background-color: var(--primary-50); min-height: 100vh; padding: 2rem 1rem;">
            <div class="card text-center" style="width: 100%; max-width: 460px; padding: 2.25rem 1.5rem; box-shadow: var(--shadow-md);">
                <div style="width: 70px; height: 70px; background: rgba(16, 185, 129, 0.12); color: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 2.3rem;">
                    <i class="ph ph-check-circle"></i>
                </div>
                
                <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.35rem;">
                    Sesi Ujian Selesai
                </h3>
                
                ${info.name ? `
                    <p class="text-sm text-primary font-bold mb-1">
                        Terima kasih, ${escapeHtml(info.name)}!
                    </p>
                ` : ''}

                <p class="text-xs text-muted mb-4">
                    ${escapeHtml(info.title || 'Ujian Online')}
                </p>

                <div style="background: var(--bg-base); border-radius: var(--radius-md); padding: 1.1rem; margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; text-align: center;">
                    <div style="font-size: 1.25rem; margin-bottom: 0.25rem;">🔒 ✅</div>
                    Seluruh rekaman lembar jawaban dan nilai Anda telah tersimpan dengan aman di server database sekolah.<br>
                    <span class="text-xs text-muted mt-1 block">Anda dapat menutup halaman ini sekarang.</span>
                </div>

                <button class="btn btn-outline-primary w-full justify-center" onclick="Router.navigate('/student/landing')">
                    <i class="ph ph-arrow-counter-clockwise"></i> Kembali ke Menu Siswa
                </button>
            </div>
        </div>
    `;
});
