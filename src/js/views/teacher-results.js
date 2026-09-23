const renderTeacherResults = async (params) => {
    if (!AppState.user || (AppState.user.role !== 'TEACHER' && AppState.user.role !== 'ADMIN')) {
        setTimeout(() => Router.navigate('/login'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const examId = params.get('examId');
    if (!examId) {
        setTimeout(() => Router.navigate('/dashboard'), 0);
        return `<div class="loading-full">Error...</div>`;
    }

    let summary = {
        totalParticipants: 0,
        submittedCount: 0,
        inProgressCount: 0,
        avgScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0
    };
    let results = [];

    try {
        const res = await api.getExamResults(AppState.user.sessionId, examId);
        if (res.success && res.data) {
            summary = res.data.summary || summary;
            results = res.data.results || [];
        }
    } catch (e) {
        console.error("Error fetching results:", e);
    }

    window.handleExport = async function() {
        await downloadExamResultsExcel(examId, (AppState.currentExam && AppState.currentExam.title) || '', 'exportBtn');
    };

    return `
        <div class="view">
            <nav class="navbar glass">
                <div class="container flex justify-between items-center" style="gap: 0.75rem; flex-wrap: wrap;">
                    <div class="flex items-center gap-3">
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/dashboard')" title="Kembali">
                            <i class="ph ph-arrow-left"></i>
                        </button>
                        <h3 style="margin:0; font-size: 1.15rem;">Hasil & Rekapitulasi</h3>
                    </div>
                    <div class="flex items-center gap-2" style="flex-wrap: wrap;">
                        <div class="teacher-profile-chip" title="${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}">
                            <i class="ph ph-user-circle"></i>
                            <span>${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="Router.handleRoute()" title="Muat Ulang Data">
                            <i class="ph ph-arrow-clockwise"></i> Refresh
                        </button>
                        <button class="btn btn-outline-success btn-sm flex items-center gap-1.5" onclick="downloadExamQuestionsExcel('${examId}', (AppState.currentExam && AppState.currentExam.title) || '')" title="Download Soal Ujian ini dalam file Excel (.xlsx)">
                            <i class="ph ph-file-arrow-down text-success"></i> <span class="hidden sm-inline">Download</span> Soal (.xlsx)
                        </button>
                        <button id="exportBtn" class="btn btn-primary btn-sm flex items-center gap-1.5" onclick="handleExport()" title="Download Rekap Hasil & Jawaban Siswa (.xlsx)">
                            <i class="ph ph-microsoft-excel-logo"></i> <span class="hidden sm-inline">Download</span> Hasil (.xlsx)
                        </button>
                    </div>
                </div>
            </nav>

            <div class="container mt-6">
                <!-- Summary Cards -->
                <div class="grid grid-cols-4 gap-4 mb-6">
                    <div class="card">
                        <div class="text-sm text-muted">Total Peserta</div>
                        <div class="text-2xl font-bold mt-1">${summary.totalParticipants}</div>
                    </div>
                    <div class="card">
                        <div class="text-sm text-muted">Selesai Dikumpulkan</div>
                        <div class="text-2xl font-bold mt-1 text-success">${summary.submittedCount}</div>
                    </div>
                    <div class="card">
                        <div class="text-sm text-muted">Sedang Mengerjakan</div>
                        <div class="text-2xl font-bold mt-1 text-warning">${summary.inProgressCount}</div>
                    </div>
                    <div class="card">
                        <div class="text-sm text-muted">Rata-rata Nilai</div>
                        <div class="text-2xl font-bold mt-1 text-primary">${summary.avgScore}</div>
                    </div>
                </div>

                <!-- Filters & Search -->
                <div class="card mb-4" style="padding: 1rem;">
                    <div class="flex gap-4">
                        <div class="input-group" style="margin-bottom:0; flex-grow:1;">
                            <input type="text" id="filterKeyword" class="input-control" placeholder="Cari nama atau NIS..." oninput="filterResultsTable(this.value)">
                        </div>
                    </div>
                </div>

                <!-- Desktop Table View -->
                <div class="desktop-only card table-container table-responsive" style="padding:0; overflow-x:auto;">
                    <table class="table" id="resultsTable" style="width:100%; border-collapse:collapse; min-width: 680px;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-base); text-align: left;">
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">NIS</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Nama Peserta</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Kelas</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary text-center">Percobaan</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Status</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Nilai Akhir</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Hasil KKM</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary">Waktu Selesai</th>
                                <th class="py-3 px-4 text-sm font-semibold text-secondary text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.length === 0 ? `
                                <tr>
                                    <td colspan="9" class="text-center py-8 text-muted">Belum ada data peserta yang mengikuti ujian ini.</td>
                                </tr>
                            ` : results.map(r => `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td class="py-3 px-4 text-sm">${r.nis}</td>
                                    <td class="py-3 px-4 font-semibold">${r.name}</td>
                                    <td class="py-3 px-4 text-sm">${r.className}</td>
                                    <td class="py-3 px-4 text-sm text-center">Ke-${r.attemptNumber || 1}</td>
                                    <td class="py-3 px-4">
                                        <span class="badge ${r.status === 'SUBMITTED' ? 'badge-active' : 'badge-draft'}">
                                            ${r.status === 'SUBMITTED' ? 'Selesai' : 'Mengerjakan'}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4 font-bold ${r.score !== null ? (r.score >= (r.kkm || 75) ? 'text-success' : 'text-error') : ''}">
                                        ${r.score !== null ? r.score : '-'}
                                    </td>
                                    <td class="py-3 px-4 text-sm">
                                        ${r.passStatus ? `
                                            <span class="badge ${r.passStatus === 'LULUS' ? 'badge-active' : 'badge-archived'}">
                                                ${r.passStatus}
                                            </span>
                                        ` : '-'}
                                    </td>
                                    <td class="py-3 px-4 text-sm text-muted">
                                        ${r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString('id-ID') : '-'}
                                    </td>
                                    <td class="py-3 px-4 text-center">
                                        <button class="btn btn-sm btn-outline-primary" onclick="showStudentDetail('${r.attemptId}')" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; white-space: nowrap;">
                                            <i class="ph ph-eye"></i> Detail Jawaban
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Results Card View -->
                <div class="mobile-only" id="resultsMobileContainer">
                    ${results.length === 0 ? `
                        <div class="card text-center py-8 text-muted">
                            Belum ada data peserta yang mengikuti ujian ini.
                        </div>
                    ` : results.map(r => `
                        <div class="card mb-3 result-card-item" style="padding: 1.15rem;">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <div class="font-bold text-base text-primary">${r.name}</div>
                                    <div class="text-xs text-muted mt-1">NIS: <strong>${r.nis}</strong> • Kelas: <strong>${r.className}</strong></div>
                                </div>
                                <div>
                                    <span class="badge ${r.passStatus === 'LULUS' ? 'badge-active' : 'badge-archived'}">
                                        ${r.passStatus || (r.status === 'SUBMITTED' ? 'Selesai' : 'Mengerjakan')}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-3 py-2 my-2" style="background: var(--bg-base); padding: 0.75rem; border-radius: var(--radius-sm);">
                                <div>
                                    <div class="text-xs text-muted">Nilai Akhir</div>
                                    <div class="text-2xl font-bold ${r.score !== null ? (r.score >= (r.kkm || 75) ? 'text-success' : 'text-error') : ''}">
                                        ${r.score !== null ? r.score : '-'}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-muted">KKM: ${r.kkm || 75}</div>
                                    <div class="text-xs text-muted mt-1">Percobaan: Ke-${r.attemptNumber || 1}</div>
                                </div>
                            </div>

                            <button class="btn btn-outline-primary btn-sm w-full justify-center mt-2" onclick="showStudentDetail('${r.attemptId}')">
                                <i class="ph ph-eye"></i> Lihat Detail Jawaban
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
};

window.showStudentDetail = async function(attemptId) {
    if (!attemptId) return;

    UI.showModal(`
        <div class="text-center py-6">
            <i class="ph ph-spinner ph-spin text-primary" style="font-size: 2.5rem;"></i>
            <p class="mt-3 text-sm text-muted">Memuat rincian lembar jawaban siswa...</p>
        </div>
    `);

    try {
        const res = await api.getStudentAttemptDetail(AppState.user.sessionId, attemptId);
        if (!res.success || !res.data) {
            UI.showToast(res.message || 'Gagal memuat detail jawaban.', 'error');
            closeModal();
            return;
        }

        const data = res.data;
        const att = data.attempt || {};
        const qList = data.questions || [];

        const formatAnswerBadges = (rawAns, options, qType = null) => {
            if (rawAns === null || rawAns === undefined || rawAns === '') {
                if (qType === 'TRUE_FALSE') {
                    rawAns = 'FALSE';
                } else {
                    return '<span class="text-muted italic">- Belum dijawab -</span>';
                }
            }
            let list = [];
            if (Array.isArray(rawAns)) {
                list = rawAns;
            } else {
                const s = String(rawAns).trim();
                if (s.startsWith('[') && s.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(s);
                        if (Array.isArray(parsed)) list = parsed;
                        else list = [s];
                    } catch (e) {
                        list = s.replace(/[\[\]"]/g, '').split(',').map(x => x.trim()).filter(Boolean);
                    }
                } else if (s.includes(',')) {
                    list = s.split(',').map(x => x.trim()).filter(Boolean);
                } else {
                    list = [s];
                }
            }

            if (list.length === 0) {
                return '<span class="text-muted italic">- Belum dijawab -</span>';
            }

            return list.map(ansId => {
                const cleanId = String(ansId).trim().replace(/^["']|["']$/g, '');
                const upperId = cleanId.toUpperCase();
                const opt = options ? options.find(o => String(o.id).trim().toUpperCase() === upperId) : null;
                if (opt) {
                    return `<span><strong>${escapeHtml(cleanId)}.</strong> ${escapeHtml(opt.text)}</span>`;
                }
                if (upperId === 'TRUE' || upperId === 'BENAR' || upperId === 'B' || upperId === 'SESUAI' || upperId === 'TEPAT') return '<span class="font-semibold text-success">TRUE. Benar/Sesuai/Tepat</span>';
                if (upperId === 'FALSE' || upperId === 'SALAH' || upperId === 'S' || upperId === 'TS' || upperId === 'TT' || upperId === 'TIDAK SESUAI' || upperId === 'TIDAK TEPAT') return '<span class="font-semibold text-error">FALSE. Salah/Tidak Sesuai</span>';
                return `<span><strong>${escapeHtml(cleanId)}</strong></span>`;
            }).join(' <span class="text-muted" style="margin: 0 4px;">•</span> ');
        };

        const questionsHtml = qList.map(q => {
            const isCorr = q.isCorrect;
            const tfLabels = getTfLabels(q.tfType);
            const typeLabel = q.type === 'MCQ' ? 'Pilihan Ganda' : (q.type === 'TRUE_FALSE' ? tfLabels.name : 'Pilihan Ganda Kompleks');

            const studentAnsText = formatAnswerBadges(q.studentAnswer, q.options, q.type);
            const keyText = formatAnswerBadges(q.correctAnswer, q.options, q.type);

            return `
                <div class="student-q-item ${isCorr ? 'correct-item' : 'wrong-item'}">
                    <div class="flex justify-between items-center mb-2" style="flex-wrap: wrap; gap: 0.5rem;">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-sm text-primary">Soal #${q.orderNo}</span>
                            <span class="badge text-xs" style="background: var(--bg-base);">${typeLabel}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="badge ${isCorr ? 'badge-active' : 'badge-archived'} text-xs">
                                ${isCorr ? '<i class="ph ph-check-circle"></i> BENAR' : '<i class="ph ph-x-circle"></i> SALAH'}
                            </span>
                            <span class="text-xs font-bold ${isCorr ? 'text-success' : 'text-error'}">
                                ${q.awardedScore} / ${q.score} Poin
                            </span>
                        </div>
                    </div>

                    <div class="text-sm font-medium mb-3" style="line-height: 1.5; color: var(--text-primary); word-break: break-word; overflow-wrap: anywhere;">
                        ${escapeHtml(q.questionText)}
                    </div>

                    ${(q.questionImageUrl || q.imageUrl) ? `
                        <div class="mb-3 text-center">
                            <img src="${formatDirectImageUrl(q.questionImageUrl || q.imageUrl)}" 
                                 alt="Gambar Soal" 
                                 referrerpolicy="no-referrer"
                                 loading="lazy"
                                 onerror="handleImgError(this)"
                                 style="max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #ffffff; display: inline-block;">
                        </div>
                    ` : ''}

                    ${q.bottomText ? `
                        <div class="text-sm font-medium mb-3" style="line-height: 1.5; color: var(--text-primary); word-break: break-word; overflow-wrap: anywhere;">
                            ${escapeHtml(q.bottomText)}
                        </div>
                    ` : ''}

                    ${q.type === 'TRUE_FALSE' ? (() => {
                        let sMap = {};
                        if (typeof q.studentAnswer === 'object' && q.studentAnswer !== null) {
                            sMap = q.studentAnswer;
                        } else if (typeof q.studentAnswer === 'string' && q.studentAnswer.trim().startsWith('{')) {
                            try { sMap = JSON.parse(q.studentAnswer); } catch (e) { sMap = {}; }
                        } else if (q.studentAnswer) {
                            sMap = { '1': q.studentAnswer };
                        }

                        let cMap = {};
                        if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
                            cMap = q.correctAnswer;
                        } else if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim().startsWith('{')) {
                            try { cMap = JSON.parse(q.correctAnswer); } catch (e) { cMap = {}; }
                        } else if (q.correctAnswer) {
                            cMap = { '1': q.correctAnswer };
                        }

                        let statements = q.options || [];
                        if (statements.length === 2 && (statements[0].id === 'TRUE' || statements[0].text === 'Benar' || statements[0].text === 'Sesuai' || statements[0].text === 'Tepat')) {
                            statements = [{ id: '1', text: q.questionText }];
                        }

                        return `
                            <div style="overflow-x: auto; margin-top: 0.5rem; margin-bottom: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: #ffffff;">
                                <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem; text-align: left;">
                                    <thead>
                                        <tr style="background: #e0f2fe; color: #0369a1; border-bottom: 2px solid #bae6fd;">
                                            <th style="padding: 8px 12px; width: 35px; text-align: center;">No</th>
                                            <th style="padding: 8px 12px;">Pernyataan</th>
                                            <th style="padding: 8px 12px; width: 110px; text-align: center;">Jawaban Siswa</th>
                                            <th style="padding: 8px 12px; width: 100px; text-align: center;">Kunci Resmi</th>
                                            <th style="padding: 8px 12px; width: 85px; text-align: center;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${statements.map((st, sIdx) => {
                                            let sVal = (sMap && sMap[st.id] !== undefined) ? String(sMap[st.id]).trim().toUpperCase() : '';
                                            let cVal = (cMap && cMap[st.id] !== undefined) ? String(cMap[st.id]).trim().toUpperCase() : '';
                                            if (sVal === 'BENAR' || sVal === 'B' || sVal === 'SESUAI' || sVal === 'TEPAT' || sVal === '1') sVal = 'TRUE';
                                            if (sVal === 'SALAH' || sVal === 'S' || sVal === 'TS' || sVal === 'TT' || sVal === 'TIDAK SESUAI' || sVal === 'TIDAK TEPAT' || sVal === '0') sVal = 'FALSE';
                                            if (cVal === 'BENAR' || cVal === 'B' || cVal === 'SESUAI' || cVal === 'TEPAT' || cVal === '1') cVal = 'TRUE';
                                            if (cVal === 'SALAH' || cVal === 'S' || cVal === 'TS' || cVal === 'TT' || cVal === 'TIDAK SESUAI' || cVal === 'TIDAK TEPAT' || cVal === '0') cVal = 'FALSE';

                                            const isStmtCorrect = sVal && cVal && sVal === cVal;
                                            const sText = sVal === 'TRUE' ? `<span class="text-success font-semibold">${tfLabels.positive}</span>` : (sVal === 'FALSE' ? `<span class="text-error font-semibold">${tfLabels.negative}</span>` : '<span class="text-muted italic">-</span>');
                                            const cText = cVal === 'TRUE' ? `<span class="text-success font-semibold">${tfLabels.positive}</span>` : (cVal === 'FALSE' ? `<span class="text-error font-semibold">${tfLabels.negative}</span>` : '-');

                                            return `
                                                <tr style="border-bottom: 1px solid var(--border-color); background: ${sIdx % 2 === 0 ? '#ffffff' : 'var(--bg-base)'};">
                                                    <td style="padding: 8px 12px; text-align: center; font-weight: bold; color: var(--text-secondary); vertical-align: middle;">${sIdx + 1}</td>
                                                    <td style="padding: 8px 12px; vertical-align: middle; line-height: 1.45; color: var(--text-primary); font-weight: 500;">${escapeHtml(st.text)}</td>
                                                    <td style="padding: 8px 12px; text-align: center; vertical-align: middle;">${sText}</td>
                                                    <td style="padding: 8px 12px; text-align: center; vertical-align: middle;">${cText}</td>
                                                    <td style="padding: 8px 12px; text-align: center; vertical-align: middle;">
                                                        <span class="badge ${isStmtCorrect ? 'badge-active' : 'badge-archived'}" style="font-size: 0.72rem; padding: 2px 6px;">
                                                            ${isStmtCorrect ? '<i class="ph ph-check"></i> Tepat' : '<i class="ph ph-x"></i> Keliru'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    })() : `
                        <!-- Jawaban Siswa -->
                        <div class="ans-box ${isCorr ? 'ans-box-student-correct' : 'ans-box-student-wrong'}">
                            <div class="ans-icon-wrap">
                                <i class="ph ${isCorr ? 'ph-check-circle' : 'ph-x-circle'}" style="font-size: 1.25rem;"></i>
                            </div>
                            <div class="ans-content-wrap">
                                <div class="text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.04em;">Jawaban Siswa:</div>
                                <div class="font-medium mt-1" style="font-size: 0.92rem; line-height: 1.5;">${studentAnsText}</div>
                            </div>
                        </div>

                        <!-- Kunci Jawaban Resmi Guru -->
                        <div class="ans-box ans-box-key">
                            <div class="ans-icon-wrap">
                                <i class="ph ph-key" style="font-size: 1.25rem;"></i>
                            </div>
                            <div class="ans-content-wrap">
                                <div class="text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.04em;">Kunci Jawaban Resmi:</div>
                                <div class="font-medium mt-1" style="font-size: 0.92rem; line-height: 1.5;">${keyText}</div>
                            </div>
                        </div>
                    `}

                    ${q.explanation ? `
                        <div class="mt-2.5 p-2.5 text-xs" style="background: var(--bg-base); border-radius: var(--radius-sm); border-left: 3px solid var(--info); color: var(--text-secondary); line-height: 1.45;">
                            <strong class="text-primary">Pembahasan:</strong> ${escapeHtml(q.explanation)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        UI.showModal(`
            <div class="attempt-detail-modal">
                <div class="flex justify-between items-center mb-3 pb-3" style="position: sticky; top: 0; background: #ffffff; z-index: 10; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary);">Lembar Jawaban Siswa</h3>
                        <p class="text-xs text-muted mt-0.5">${att.examTitle || 'Ujian Online'}</p>
                    </div>
                    <button class="btn btn-icon btn-secondary btn-sm" onclick="closeModal()" title="Tutup">
                        <i class="ph ph-x"></i>
                    </button>
                </div>

                <!-- Ringkasan Nilai & Identitas Siswa -->
                <div class="student-summary-box">
                    <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 0.75rem;">
                        <div>
                            <div class="text-base font-bold text-primary">${att.participantName}</div>
                            <div class="text-xs text-muted mt-0.5">
                                NIS: <strong>${att.nis}</strong> • Kelas: <strong>${att.className}</strong>
                            </div>
                            <div class="text-xs text-muted mt-0.5">
                                Percobaan: <strong>Ke-${att.attemptNumber || 1}</strong> • ${att.endAt ? new Date(att.endAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-muted">Nilai (KKM: ${att.kkm || 75})</div>
                            <div class="text-3xl font-black ${att.finalScore >= (att.kkm || 75) ? 'text-success' : 'text-error'}" style="line-height: 1.1;">
                                ${att.finalScore !== null ? att.finalScore : 0}
                            </div>
                            <span class="badge ${att.passStatus === 'LULUS' ? 'badge-active' : 'badge-archived'} mt-1 text-xs">
                                ${att.passStatus || (att.finalScore >= (att.kkm || 75) ? 'LULUS' : 'BELUM LULUS')}
                            </span>
                        </div>
                    </div>

                    <div class="stats-grid grid grid-cols-3 gap-2 mt-3 pt-3 text-center" style="border-top: 1px solid var(--border-color);">
                        <div style="background: #ffffff; padding: 0.4rem 0.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <div class="text-xs text-muted">Total Benar</div>
                            <div class="font-bold text-success text-sm">${att.totalCorrect !== undefined ? att.totalCorrect : '-'} Soal</div>
                        </div>
                        <div style="background: #ffffff; padding: 0.4rem 0.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <div class="text-xs text-muted">Total Salah</div>
                            <div class="font-bold text-error text-sm">${att.totalWrong !== undefined ? att.totalWrong : '-'} Soal</div>
                        </div>
                        <div style="background: #ffffff; padding: 0.4rem 0.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <div class="text-xs text-muted">Total Soal</div>
                            <div class="font-bold text-secondary text-sm">${att.totalQuestions || qList.length} Soal</div>
                        </div>
                    </div>
                </div>

                <h4 class="mb-3 text-sm font-semibold flex items-center gap-2">
                    <i class="ph ph-list-checks text-primary"></i> Evaluasi per Butir Soal:
                </h4>

                <div class="questions-review-list">
                    ${questionsHtml}
                </div>

                <div class="flex justify-end mt-4 pt-3" style="border-top: 1px solid var(--border-color);">
                    <button class="btn btn-secondary w-full sm:w-auto justify-center" onclick="closeModal()">
                        Tutup Lembar Jawaban
                    </button>
                </div>
            </div>
        `);
    } catch (e) {
        console.error("showStudentDetail error:", e);
        UI.showToast('Gagal memuat rincian: ' + (e.message || e), 'error');
        closeModal();
    }
};

window.filterResultsTable = function(query) {
    const q = (query || '').toLowerCase();
    
    // Filter desktop table rows
    const table = document.getElementById('resultsTable');
    if (table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(q) ? '' : 'none';
        });
    }

    // Filter mobile cards
    const mobileCards = document.querySelectorAll('.result-card-item');
    mobileCards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
    });
};

Router.addRoute('/teacher/results', renderTeacherResults);
Router.addRoute('/results', renderTeacherResults);

