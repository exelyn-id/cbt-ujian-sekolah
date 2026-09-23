Router.addRoute('/student/exam', async () => {
    if (AppState.mode !== 'student' || !AppState.attempt) {
        setTimeout(() => Router.navigate('/student/landing'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const exam = AppState.currentExam;
    const questions = AppState.questions || [];
    let currentIndex = 0; // Local state for pagination

    // Helper to render question
    window.renderQuestion = function(index) {
        currentIndex = index;
        const q = questions[index];
        const answers = AppState.answers[q.id] || [];
        
        let optionsHtml = '';
        if (q.type === 'MCQ') {
            optionsHtml = q.options.map(opt => {
                const isSel = answers === opt.id;
                return `
                    <label class="option-card ${isSel ? 'selected' : ''}">
                        <input type="radio" name="q_${q.id}" value="${opt.id}" ${isSel ? 'checked' : ''} onchange="handleAnswer('${q.id}', '${opt.id}', '${q.type}')">
                        <span class="opt-badge">${opt.id}</span>
                        <div class="opt-content">
                            <span>${escapeHtml(opt.text)}</span>
                            ${opt.imageUrl ? `<img src="${formatDirectImageUrl(opt.imageUrl)}" alt="Gambar Opsi" referrerpolicy="no-referrer" onerror="handleImgError(this)" style="max-height: 80px; max-width: 120px; object-fit: contain; border-radius: 4px; border: 1px solid var(--border-color); background: #ffffff;">` : ''}
                        </div>
                    </label>
                `;
            }).join('');
        } else if (q.type === 'TRUE_FALSE') {
            const tfLabels = getTfLabels(q.tfType);
            let statements = q.options || [];
            // Backward compatibility fallback for old single TRUE_FALSE
            if (statements.length === 2 && (statements[0].id === 'TRUE' || statements[0].text === 'Benar' || statements[0].text === 'Sesuai' || statements[0].text === 'Tepat')) {
                statements = [{ id: '1', text: q.text }];
            }
            const currentAns = (answers && typeof answers === 'object' && !Array.isArray(answers)) ? answers : {};

            optionsHtml = `
                <div class="table-responsive" style="overflow-x: auto; width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: #ffffff; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                        <thead>
                            <tr style="background: #e0f2fe; color: #0369a1; border-bottom: 2px solid #bae6fd;">
                                <th style="padding: 12px 16px; font-weight: 700; width: 66%;">Pernyataan</th>
                                <th style="padding: 12px 14px; text-align: center; width: 17%; font-weight: 700;">${tfLabels.positive}</th>
                                <th style="padding: 12px 14px; text-align: center; width: 17%; font-weight: 700;">${tfLabels.negative}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statements.map((opt, sIdx) => {
                                const val = currentAns[opt.id] || '';
                                const isPos = (val === 'TRUE' || val === 'BENAR' || val === 'B' || val === 'SESUAI' || val === 'TEPAT' || val === '1');
                                const isNeg = (val === 'FALSE' || val === 'SALAH' || val === 'S' || val === 'TS' || val === 'TT' || val === 'TIDAK SESUAI' || val === 'TIDAK TEPAT' || val === '0');
                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color); background: ${sIdx % 2 === 0 ? '#ffffff' : 'var(--bg-base)'};">
                                        <td style="padding: 12px 16px; vertical-align: middle; line-height: 1.5; color: var(--text-primary); font-weight: 500;">
                                            ${escapeHtml(opt.text)}
                                        </td>
                                        <td style="padding: 12px 14px; text-align: center; vertical-align: middle;">
                                            <label style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: pointer; margin: 0;" title="${tfLabels.positive}">
                                                <input type="radio" name="tf_${q.id}_${opt.id}" value="TRUE" ${isPos ? 'checked' : ''} 
                                                       onchange="handleTrueFalseAnswer('${q.id}', '${opt.id}', 'TRUE')" 
                                                       style="width: 1.35rem; height: 1.35rem; cursor: pointer; accent-color: var(--primary-600);">
                                            </label>
                                        </td>
                                        <td style="padding: 12px 14px; text-align: center; vertical-align: middle;">
                                            <label style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: pointer; margin: 0;" title="${tfLabels.negative}">
                                                <input type="radio" name="tf_${q.id}_${opt.id}" value="FALSE" ${isNeg ? 'checked' : ''} 
                                                       onchange="handleTrueFalseAnswer('${q.id}', '${opt.id}', 'FALSE')" 
                                                       style="width: 1.35rem; height: 1.35rem; cursor: pointer; accent-color: var(--primary-600);">
                                            </label>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (q.type === 'MCQ_COMPLEX') {
            const answerArr = Array.isArray(answers) ? answers : [];
            optionsHtml = q.options.map(opt => {
                const isSel = answerArr.includes(opt.id);
                return `
                    <label class="option-card ${isSel ? 'selected' : ''}">
                        <input type="checkbox" name="q_${q.id}" value="${opt.id}" ${isSel ? 'checked' : ''} onchange="handleAnswer('${q.id}', '${opt.id}', '${q.type}', event.target.checked)">
                        <span class="opt-badge">${opt.id}</span>
                        <div class="opt-content">
                            <span>${escapeHtml(opt.text)}</span>
                            ${opt.imageUrl ? `<img src="${formatDirectImageUrl(opt.imageUrl)}" alt="Gambar Opsi" referrerpolicy="no-referrer" onerror="handleImgError(this)" style="max-height: 80px; max-width: 120px; object-fit: contain; border-radius: 4px; border: 1px solid var(--border-color); background: #ffffff;">` : ''}
                        </div>
                    </label>
                `;
            }).join('');
        }

        const navHtml = `
            <div class="flex justify-between items-center mt-6 pt-4" style="border-top: 1px solid var(--border-color); gap: 0.5rem; width: 100%;">
                <button class="btn btn-secondary justify-center" style="flex: 1; max-width: 150px;" onclick="renderQuestion(${index - 1})" ${index === 0 ? 'disabled' : ''}>
                    <i class="ph ph-caret-left"></i> Sebelumnya
                </button>
                ${index === questions.length - 1 
                    ? `<button class="btn btn-primary justify-center" style="flex: 1; max-width: 200px;" onclick="submitExam()">Kumpulkan <i class="ph ph-check"></i></button>`
                    : `<button class="btn btn-primary justify-center" style="flex: 1; max-width: 160px;" onclick="renderQuestion(${index + 1})">Selanjutnya <i class="ph ph-caret-right"></i></button>`
                }
            </div>
        `;

        const typeBadge = q.type === 'MCQ' ? 'Pilihan Ganda' : (q.type === 'TRUE_FALSE' ? getTfLabels(q.tfType).name : 'Ganda Kompleks');
        const qImg = q.imageUrl || q.questionImageUrl || '';
        const formattedQImg = formatDirectImageUrl(qImg);

        document.getElementById('questionContainer').innerHTML = `
            <div class="flex justify-between items-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color); gap: 0.5rem;">
                <div class="flex items-center gap-2">
                    <span class="badge badge-active font-semibold">Soal ${index + 1} dari ${questions.length}</span>
                    <span class="badge text-xs" style="background: var(--bg-base);">${typeBadge}</span>
                </div>
                <span class="text-xs text-muted font-bold">${q.score || 10} Poin</span>
            </div>
            <div class="text-base sm:text-lg font-medium mb-4" style="line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; color: var(--text-primary);">
                ${escapeHtml(q.text)}
            </div>
            ${formattedQImg ? `
                <div class="mb-5 text-center" style="width: 100%; overflow: hidden;">
                    <img src="${formattedQImg}" 
                         alt="Gambar Soal" 
                         referrerpolicy="no-referrer" 
                         loading="lazy" 
                         onerror="handleImgError(this)" 
                         style="max-width: 100%; max-height: 320px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: inline-block; background: #ffffff; margin: 0 auto; box-shadow: var(--shadow-sm);">
                </div>
            ` : ''}
            ${q.bottomText ? `
                <div class="text-base sm:text-lg font-medium mb-4" style="line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; color: var(--text-primary);">
                    ${escapeHtml(q.bottomText)}
                </div>
            ` : ''}
            <div class="options-container mb-2" style="width: 100%;">
                ${optionsHtml}
            </div>
            ${navHtml}
        `;
        
        updateProgress();
    };

    let autosaveTimeout = null;
    const triggerAutosave = () => {
        const indicator = document.getElementById('autosaveIndicator');
        if (indicator) {
            indicator.innerHTML = '<i class="ph ph-spinner ph-spin text-warning"></i> Menyimpan...';
        }

        if (autosaveTimeout) clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(async () => {
            try {
                if (AppState.attempt && AppState.attempt.attemptId) {
                    await api.saveAttemptAnswers(AppState.attempt.attemptId, AppState.answers);
                    if (indicator) {
                        indicator.innerHTML = '<i class="ph ph-cloud-check text-success"></i> Tersimpan';
                    }
                }
            } catch (e) {
                if (indicator) {
                    indicator.innerHTML = '<i class="ph ph-warning text-error"></i> Gagal simpan';
                }
            }
        }, 600);
    };

    window.handleAnswer = function(questionId, optionId, type, isChecked = true) {
        if (type === 'MCQ') {
            AppState.answers[questionId] = optionId;
        } else if (type === 'MCQ_COMPLEX') {
            let current = AppState.answers[questionId] || [];
            if (!Array.isArray(current)) current = [];
            
            if (isChecked) {
                if (!current.includes(optionId)) current.push(optionId);
            } else {
                current = current.filter(id => id !== optionId);
            }
            AppState.answers[questionId] = current;
        }
        
        triggerAutosave();
        renderQuestion(currentIndex);
    };

    window.handleTrueFalseAnswer = function(questionId, statementId, value) {
        let current = AppState.answers[questionId];
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            current = {};
        }
        current[statementId] = value;
        AppState.answers[questionId] = current;

        triggerAutosave();
        renderQuestion(currentIndex);
    };

    window.updateProgress = function() {
        const gridHtml = questions.map((q, idx) => {
            let hasAnswer = false;
            const ans = AppState.answers[q.id];
            if (q.type === 'TRUE_FALSE') {
                const stmts = (q.options || []);
                if (stmts.length > 0 && ans && typeof ans === 'object' && !Array.isArray(ans)) {
                    hasAnswer = stmts.every(s => ans[s.id] !== undefined && ans[s.id] !== '');
                }
            } else if (q.type === 'MCQ_COMPLEX') {
                hasAnswer = Array.isArray(ans) && ans.length > 0;
            } else {
                hasAnswer = Boolean(ans);
            }
            const isCurrent = idx === currentIndex;
            
            let bg = hasAnswer ? 'var(--primary-500)' : 'var(--bg-base)';
            let color = hasAnswer ? 'white' : 'var(--text-secondary)';
            let border = isCurrent ? '2px solid var(--primary-600)' : '1px solid var(--border-color)';
            
            if(isCurrent && !hasAnswer) {
                bg = 'var(--primary-100)';
            }

            return `<button onclick="renderQuestion(${idx})" style="width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: ${bg}; color: ${color}; border: ${border}; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s;">${idx + 1}</button>`;
        }).join('');
        document.getElementById('progressGrid').innerHTML = gridHtml;
    };

    window.submitExam = function() {
        UI.showModal(`
            <div class="text-center">
                <i class="ph ph-warning-circle text-warning mb-2" style="font-size: 3rem;"></i>
                <h3 class="mb-2">Kumpulkan Ujian?</h3>
                <p class="text-muted text-sm mb-6">Pastikan semua soal telah dijawab. Jawaban yang telah dikirim tidak dapat diubah kembali.</p>
                <div class="flex justify-center gap-4">
                    <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
                    <button class="btn btn-primary" onclick="executeSubmit()">Ya, Kumpulkan</button>
                </div>
            </div>
        `);
    };

    window.executeSubmit = async function() {
        closeModal();
        if (AppState.timer) clearInterval(AppState.timer);

        document.getElementById('app').innerHTML = '<div class="loading-full"><i class="ph ph-spinner ph-spin"></i><span>Memproses dan menilai jawaban Anda...</span></div>';
        
        try {
            const res = await api.submitExamAttempt(AppState.attempt.attemptId, AppState.answers);
            if (res.success && res.data) {
                AppState.update({ 
                    attempt: { 
                        ...AppState.attempt, 
                        ...res.data,
                        status: 'SUBMITTED' 
                    } 
                });
                Router.navigate('/student/result');
            } else {
                UI.showToast(res.message || 'Gagal mengirim ujian.', 'error');
                Router.handleRoute(); // restore
            }
        } catch (e) {
            UI.showToast('Terjadi kesalahan koneksi server.', 'error');
            Router.handleRoute();
        }
    };

    // Timer Logic
    const updateTimer = () => {
        const now = Date.now();
        const diff = AppState.attempt.deadlineAt - now;
        
        if (diff <= 0) {
            clearInterval(AppState.timer);
            executeSubmit();
            return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const timerEl = document.getElementById('examTimer');
        if (timerEl) {
            timerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            if (m < 5) timerEl.style.color = 'var(--error)';
        }
    };
    
    if (AppState.timer) clearInterval(AppState.timer);
    AppState.timer = setInterval(updateTimer, 1000);

    // Initial Render Hook
    document.addEventListener('viewRendered', function onRender(e) {
        if (e.detail.path === '/student/exam') {
            renderQuestion(0);
            updateTimer();
            document.removeEventListener('viewRendered', onRender);
        }
    });

    return `
        <div class="view" style="background-color: var(--bg-base); min-height: 100vh; overflow-x: hidden; max-width: 100vw; width: 100%; box-sizing: border-box;">
            <!-- Sticky Header -->
            <div class="glass" style="position: sticky; top: 0; z-index: 100; padding: 0.75rem 0; width: 100%; box-sizing: border-box;">
                <div class="container flex justify-between items-center" style="gap: 0.5rem;">
                    <div style="min-width: 0; flex: 1;">
                        <div class="font-bold text-primary" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem;">${escapeHtml(exam.title)}</div>
                        <div class="text-xs text-muted" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(AppState.attempt.participantName)} - ${escapeHtml(AppState.attempt.className)}</div>
                    </div>
                    <div class="flex items-center gap-2" style="flex-shrink: 0;">
                        <div id="autosaveIndicator" class="text-xs font-medium flex items-center gap-1 hidden sm-flex">
                            <i class="ph ph-cloud-check text-success"></i> Tersimpan
                        </div>
                        <div class="card flex items-center gap-1.5" style="padding: 0.35rem 0.65rem; border-color: var(--primary-200); background: var(--primary-50);">
                            <i class="ph ph-timer text-primary"></i>
                            <span id="examTimer" class="font-bold" style="font-size: 1.05rem; font-family: monospace;">--:--</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="container mt-4" style="box-sizing: border-box; width: 100%; max-width: 100%;">
                <style>
                    .exam-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; align-items: start; width: 100%; max-width: 100%; box-sizing: border-box; }
                    @media (max-width: 768px) {
                        .exam-layout { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 100%; box-sizing: border-box; }
                        #questionContainer { order: 1; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
                        .sidebar-nav { order: 2; position: relative !important; top: 0 !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
                        .hidden.sm-flex { display: none; }
                    }
                </style>
                <div class="exam-layout">
                    <!-- Question Area (First on mobile) -->
                    <div class="card" id="questionContainer" style="min-height: 380px; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden;">
                        <!-- Injected by renderQuestion -->
                    </div>

                    <!-- Sidebar Progress (Below question on mobile) -->
                    <div class="card sidebar-nav" style="position: sticky; top: 80px;">
                        <h4 class="mb-4 text-sm font-semibold text-secondary">Navigasi Soal</h4>
                        <div id="progressGrid" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            <!-- Injected by updateProgress -->
                        </div>
                        <hr style="border:0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
                        <button class="btn btn-outline-primary w-full" onclick="submitExam()">Selesai Ujian</button>
                    </div>
                </div>
            </div>
        </div>
    `;
});
