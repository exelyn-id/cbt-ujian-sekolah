Router.addRoute('/question-builder', async (params) => {
    if (!AppState.user || (AppState.user.role !== 'TEACHER' && AppState.user.role !== 'ADMIN')) {
        setTimeout(() => Router.navigate('/login'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    const examId = params.get('examId');
    if (!examId) {
        setTimeout(() => Router.navigate('/dashboard'), 0);
        return `<div class="loading-full">Error...</div>`;
    }

    let questions = [];
    let exam = null;
    try {
        const [res, examRes] = await Promise.all([
            api.getQuestions(AppState.user.sessionId, examId),
            api.getExam(AppState.user.sessionId, examId)
        ]);
        if (res.success && Array.isArray(res.data)) {
            questions = res.data;
        } else {
            UI.showToast(res.message || 'Akses ditolak atau gagal memuat soal.', 'error');
            setTimeout(() => Router.navigate('/dashboard'), 0);
            return `<div class="loading-full">Mengalihkan...</div>`;
        }
        if (examRes && examRes.success && examRes.data) {
            exam = examRes.data;
        }
    } catch (e) {
        console.error("Error loading questions:", e);
        UI.showToast('Gagal memuat soal.', 'error');
        setTimeout(() => Router.navigate('/dashboard'), 0);
        return `<div class="loading-full">Mengalihkan...</div>`;
    }

    window.addQuestion = function(type) {
        let newQ = {
            id: 'Q_' + Math.floor(Math.random() * 90000 + 10000),
            type: type,
            text: '',
            bottomText: '',
            imageUrl: '',
            score: 10,
            durationSeconds: null,
            options: [],
            correctAnswer: null,
            scoringMethod: 'EXACT'
        };
        
        if (type === 'MCQ' || type === 'MCQ_COMPLEX') {
            newQ.options = [
                { id: 'A', text: '', imageUrl: '' },
                { id: 'B', text: '', imageUrl: '' },
                { id: 'C', text: '', imageUrl: '' },
                { id: 'D', text: '', imageUrl: '' }
            ];
            newQ.correctAnswer = type === 'MCQ' ? 'A' : ['A'];
        } else if (type === 'TRUE_FALSE') {
            newQ.options = [
                { id: '1', text: '' },
                { id: '2', text: '' },
                { id: '3', text: '' }
            ];
            newQ.correctAnswer = { '1': 'TRUE', '2': 'TRUE', '3': 'FALSE' };
            newQ.scoringMethod = 'EXACT';
            newQ.tfType = 'BENAR_SALAH';
        }
        
        questions.push(newQ);
        renderQuestionsList();

        // Smooth scroll directly to the newly added question card & focus
        setTimeout(() => {
            const cards = document.querySelectorAll('#questionsListContainer .question-card-item');
            if (cards.length > 0) {
                const lastCard = cards[cards.length - 1];
                lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const textarea = lastCard.querySelector('textarea');
                if (textarea) {
                    textarea.focus();
                }
            }
        }, 120);
    };

    window.deleteQuestion = function(id) {
        if (!confirm('Hapus soal ini?')) return;
        questions = questions.filter(q => q.id !== id);
        renderQuestionsList();
    };

    window.addOption = function(qIndex) {
        const q = questions[qIndex];
        if (!q) return;
        const nextLetter = String.fromCharCode(65 + q.options.length);
        q.options.push({ id: nextLetter, text: `Pilihan ${nextLetter}`, imageUrl: '' });
        renderQuestionsList();
    };

    window.removeOption = function(qIndex, optIndex) {
        const q = questions[qIndex];
        if (!q || q.options.length <= 2) {
            UI.showToast('Minimal harus ada 2 opsi pilihan.', 'warning');
            return;
        }
        q.options.splice(optIndex, 1);
        renderQuestionsList();
    };

    window.addStatement = function(qIndex) {
        const q = questions[qIndex];
        if (!q) return;
        if (!Array.isArray(q.options)) q.options = [];
        if (q.options.length >= 5) {
            UI.showToast('Maksimal 5 pernyataan per soal.', 'warning');
            return;
        }
        const nextId = String(q.options.length + 1);
        q.options.push({ id: nextId, text: '' });
        if (typeof q.correctAnswer !== 'object' || !q.correctAnswer || Array.isArray(q.correctAnswer)) {
            q.correctAnswer = {};
        }
        q.correctAnswer[nextId] = 'TRUE';
        renderQuestionsList();
    };

    window.removeStatement = function(qIndex, sIndex) {
        const q = questions[qIndex];
        if (!q || !Array.isArray(q.options)) return;
        if (q.options.length <= 1) {
            UI.showToast('Minimal harus ada 1 pernyataan.', 'warning');
            return;
        }
        q.options.splice(sIndex, 1);
        // Re-index statements to 1, 2, 3...
        const oldKeyMap = (typeof q.correctAnswer === 'object' && q.correctAnswer && !Array.isArray(q.correctAnswer)) ? q.correctAnswer : {};
        const newKeyMap = {};
        q.options.forEach((opt, idx) => {
            const oldId = opt.id;
            const newId = String(idx + 1);
            opt.id = newId;
            newKeyMap[newId] = oldKeyMap[oldId] || 'TRUE';
        });
        q.correctAnswer = newKeyMap;
        renderQuestionsList();
    };

    window.updateStatementText = function(qIndex, sIndex, text) {
        if (questions[qIndex] && questions[qIndex].options && questions[qIndex].options[sIndex]) {
            questions[qIndex].options[sIndex].text = text;
        }
    };

    window.setStatementKey = function(qIndex, sId, keyVal) {
        const q = questions[qIndex];
        if (!q) return;
        if (typeof q.correctAnswer !== 'object' || !q.correctAnswer || Array.isArray(q.correctAnswer)) {
            q.correctAnswer = {};
        }
        q.correctAnswer[sId] = keyVal;
    };

    window.setTfFormat = function(qIndex, newFormat) {
        if (!questions[qIndex]) return;
        questions[qIndex].tfType = newFormat;
        renderQuestionsList();
    };

    function getQuestionCustomPointsTotal(q) {
        if (!q || !Array.isArray(q.options) || q.scoringMethod !== 'PARTIAL') return 0;
        let sum = 0;
        let hasCustom = false;
        if (q.type === 'TRUE_FALSE') {
            q.options.forEach(o => {
                if (o.score !== undefined && o.score !== null && o.score !== '' && Number(o.score) > 0) {
                    sum += Number(o.score);
                    hasCustom = true;
                }
            });
        } else if (q.type === 'MCQ_COMPLEX') {
            const answerArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
            q.options.forEach(o => {
                if (answerArr.includes(o.id) && o.score !== undefined && o.score !== null && o.score !== '' && Number(o.score) > 0) {
                    sum += Number(o.score);
                    hasCustom = true;
                }
            });
            if (!hasCustom) {
                q.options.forEach(o => {
                    if (o.score !== undefined && o.score !== null && o.score !== '' && Number(o.score) > 0) {
                        sum += Number(o.score);
                        hasCustom = true;
                    }
                });
            }
        }
        return hasCustom ? Math.round(sum * 100) / 100 : 0;
    }

    window.checkQuestionScoreWarning = function(qIndex) {
        const q = questions[qIndex];
        if (!q) return;
        const warningEl = document.getElementById(`q-score-warning-${qIndex}`);
        const scoreInput = document.getElementById(`q-score-input-${qIndex}`);
        const scoreBadge = document.getElementById(`q-score-badge-${qIndex}`);
        const totalPoints = getQuestionCustomPointsTotal(q);
        const qScore = Number(q.score || 0);

        const isExceeded = (q.scoringMethod === 'PARTIAL' && totalPoints > 0 && totalPoints > qScore);

        if (scoreInput) {
            if (isExceeded) {
                scoreInput.style.borderColor = '#ef4444';
                scoreInput.style.backgroundColor = '#fef2f2';
                scoreInput.style.color = '#b91c1c';
                scoreInput.style.fontWeight = 'bold';
            } else {
                scoreInput.style.borderColor = '';
                scoreInput.style.backgroundColor = '';
                scoreInput.style.color = '';
                scoreInput.style.fontWeight = '';
            }
        }

        if (scoreBadge) {
            if (isExceeded) {
                scoreBadge.style.display = 'inline-flex';
                scoreBadge.innerHTML = `<i class="ph ph-warning-circle"></i> Opsi total: ${totalPoints} poin`;
            } else {
                scoreBadge.style.display = 'none';
                scoreBadge.innerHTML = '';
            }
        }

        if (warningEl) {
            if (isExceeded) {
                warningEl.style.display = 'block';
                const labelTarget = q.type === 'TRUE_FALSE' ? 'Pernyataan' : 'Opsi Kunci';
                warningEl.innerHTML = `
                    <div class="p-3 mb-3 flex items-center justify-between text-xs" style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: var(--radius-sm); color: #991b1b; gap: 0.75rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
                        <div class="flex items-center gap-2.5">
                            <span style="background: #fee2e2; color: #dc2626; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                                <i class="ph ph-warning"></i>
                            </span>
                            <div>
                                <div class="font-bold" style="font-size: 0.82rem; color: #991b1b;">
                                    Peringatan: Total Poin ${labelTarget} (${totalPoints}) Melebihi Skor Soal (${qScore})!
                                </div>
                                <div class="mt-0.5" style="color: #b91c1c; font-size: 0.75rem;">
                                    Harap ubah <strong>Skor / Poin Soal</strong> minimal menjadi <strong>${totalPoints}</strong> agar penilaian parsial siswa akurat dan tidak terpotong.
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm flex items-center gap-1" onclick="syncQuestionScoreWithCustomPoints(${qIndex})" style="background: #dc2626; color: white; border: none; font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 600; flex-shrink: 0; border-radius: var(--radius-sm); cursor: pointer;">
                            <i class="ph ph-arrow-up-right"></i> Ubah Skor Soal Jadi ${totalPoints}
                        </button>
                    </div>
                `;
            } else {
                warningEl.style.display = 'none';
                warningEl.innerHTML = '';
            }
        }
    };

    window.updateQuestionField = function(index, field, value) {
        if (questions[index]) {
            questions[index][field] = value;
            if (field === 'score' || field === 'scoringMethod') {
                checkQuestionScoreWarning(index);
            }
        }
    };

    window.updateOptionScore = function(qIndex, optIndex, value) {
        if (questions[qIndex] && questions[qIndex].options && questions[qIndex].options[optIndex]) {
            const v = String(value).trim();
            questions[qIndex].options[optIndex].score = v === '' ? null : Number(v);
            checkQuestionScoreWarning(qIndex);
        }
    };

    window.updateStatementScore = function(qIndex, sIndex, value) {
        if (questions[qIndex] && questions[qIndex].options && questions[qIndex].options[sIndex]) {
            const v = String(value).trim();
            questions[qIndex].options[sIndex].score = v === '' ? null : Number(v);
            checkQuestionScoreWarning(qIndex);
        }
    };

    window.syncQuestionScoreWithCustomPoints = function(qIndex) {
        const q = questions[qIndex];
        if (!q || !Array.isArray(q.options)) return;
        let sum = 0;
        if (q.type === 'TRUE_FALSE') {
            q.options.forEach(o => {
                if (o.score !== undefined && o.score !== null && o.score !== '') {
                    sum += Number(o.score);
                }
            });
        } else if (q.type === 'MCQ_COMPLEX') {
            const answerArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
            q.options.forEach(o => {
                if (answerArr.includes(o.id) && o.score !== undefined && o.score !== null && o.score !== '') {
                    sum += Number(o.score);
                }
            });
            if (sum === 0) {
                q.options.forEach(o => {
                    if (o.score !== undefined && o.score !== null && o.score !== '') {
                        sum += Number(o.score);
                    }
                });
            }
        }
        if (sum > 0) {
            q.score = Math.round(sum * 100) / 100;
            const scoreInput = document.getElementById(`q-score-input-${qIndex}`);
            if (scoreInput) scoreInput.value = q.score;
            checkQuestionScoreWarning(qIndex);
            renderQuestionsList();
            UI.showToast(`Skor total soal disesuaikan menjadi ${q.score} poin.`, 'success');
        }
    };

    window.updateOptionText = function(qIndex, optIndex, value) {
        if (questions[qIndex] && questions[qIndex].options[optIndex]) {
            questions[qIndex].options[optIndex].text = value;
        }
    };

    window.updateOptionImage = function(qIndex, optIndex, value) {
        if (questions[qIndex] && questions[qIndex].options[optIndex]) {
            questions[qIndex].options[optIndex].imageUrl = formatDirectImageUrl(value);
        }
    };

    window.updateQuestionImageUrl = function(index, value) {
        if (questions[index]) {
            questions[index].imageUrl = formatDirectImageUrl(value);
            const previewContainer = document.getElementById(`imgPreview_${index}`);
            if (previewContainer) {
                if (questions[index].imageUrl) {
                    previewContainer.innerHTML = `
                        <div class="mt-2 p-2 flex items-center gap-3" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                            <img src="${formatDirectImageUrl(questions[index].imageUrl)}" 
                                 referrerpolicy="no-referrer"
                                 onerror="handleImgError(this)" 
                                 style="max-height: 85px; max-width: 140px; object-fit: contain; border-radius: 4px; background: #fafafa; border: 1px solid var(--border-color);">
                            <div class="flex-1" style="min-width: 0;">
                                <div class="text-xs font-bold text-primary flex items-center gap-1">
                                    <i class="ph ph-image"></i> Gambar Terpasang
                                </div>
                                <div class="text-xs text-muted mt-0.5 truncate" style="max-width: 250px;" title="${escapeHtml(questions[index].imageUrl)}">
                                    ${escapeHtml(questions[index].imageUrl)}
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm text-error mt-1.5" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="removeQuestionImage(${index})">
                                    <i class="ph ph-trash"></i> Hapus Gambar
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    previewContainer.innerHTML = '';
                }
            }
        }
    };

    window.removeQuestionImage = function(index) {
        if (questions[index]) {
            questions[index].imageUrl = '';
            renderQuestionsList();
            UI.showToast('Gambar soal berhasil dihapus.', 'info');
        }
    };

    window.handlePasteImage = async function(e, targetType, qIndex, optIndex = null) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (!file) continue;

                    UI.showToast('Membaca & mengunggah gambar dari clipboard...', 'info');

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64 = event.target.result;
                        try {
                            const filename = 'paste_' + Date.now() + '.png';
                            const res = await api.uploadImage(AppState.user.sessionId, base64, filename, file.type || 'image/png');
                            if (res.success && res.data && res.data.url) {
                                const directUrl = formatDirectImageUrl(res.data.url);
                                if (targetType === 'question') {
                                    questions[qIndex].imageUrl = directUrl;
                                } else if (targetType === 'option' && optIndex !== null) {
                                    questions[qIndex].options[optIndex].imageUrl = directUrl;
                                }
                                renderQuestionsList();
                                UI.showToast('Gambar berhasil ditempel & disimpan!', 'success');
                            } else {
                                UI.showToast(res.message || 'Gagal mengunggah gambar clipboard.', 'error');
                            }
                        } catch (err) {
                            UI.showToast('Gagal memproses gambar: ' + err.message, 'error');
                        }
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }
        }
    };

    window.triggerClipboardPaste = async function(qIndex, optIndex = null) {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            UI.showToast('Tekan Ctrl+V langsung pada kotak teks soal untuk menempel gambar.', 'info');
            return;
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            let foundImg = false;
            for (const item of clipboardItems) {
                const imgType = item.types.find(type => type.startsWith('image/'));
                if (imgType) {
                    foundImg = true;
                    UI.showToast('Mengunggah gambar dari clipboard...', 'info');
                    const blob = await item.getType(imgType);
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        const base64 = evt.target.result;
                        const res = await api.uploadImage(AppState.user.sessionId, base64, 'paste_' + Date.now() + '.png', imgType);
                        if (res.success && res.data && res.data.url) {
                            const directUrl = formatDirectImageUrl(res.data.url);
                            if (optIndex !== null) {
                                questions[qIndex].options[optIndex].imageUrl = directUrl;
                            } else {
                                questions[qIndex].imageUrl = directUrl;
                            }
                            renderQuestionsList();
                            UI.showToast('Gambar berhasil ditempel & disimpan!', 'success');
                        } else {
                            UI.showToast(res.message || 'Gagal mengunggah gambar clipboard.', 'error');
                        }
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
            if (!foundImg) {
                UI.showToast('Tidak ada gambar di clipboard. Copy gambar terlebih dahulu lalu tekan Ctrl+V atau klik tombol ini.', 'warning');
            }
        } catch (e) {
            UI.showToast('Silakan tekan Ctrl+V langsung pada teks pertanyaan untuk menempel gambar.', 'info');
        }
    };

    window.setSingleAnswer = function(qIndex, optId) {
        if (questions[qIndex]) {
            questions[qIndex].correctAnswer = optId;
        }
    };

    window.toggleComplexAnswer = function(qIndex, optId, isChecked) {
        const q = questions[qIndex];
        if (!q) return;
        let arr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
        if (isChecked) {
            if (!arr.includes(optId)) arr.push(optId);
        } else {
            arr = arr.filter(id => id !== optId);
        }
        q.correctAnswer = arr;
    };

    window.triggerImageUpload = function(targetType, qIndex, optIndex = null) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp,image/gif';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            UI.showToast('Mengunggah gambar...', 'info');

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                const res = await api.uploadImage(AppState.user.sessionId, base64, file.name, file.type);
                if (res.success && res.data) {
                    UI.showToast('Gambar berhasil diunggah!', 'success');
                    const directUrl = formatDirectImageUrl(res.data.url);
                    if (targetType === 'question') {
                        questions[qIndex].imageUrl = directUrl;
                    } else if (targetType === 'option') {
                        questions[qIndex].options[optIndex].imageUrl = directUrl;
                    }
                    renderQuestionsList();
                } else {
                    UI.showToast(res.message || 'Gagal mengunggah gambar', 'error');
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    window.renderQuestionsList = function() {
        const container = document.getElementById('questionsListContainer');
        if (!container) return;

        let cardsHtml = '';
        if (questions.length === 0) {
            cardsHtml = `
                <div class="text-center py-8 card mb-4" style="border: 2px dashed var(--border-color); box-shadow: none;">
                    <i class="ph ph-file-dashed text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2 font-medium">Belum ada soal pada ujian ini.</p>
                    <p class="text-xs text-muted mb-4">Gunakan tombol di bawah atau menu samping untuk menambahkan soal atau import dari Excel.</p>
                </div>
            `;
        } else {
            cardsHtml = questions.map((q, qIndex) => {
                let optionsHtml = '';
                if (q.type === 'MCQ') {
                    optionsHtml = q.options.map((opt, optIndex) => `
                        <div class="option-builder-row">
                            <div class="flex items-center gap-2" style="flex-grow: 1; min-width: 200px;">
                                <input type="radio" name="correct_${q.id}" ${q.correctAnswer === opt.id ? 'checked' : ''} onchange="setSingleAnswer(${qIndex}, '${opt.id}')" style="width:1.25rem; height:1.25rem; cursor:pointer; flex-shrink: 0;" title="Jadikan Kunci Jawaban">
                                <input type="text" class="input-control opt-text-input" style="padding:0.4rem; flex-grow: 1;" value="${escapeHtml(opt.text)}" oninput="updateOptionText(${qIndex}, ${optIndex}, this.value)" placeholder="Teks opsi ${opt.id}">
                            </div>
                            <div class="opt-extra">
                                <input type="text" class="input-control" style="padding:0.4rem; width: 130px;" value="${escapeHtml(opt.imageUrl || '')}" oninput="updateOptionImage(${qIndex}, ${optIndex}, this.value)" onpaste="handlePasteImage(event, 'option', ${qIndex}, ${optIndex})" placeholder="URL Gambar">
                                <button type="button" class="btn btn-icon btn-secondary btn-sm" onclick="triggerImageUpload('option', ${qIndex}, ${optIndex})" title="Upload Gambar Opsi"><i class="ph ph-upload-simple"></i></button>
                                <button type="button" class="btn btn-icon btn-outline-primary btn-sm" onclick="triggerClipboardPaste(${qIndex}, ${optIndex})" title="Paste Gambar Clipboard (Ctrl+V)"><i class="ph ph-clipboard-text"></i></button>
                                <button type="button" class="btn btn-icon btn-secondary text-error btn-sm" onclick="removeOption(${qIndex}, ${optIndex})" title="Hapus Opsi"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    `).join('');
                } else if (q.type === 'TRUE_FALSE') {
                    // Normalize options if legacy single TRUE/FALSE
                    if (!Array.isArray(q.options) || q.options.length === 0 || (q.options.length === 2 && (q.options[0].id === 'TRUE' || q.options[0].text === 'Benar' || q.options[0].text === 'Sesuai' || q.options[0].text === 'Tepat'))) {
                        q.options = [
                            { id: '1', text: '' },
                            { id: '2', text: '' },
                            { id: '3', text: '' }
                        ];
                    }
                    if (typeof q.correctAnswer !== 'object' || !q.correctAnswer || Array.isArray(q.correctAnswer)) {
                        q.correctAnswer = { '1': 'TRUE', '2': 'TRUE', '3': 'FALSE' };
                    }
                    const tfType = q.tfType || 'BENAR_SALAH';
                    const tfLabels = getTfLabels(tfType);

                    const isPartial = q.scoringMethod === 'PARTIAL';
                    optionsHtml = `
                        <div class="tf-builder-table-wrap mb-3" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: #ffffff;">
                            <!-- Header Bar with Format Selector -->
                            <div style="background: #f0f9ff; padding: 0.65rem 0.85rem; border-bottom: 1px solid #bae6fd; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-xs" style="color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em;">
                                        <i class="ph ph-table"></i> Format Pilihan:
                                    </span>
                                    <select class="input-control" style="padding: 0.25rem 0.6rem; font-size: 0.8rem; font-weight: 600; width: auto; background: #ffffff; border-color: #7dd3fc; color: #0369a1;" 
                                            onchange="setTfFormat(${qIndex}, this.value)">
                                        <option value="BENAR_SALAH" ${tfType === 'BENAR_SALAH' ? 'selected' : ''}>Benar, Salah</option>
                                        <option value="SESUAI_TIDAK" ${tfType === 'SESUAI_TIDAK' ? 'selected' : ''}>Sesuai, Tidak Sesuai</option>
                                        <option value="TEPAT_TIDAK" ${tfType === 'TEPAT_TIDAK' ? 'selected' : ''}>Tepat, Tidak Tepat</option>
                                    </select>
                                </div>
                                <div class="flex items-center gap-2">
                                    ${isPartial ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.72rem; padding: 2px 7px;"><i class="ph ph-sliders"></i> Bobot Poin Kustom</span>' : ''}
                                    <span class="text-xs text-muted font-medium">${q.options.length} / 5 Pernyataan</span>
                                </div>
                            </div>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                    <thead>
                                        <tr style="background: var(--bg-base); border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                                            <th style="padding: 8px 10px; width: 40px; text-align: center;">No</th>
                                            <th style="padding: 8px 10px; text-align: left;">Teks Pernyataan</th>
                                            <th style="padding: 8px 10px; width: 220px; text-align: center;">Kunci (${tfLabels.positive} / ${tfLabels.negative})</th>
                                            ${isPartial ? '<th style="padding: 8px 10px; width: 100px; text-align: center;" title="Poin kustom untuk pernyataan ini jika dijawab sesuai kunci">Poin</th>' : ''}
                                            <th style="padding: 8px 10px; width: 50px; text-align: center;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${q.options.map((opt, sIdx) => {
                                            const currentKey = (q.correctAnswer && q.correctAnswer[opt.id]) ? q.correctAnswer[opt.id] : 'TRUE';
                                            return `
                                                <tr style="border-bottom: 1px solid var(--border-color);">
                                                    <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: var(--text-secondary); vertical-align: middle;">
                                                        ${sIdx + 1}
                                                    </td>
                                                    <td style="padding: 6px 10px; vertical-align: middle;">
                                                        <input type="text" class="input-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; width: 100%;" 
                                                               value="${escapeHtml(opt.text)}" 
                                                               oninput="updateStatementText(${qIndex}, ${sIdx}, this.value)" 
                                                               placeholder="Tuliskan pernyataan ${sIdx + 1} di sini...">
                                                    </td>
                                                    <td style="padding: 6px 10px; text-align: center; vertical-align: middle;">
                                                        <div class="flex items-center justify-center gap-3">
                                                            <label class="flex items-center gap-1" style="cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #16a34a;">
                                                                <input type="radio" name="tf_key_${q.id}_${opt.id}" value="TRUE" ${currentKey === 'TRUE' ? 'checked' : ''} onchange="setStatementKey(${qIndex}, '${opt.id}', 'TRUE')">
                                                                ${tfLabels.positive}
                                                            </label>
                                                            <label class="flex items-center gap-1" style="cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #dc2626;">
                                                                <input type="radio" name="tf_key_${q.id}_${opt.id}" value="FALSE" ${currentKey === 'FALSE' ? 'checked' : ''} onchange="setStatementKey(${qIndex}, '${opt.id}', 'FALSE')">
                                                                ${tfLabels.negative}
                                                            </label>
                                                        </div>
                                                    </td>
                                                    ${isPartial ? `
                                                        <td style="padding: 6px 10px; text-align: center; vertical-align: middle;">
                                                            <input type="number" class="input-control" 
                                                                   style="padding: 0.35rem 0.5rem; width: 75px; text-align: center; font-weight: bold; margin: 0 auto; color: #15803d; background: #f0fdf4; border-color: #86efac;" 
                                                                   value="${(opt.score !== undefined && opt.score !== null && opt.score !== '') ? opt.score : ''}" 
                                                                   placeholder="Auto" 
                                                                   min="0" step="any"
                                                                   oninput="updateStatementScore(${qIndex}, ${sIdx}, this.value)" 
                                                                   title="Poin untuk pernyataan ini jika dijawab sesuai kunci. Kosongkan untuk bagi rata.">
                                                        </td>
                                                    ` : ''}
                                                    <td style="padding: 6px 10px; text-align: center; vertical-align: middle;">
                                                        <button type="button" class="btn btn-icon btn-secondary btn-sm text-error" onclick="removeStatement(${qIndex}, ${sIdx})" title="Hapus Pernyataan" ${q.options.length <= 1 ? 'disabled' : ''}>
                                                            <i class="ph ph-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div style="padding: 0.5rem 0.85rem; background: var(--bg-base); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="addStatement(${qIndex})" ${q.options.length >= 5 ? 'disabled' : ''} style="font-size: 0.78rem;">
                                    <i class="ph ph-plus"></i> Tambah Pernyataan ${q.options.length >= 5 ? '(Maksimal 5)' : `(${q.options.length}/5)`}
                                </button>
                                ${isPartial ? (() => {
                                    let cSum = 0;
                                    q.options.forEach(o => { if (o.score !== undefined && o.score !== null && o.score !== '') cSum += Number(o.score); });
                                    return cSum > 0 ? `
                                        <button type="button" class="btn btn-secondary btn-sm" onclick="syncQuestionScoreWithCustomPoints(${qIndex})" style="font-size: 0.75rem; padding: 3px 8px; color: #15803d; font-weight: 600;" title="Klik untuk menyamakan Skor Total Soal dengan jumlah total poin pernyataan">
                                            <i class="ph ph-equals"></i> Total Poin: ${cSum} (Klik untuk Samakan Skor)
                                        </button>
                                    ` : '<span class="text-xs text-muted">Isi kolom Poin jika ingin bobot antar pernyataan tidak imbang</span>';
                                })() : ''}
                            </div>
                        </div>
                    `;
                } else if (q.type === 'MCQ_COMPLEX') {
                    const answerArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                    const isPartial = q.scoringMethod === 'PARTIAL';
                    optionsHtml = q.options.map((opt, optIndex) => {
                        const isChecked = answerArr.includes(opt.id);
                        return `
                            <div class="option-builder-row">
                                <div class="flex items-center gap-2" style="flex-grow: 1; min-width: 200px;">
                                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleComplexAnswer(${qIndex}, '${opt.id}', this.checked)" style="width:1.25rem; height:1.25rem; cursor:pointer; flex-shrink: 0;" title="Centang jika merupakan kunci benar">
                                    <input type="text" class="input-control opt-text-input" style="padding:0.4rem; flex-grow: 1;" value="${escapeHtml(opt.text)}" oninput="updateOptionText(${qIndex}, ${optIndex}, this.value)" placeholder="Teks opsi ${opt.id}">
                                </div>
                                ${isPartial ? `
                                    <div class="flex items-center gap-1" style="flex-shrink: 0; background: ${isChecked ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-base)'}; padding: 3px 6px; border-radius: var(--radius-sm); border: 1px solid ${isChecked ? '#86efac' : 'var(--border-color)'};" title="Atur poin khusus untuk opsi ${opt.id}">
                                        <span class="text-xs font-semibold ${isChecked ? 'text-success' : 'text-muted'}">Poin:</span>
                                        <input type="number" class="input-control" 
                                               style="padding: 0.25rem 0.4rem; width: 62px; text-align: center; font-weight: bold; color: ${isChecked ? '#15803d' : 'var(--text-secondary)'};" 
                                               value="${(opt.score !== undefined && opt.score !== null && opt.score !== '') ? opt.score : ''}" 
                                               placeholder="${isChecked ? 'Auto' : '0'}" 
                                               min="0" step="any"
                                               oninput="updateOptionScore(${qIndex}, ${optIndex}, this.value)">
                                    </div>
                                ` : ''}
                                <div class="opt-extra">
                                    <input type="text" class="input-control" style="padding:0.4rem; width: 130px;" value="${escapeHtml(opt.imageUrl || '')}" oninput="updateOptionImage(${qIndex}, ${optIndex}, this.value)" onpaste="handlePasteImage(event, 'option', ${qIndex}, ${optIndex})" placeholder="URL Gambar">
                                    <button type="button" class="btn btn-icon btn-secondary btn-sm" onclick="triggerImageUpload('option', ${qIndex}, ${optIndex})" title="Upload Gambar Opsi"><i class="ph ph-upload-simple"></i></button>
                                    <button type="button" class="btn btn-icon btn-outline-primary btn-sm" onclick="triggerClipboardPaste(${qIndex}, ${optIndex})" title="Paste Gambar Clipboard (Ctrl+V)"><i class="ph ph-clipboard-text"></i></button>
                                    <button type="button" class="btn btn-icon btn-secondary text-error btn-sm" onclick="removeOption(${qIndex}, ${optIndex})" title="Hapus Opsi"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    if (isPartial) {
                        let customSum = 0;
                        q.options.forEach(o => {
                            if (answerArr.includes(o.id) && o.score !== undefined && o.score !== null && o.score !== '') {
                                customSum += Number(o.score);
                            }
                        });
                        optionsHtml += `
                            <div class="p-2 mt-2 flex items-center justify-between text-xs" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); color: #166534; flex-wrap: wrap; gap: 0.5rem;">
                                <span><i class="ph ph-sliders"></i> <strong>Bobot Parsial Pilihan Ganda Kompleks:</strong> Anda dapat mengatur poin yang berbeda/tidak seimbang di tiap opsi jawaban (misal Opsi A = 2, Opsi C = 8). Kosongkan untuk bagi rata otomatis.</span>
                                ${customSum > 0 ? `
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="syncQuestionScoreWithCustomPoints(${qIndex})" style="font-size: 0.72rem; padding: 2px 8px; flex-shrink: 0; color: #15803d; font-weight: 600;">
                                        <i class="ph ph-equals"></i> Total Poin Kunci: ${customSum} (Samakan Skor Soal)
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }
                }

                const totalCustomPoints = getQuestionCustomPointsTotal(q);
                const qScoreNum = Number(q.score || 0);
                const isScoreExceeded = (q.scoringMethod === 'PARTIAL' && totalCustomPoints > 0 && totalCustomPoints > qScoreNum);

                return `
                    <div class="card mb-4 question-card-item">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-2">
                                <span class="badge badge-active">Soal #${qIndex + 1}</span>
                                <span class="text-xs text-muted font-mono bg-base" style="padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${q.type === 'TRUE_FALSE' ? getTfLabels(q.tfType).name : q.type}</span>
                            </div>
                            <button class="btn btn-icon btn-danger btn-sm" onclick="deleteQuestion('${q.id}')" title="Hapus Soal">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-4 gap-4 mb-4">
                            <div style="grid-column: span 3;">
                                <label class="input-label text-xs">Teks Pertanyaan (Bagian Atas Gambar)</label>
                                <textarea class="input-control" rows="2" 
                                          placeholder="Tuliskan teks pertanyaan soal bagian atas di sini... (Bisa langsung Ctrl+V untuk menempel gambar)" 
                                          oninput="updateQuestionField(${qIndex}, 'text', this.value)"
                                          onpaste="handlePasteImage(event, 'question', ${qIndex})">${escapeHtml(q.text)}</textarea>
                                
                                <div class="flex items-center gap-2 mt-2" style="flex-wrap: wrap;">
                                    <input type="text" class="input-control" style="flex: 1; min-width: 180px;" 
                                           placeholder="URL Gambar (atau Paste link Drive/Web di sini)" 
                                           value="${q.imageUrl || ''}" 
                                           oninput="updateQuestionImageUrl(${qIndex}, this.value)"
                                           onpaste="handlePasteImage(event, 'question', ${qIndex})">
                                    <button type="button" class="btn btn-secondary btn-sm flex items-center gap-1" 
                                            onclick="triggerImageUpload('question', ${qIndex})" title="Upload file gambar dari perangkat">
                                        <i class="ph ph-upload-simple"></i> Upload
                                    </button>
                                    <button type="button" class="btn btn-outline-primary btn-sm flex items-center gap-1" 
                                            onclick="triggerClipboardPaste(${qIndex})" title="Paste gambar dari clipboard (Ctrl+V)">
                                        <i class="ph ph-clipboard-text"></i> Paste Gambar
                                    </button>
                                </div>
                                
                                <div class="mt-1 text-xs text-muted flex items-center gap-1.5" style="font-size: 0.75rem;">
                                    <i class="ph ph-info text-primary"></i>
                                    <span>Tips: Bisa langsung <strong>Ctrl+V</strong> gambar saat mengetik soal atau gunakan tombol <strong>Paste Gambar</strong>.</span>
                                </div>

                                <div id="imgPreview_${qIndex}">
                                    ${q.imageUrl ? `
                                        <div class="mt-2.5 p-2 flex items-center gap-3" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                            <img src="${formatDirectImageUrl(q.imageUrl)}" 
                                                 referrerpolicy="no-referrer"
                                                 onerror="handleImgError(this)" 
                                                 style="max-height: 85px; max-width: 140px; object-fit: contain; border-radius: 4px; background: #fafafa; border: 1px solid var(--border-color);">
                                             <div class="flex-1" style="min-width: 0;">
                                                <div class="text-xs font-bold text-primary flex items-center gap-1">
                                                    <i class="ph ph-image"></i> Gambar Terpasang
                                                </div>
                                                <div class="text-xs text-muted mt-0.5 truncate" style="max-width: 250px;" title="${escapeHtml(q.imageUrl)}">
                                                    ${escapeHtml(q.imageUrl)}
                                                </div>
                                                <button type="button" class="btn btn-secondary btn-sm text-error mt-1.5" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="removeQuestionImage(${qIndex})">
                                                    <i class="ph ph-trash"></i> Hapus Gambar
                                                </button>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>

                                <div class="mt-3">
                                    <label class="input-label text-xs flex items-center justify-between">
                                        <span>Teks Pertanyaan Lanjutan (Bagian Bawah Gambar)</span>
                                        <span class="text-muted font-normal" style="font-size: 0.72rem;">Opsional - Jika gambar berada di antara teks</span>
                                    </label>
                                    <textarea class="input-control" rows="2" 
                                              placeholder="Tuliskan pertanyaan / teks lanjutan di bawah gambar (opsional)..." 
                                              oninput="updateQuestionField(${qIndex}, 'bottomText', this.value)">${escapeHtml(q.bottomText || '')}</textarea>
                                </div>
                            </div>
                            <div style="min-width: 140px;">
                                <div class="flex items-center justify-between">
                                    <label class="input-label text-xs">Skor / Poin</label>
                                    ${isScoreExceeded ? `<span class="badge text-2xs" style="background:#fee2e2; color:#b91c1c; border:1px solid #f87171; padding:1px 5px;"><i class="ph ph-warning"></i> Kurang</span>` : ''}
                                </div>
                                <input type="number" id="q-score-input-${qIndex}" class="input-control mb-1" 
                                       style="${isScoreExceeded ? 'border-color: #ef4444; background-color: #fef2f2; color: #b91c1c; font-weight: bold;' : ''}"
                                       value="${q.score}" 
                                       oninput="updateQuestionField(${qIndex}, 'score', Number(this.value || 0))">
                                <div id="q-score-badge-${qIndex}" style="display: ${isScoreExceeded ? 'inline-flex' : 'none'}; color: #dc2626; font-size: 0.68rem; font-weight: 600; margin-bottom: 0.5rem;" class="items-center gap-1">
                                    <i class="ph ph-warning-circle"></i> Opsi total: ${totalCustomPoints} poin
                                </div>
                                
                                <label class="input-label text-xs mt-1 flex items-center justify-between" style="gap: 4px;">
                                    <span><i class="ph ph-timer"></i> Waktu (Detik)</span>
                                    ${exam && exam.enableQuestionTimer ? '<span class="badge badge-timer-warning" style="font-size:0.65rem; padding: 1px 5px; line-height: 1.2;">Per Soal</span>' : '<span class="text-2xs text-muted" style="font-size:0.68rem;">Detik</span>'}
                                </label>
                                <input type="number" class="input-control mb-2" min="1" 
                                       placeholder="${exam && exam.enableQuestionTimer ? `Default (${exam.defaultQuestionDuration || 60}s)` : 'Ikut Ujian'}" 
                                       value="${(q.durationSeconds !== undefined && q.durationSeconds !== null && q.durationSeconds !== '') ? q.durationSeconds : ''}" 
                                       oninput="updateQuestionField(${qIndex}, 'durationSeconds', this.value ? Number(this.value) : null)"
                                       title="Durasi pengerjaan spesifik soal ini dalam detik. Kosongkan untuk menggunakan durasi default ujian.">

                                ${(q.type === 'MCQ_COMPLEX' || q.type === 'TRUE_FALSE') ? `
                                    <label class="input-label text-xs mt-2">Metode Penilaian</label>
                                    <select class="input-control text-sm" onchange="updateQuestionField(${qIndex}, 'scoringMethod', this.value); renderQuestionsList();">
                                        <option value="EXACT" ${q.scoringMethod === 'EXACT' ? 'selected' : ''}>Exact (Semua Tepat)</option>
                                        <option value="PARTIAL" ${q.scoringMethod === 'PARTIAL' ? 'selected' : ''}>Partial (Proporsional / Bobot Kustom)</option>
                                    </select>
                                ` : ''}
                            </div>
                        </div>

                        <div id="q-score-warning-${qIndex}">
                            ${isScoreExceeded ? `
                                <div class="p-3 mb-3 flex items-center justify-between text-xs" style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: var(--radius-sm); color: #991b1b; gap: 0.75rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
                                    <div class="flex items-center gap-2.5">
                                        <span style="background: #fee2e2; color: #dc2626; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                                            <i class="ph ph-warning"></i>
                                        </span>
                                        <div>
                                            <div class="font-bold" style="font-size: 0.82rem; color: #991b1b;">
                                                Peringatan: Total Poin ${q.type === 'TRUE_FALSE' ? 'Pernyataan' : 'Opsi Kunci'} (${totalCustomPoints}) Melebihi Skor Soal (${qScoreNum})!
                                            </div>
                                            <div class="mt-0.5" style="color: #b91c1c; font-size: 0.75rem;">
                                                Harap ubah <strong>Skor / Poin Soal</strong> minimal menjadi <strong>${totalCustomPoints}</strong> agar penilaian parsial siswa akurat dan tidak terpotong.
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" class="btn btn-sm flex items-center gap-1" onclick="syncQuestionScoreWithCustomPoints(${qIndex})" style="background: #dc2626; color: white; border: none; font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 600; flex-shrink: 0; border-radius: var(--radius-sm); cursor: pointer;">
                                        <i class="ph ph-arrow-up-right"></i> Ubah Skor Soal Jadi ${totalCustomPoints}
                                    </button>
                                </div>
                            ` : ''}
                        </div>

                        <div class="mb-2">
                            <label class="input-label text-xs mb-2 block">${q.type === 'TRUE_FALSE' ? 'Daftar Pernyataan & Kunci Jawaban' : 'Pilihan Jawaban & Kunci (Pilih/Centang jawaban yang benar)'}</label>
                            ${optionsHtml}
                            ${(q.type === 'MCQ' || q.type === 'MCQ_COMPLEX') ? `
                                <button class="btn btn-secondary btn-sm mt-2" onclick="addOption(${qIndex})">
                                    <i class="ph ph-plus"></i> Tambah Opsi
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        let timerBannerHtml = '';
        if (exam && exam.enableQuestionTimer) {
            timerBannerHtml = `
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
                    <div class="flex items-center gap-2.5">
                        <span style="background: #2563eb; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                            <i class="ph ph-timer"></i>
                        </span>
                        <div>
                            <div class="font-bold text-sm" style="color: #1e40af;">
                                Mode Waktu Pengerjaan Per Soal Aktif
                            </div>
                            <div class="text-xs" style="color: #2563eb; margin-top: 2px;">
                                Durasi default ujian: <strong>${exam.defaultQuestionDuration || 60} detik</strong> per soal. Anda dapat menentukan waktu khusus untuk tiap soal pada kolom <em>"Waktu (Detik)"</em>.
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="Router.navigate('/exam-editor?id=${exam.examId}')" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; background: #ffffff;">
                        <i class="ph ph-gear"></i> Pengaturan Ujian
                    </button>
                </div>
            `;
        }

        // Always append the Bottom Add Card directly below the questions!
        const bottomAddCardHtml = `
            <div class="qb-bottom-add-card">
                <div class="font-bold text-sm text-secondary flex items-center justify-center gap-2">
                    <i class="ph ph-plus-circle text-primary" style="font-size: 1.25rem;"></i> Tambah Soal Baru
                </div>
                <div class="btn-grid">
                    <button class="btn btn-secondary" onclick="addQuestion('MCQ')">
                        <i class="ph ph-list-bullets text-primary"></i> + Pilihan Ganda
                    </button>
                    <button class="btn btn-secondary" onclick="addQuestion('MCQ_COMPLEX')">
                        <i class="ph ph-check-square text-primary"></i> + Ganda Kompleks
                    </button>
                    <button class="btn btn-secondary" onclick="addQuestion('TRUE_FALSE')">
                        <i class="ph ph-toggle-left text-primary"></i> + Benar / Salah
                    </button>
                    <button class="btn btn-outline-primary" onclick="openImportModal()">
                        <i class="ph ph-microsoft-excel-logo text-success"></i> Import Excel
                    </button>
                    <button class="btn btn-outline-success" onclick="downloadCurrentQuestionsExcel()">
                        <i class="ph ph-file-arrow-down text-success"></i> Download Soal (Excel)
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = timerBannerHtml + cardsHtml + bottomAddCardHtml;
    };

    // ========================================================================
    // EXCEL IMPORT & TEMPLATE DOWNLOAD
    // ========================================================================
    window.downloadTemplateExcel = function() {
        if (typeof XLSX === 'undefined') {
            UI.showToast('Library Excel sedang dimuat, coba sesaat lagi.', 'warning');
            return;
        }
        try {
            const headers = [
                "Nomor Urut", "Tipe Soal", "Teks Soal", "URL Gambar Soal",
                "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", 
                "Kunci Jawaban", "Bobot Poin", "Pembahasan"
            ];
            const sampleData = [
                headers,
                [1, "MCQ", "Ibu kota negara Indonesia saat ini adalah...", "", "Jakarta", "Bandung", "Surabaya", "Nusantara", "Medan", "A", 10, "Ibu kota Indonesia saat ini adalah DKI Jakarta."],
                [2, "BENAR_SALAH", "Seorang murid memperkirakan banyaknya penonton suatu video di media sosial. Tentukan Benar atau Salah untuk setiap pernyataan berikut!", "", "Video tersebut hanya ditonton oleh 3.000 penonton setelah tepat 24 jam diunggah.", "Banyaknya penonton video meningkat dua kali lipat dari hari sebelumnya untuk beberapa hari setelah diunggah.", "Model banyaknya penonton ini tidak tepat untuk waktu yang cukup besar.", "", "", "B,B,S", 10, "Pernyataan 1 Benar, Pernyataan 2 Benar, Pernyataan 3 Salah."],
                [3, "SESUAI_TIDAK_SESUAI", "Bacalah ringkasan materi berikut. Tentukan apakah pernyataan berikut Sesuai atau Tidak Sesuai dengan isi bacaan!", "", "Informasi pada alinea pertama memuat data statistik tahun 2024.", "Penulis menyimpulkan bahwa teknologi AI berdampak negatif bagi seluruh sektor.", "Pemerintah telah menyiapkan regulasi keamanan digital terbaru.", "", "", "S,TS,S", 10, "Pernyataan 1 Sesuai, Pernyataan 2 Tidak Sesuai, Pernyataan 3 Sesuai."],
                [4, "TEPAT_TIDAK_TEPAT", "Perhatikan langkah-langkah metode ilmiah berikut. Tentukan Tepat atau Tidak Tepat untuk setiap tahapan!", "", "Hipotesis dirumuskan sebelum melakukan pengamatan awal.", "Eksperimen dilakukan untuk menguji kebenaran hipotesis.", "Kesimpulan ditarik berdasarkan data hasil percobaan.", "", "", "TT,T,T", 10, "Pernyataan 1 Tidak Tepat, Pernyataan 2 Tepat, Pernyataan 3 Tepat."],
                [5, "MCQ_COMPLEX", "Manakah dari teknologi berikut yang merupakan bahasa web frontend? (Pilih semua yang benar)", "", "HTML", "CSS", "JavaScript", "Python", "C++", "A,B,C", 15, "HTML, CSS, dan JavaScript adalah pilar teknologi web browser frontend."]
            ];
            const ws = XLSX.utils.aoa_to_sheet(sampleData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Question_Import_Template");
            XLSX.writeFile(wb, "Template_Import_Soal_Ujian.xlsx");
            UI.showToast('Template Excel berhasil diunduh!', 'success');
        } catch (err) {
            console.error("Download template error:", err);
            UI.showToast('Gagal membuat file template Excel.', 'error');
        }
    };

    window.downloadCurrentQuestionsExcel = function() {
        const examTitle = (AppState.currentExam && AppState.currentExam.title) || 'Ujian';
        downloadQuestionsAsExcel(questions, examTitle);
    };

    let pendingImportQuestions = [];
    window.openImportModal = function() {
        pendingImportQuestions = [];
        UI.showModal(`
            <div class="import-modal-content">
                <div class="flex justify-between items-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
                    <div class="flex items-center gap-2">
                        <i class="ph ph-microsoft-excel-logo text-success" style="font-size: 1.5rem;"></i>
                        <h3 style="margin: 0; font-size: 1.2rem;">Import Soal dari Excel</h3>
                    </div>
                    <button class="btn btn-icon btn-secondary btn-sm" onclick="closeModal()" title="Tutup">
                        <i class="ph ph-x"></i>
                    </button>
                </div>

                <p class="text-xs text-muted mb-3">
                    Upload file Excel (<code>.xlsx</code> / <code>.xls</code> / <code>.csv</code>) sesuai template database untuk memasukkan banyak soal sekaligus.
                </p>

                <div class="flex items-center justify-between p-3 mb-3" style="background: var(--bg-base); border-radius: var(--radius-md); border: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div class="font-semibold text-xs text-primary">Belum punya format Excel?</div>
                        <div class="text-xs text-muted">Unduh template standar lengkap dengan contoh PG, Benar/Salah, Sesuai/Tidak, Tepat/Tidak, & PG Kompleks</div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm" onclick="downloadTemplateExcel()">
                        <i class="ph ph-download-simple"></i> Unduh Template Excel
                    </button>
                </div>

                <div class="p-2.5 mb-3" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); font-size: 0.78rem; color: #166534;">
                    <strong><i class="ph ph-info"></i> Format Tipe Soal & Kunci Jawaban Excel:</strong>
                    <ul style="margin: 0.25rem 0 0 1.2rem; padding: 0; line-height: 1.45;">
                        <li><code>MCQ</code>: Pilihan Ganda (Kunci: A, B, C, D, atau E)</li>
                        <li><code>BENAR_SALAH</code> / <code>TRUE_FALSE</code>: Benar / Salah (Kunci: B,S,B atau Benar,Salah,Benar)</li>
                        <li><code>SESUAI_TIDAK_SESUAI</code> / <code>SESUAI</code>: Sesuai / Tidak Sesuai (Kunci: S,TS,S atau Sesuai,Tidak Sesuai,Sesuai)</li>
                        <li><code>TEPAT_TIDAK_TEPAT</code> / <code>TEPAT</code>: Tepat / Tidak Tepat (Kunci: T,TT,T atau Tepat,Tidak Tepat,Tepat)</li>
                        <li><code>MCQ_COMPLEX</code>: Pilihan Ganda Kompleks (Kunci: A,B,C)</li>
                    </ul>
                </div>

                <div class="upload-dropzone" onclick="document.getElementById('excelFileInput').click()">
                    <i class="ph ph-file-arrow-up text-primary" style="font-size: 2.5rem;"></i>
                    <div class="font-bold text-sm mt-2">Pilih File Excel Anda</div>
                    <div class="text-xs text-muted mt-1">Klik di sini untuk mencari file (.xlsx, .xls, .csv)</div>
                    <input type="file" id="excelFileInput" accept=".xlsx, .xls, .csv" style="display: none;" onchange="handleExcelFile(event)">
                </div>

                <div id="importPreviewArea"></div>
            </div>
        `);
    };

    window.handleExcelFile = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            UI.showToast('Library Excel belum siap. Silakan refresh halaman.', 'error');
            return;
        }

        const previewEl = document.getElementById('importPreviewArea');
        if (previewEl) {
            previewEl.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner mb-2"></div>
                    <p class="text-xs mt-2">Menganalisis baris soal dalam file Excel...</p>
                </div>
            `;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const wb = XLSX.read(data, {type: 'array'});
                const firstSheetName = wb.SheetNames[0];
                const ws = wb.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(ws, {header: 1});

                if (!rows || rows.length <= 1) {
                    if (previewEl) {
                        previewEl.innerHTML = `<div class="card p-3 text-error text-center text-xs">File Excel kosong atau tidak memiliki baris data.</div>`;
                    }
                    return;
                }

                // Detect header row
                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(rows.length, 5); i++) {
                    const rStr = (rows[i] || []).join(' ').toLowerCase();
                    if (rStr.includes('tipe') || rStr.includes('soal') || rStr.includes('kunci') || rStr.includes('pertanyaan')) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex === -1) headerRowIndex = 0;

                const headerRow = (rows[headerRowIndex] || []).map(c => String(c || '').trim().toLowerCase());
                
                // Robust column finder: exact match first, then substring match with strict exclusions
                const getCol = (exactList, substringList, excludeList = []) => {
                    // 1. Check exact matches first
                    for (let i = 0; i < headerRow.length; i++) {
                        const h = headerRow[i];
                        if (excludeList.some(ex => h.includes(ex))) continue;
                        if (exactList.includes(h)) return i;
                    }
                    // 2. Check substring matches with exclusions
                    for (let i = 0; i < headerRow.length; i++) {
                        const h = headerRow[i];
                        if (excludeList.some(ex => h.includes(ex))) continue;
                        if (substringList.some(sub => h.includes(sub))) return i;
                    }
                    return -1;
                };

                const colType = getCol(
                    ['tipe soal', 'tipe', 'type', 'jenis soal', 'jenis'], 
                    ['tipe', 'type', 'jenis']
                );
                let colText = getCol(
                    ['teks pertanyaan', 'teks soal', 'pertanyaan', 'soal', 'isi soal', 'pertanyaan soal', 'question'], 
                    ['pertanyaan', 'teks', 'question'], 
                    ['tipe', 'type', 'gambar', 'image', 'foto', 'bobot', 'nilai', 'skor', 'nomor', 'no', 'kunci']
                );
                const colImg = getCol(
                    ['url gambar soal', 'url gambar', 'gambar soal', 'gambar', 'image', 'foto', 'link gambar', 'url foto'], 
                    ['gambar', 'image', 'foto']
                );
                const colBottom = getCol(
                    ['teks bawah gambar', 'teks lanjutan', 'teks soal bawah', 'teks bawah', 'bottom text'],
                    ['bawah gambar', 'teks lanjutan']
                );
                const colKey = getCol(
                    ['kunci jawaban', 'kunci', 'jawaban benar', 'kunci soal', 'key', 'answer'], 
                    ['kunci', 'key']
                );
                const colScore = getCol(
                    ['bobot nilai', 'bobot poin', 'bobot', 'poin', 'nilai', 'skor', 'score', 'points'], 
                    ['bobot', 'poin', 'skor'], 
                    ['metode', 'kunci']
                );
                const colOptA = getCol(
                    ['opsi a', 'pilihan a', 'opt a', 'a', 'jawaban a'], 
                    ['opsi a', 'pilihan a', 'opt a']
                );
                const colOptB = getCol(
                    ['opsi b', 'pilihan b', 'opt b', 'b', 'jawaban b'], 
                    ['opsi b', 'pilihan b', 'opt b']
                );
                const colOptC = getCol(
                    ['opsi c', 'pilihan c', 'opt c', 'c', 'jawaban c'], 
                    ['opsi c', 'pilihan c', 'opt c']
                );
                const colOptD = getCol(
                    ['opsi d', 'pilihan d', 'opt d', 'd', 'jawaban d'], 
                    ['opsi d', 'pilihan d', 'opt d']
                );
                const colOptE = getCol(
                    ['opsi e', 'pilihan e', 'opt e', 'e', 'jawaban e'], 
                    ['opsi e', 'pilihan e', 'opt e']
                );
                const colExp = getCol(
                    ['pembahasan', 'penjelasan', 'keterangan', 'explanation'], 
                    ['pembahasan', 'penjelasan', 'keterangan']
                );
                const colDuration = getCol(
                    ['durasi soal', 'durasi (detik)', 'durasi detik', 'waktu soal', 'waktu (detik)', 'durasi', 'duration'], 
                    ['durasi', 'waktu']
                );
                const colMethod = getCol(
                    ['metode penilaian', 'metode', 'scoring method', 'scoringmethod'],
                    ['metode', 'scoring']
                );
                const colOptionScores = getCol(
                    ['poin per opsi', 'bobot opsi', 'poin opsi', 'skor opsi', 'option points', 'option scores'],
                    ['poin per opsi', 'bobot opsi', 'poin opsi']
                );

                // Safety guard: colText and colType must NEVER be the same column
                if (colText === colType || colText === -1) {
                    colText = (colType === 1) ? 2 : 1;
                }

                const hasExplicitImgCol = colImg !== -1;
                const dataRows = rows.slice(headerRowIndex + 1);
                const parsed = [];

                dataRows.forEach((row, idx) => {
                    if (!row || row.length === 0) return;

                    const getVal = (colIdx, fallbackIdx) => {
                        const target = (colIdx !== -1) ? colIdx : fallbackIdx;
                        return (target !== -1 && target < row.length && row[target] !== undefined && row[target] !== null) 
                            ? String(row[target]).trim() 
                            : '';
                    };

                    const questionText = getVal(colText, 2);
                    if (!questionText) return;

                    const typeRaw = getVal(colType, 1).toUpperCase();
                    let type = 'MCQ';
                    let tfType = 'BENAR_SALAH';
                    if (typeRaw.includes('SESUAI')) {
                        type = 'TRUE_FALSE';
                        tfType = 'SESUAI_TIDAK';
                    } else if (typeRaw.includes('TEPAT')) {
                        type = 'TRUE_FALSE';
                        tfType = 'TEPAT_TIDAK';
                    } else if (typeRaw.includes('TRUE') || typeRaw.includes('SALAH') || typeRaw.includes('BENAR')) {
                        type = 'TRUE_FALSE';
                        tfType = 'BENAR_SALAH';
                    } else if (typeRaw.includes('KOMPLEKS') || typeRaw.includes('COMPLEX')) {
                        type = 'MCQ_COMPLEX';
                    }

                    // Auto-detect format from question text if TRUE_FALSE without explicit keyword in type
                    if (type === 'TRUE_FALSE' && tfType === 'BENAR_SALAH') {
                        const qLower = questionText.toLowerCase();
                        if (qLower.includes('tidak sesuai') || qLower.includes('sesuai atau tidak') || qLower.includes('sesuai/tidak')) {
                            tfType = 'SESUAI_TIDAK';
                        } else if (qLower.includes('tidak tepat') || qLower.includes('tepat atau tidak') || qLower.includes('tepat/tidak')) {
                            tfType = 'TEPAT_TIDAK';
                        }
                    }

                    // Handle options offset based on whether image column was present
                    const rawImg = hasExplicitImgCol ? getVal(colImg, -1) : '';
                    const bottomText = (colBottom !== -1) ? getVal(colBottom, -1) : '';
                    const optA = getVal(colOptA, hasExplicitImgCol ? 4 : 3);
                    const optB = getVal(colOptB, hasExplicitImgCol ? 5 : 4);
                    const optC = getVal(colOptC, hasExplicitImgCol ? 6 : 5);
                    const optD = getVal(colOptD, hasExplicitImgCol ? 7 : 6);
                    const optE = getVal(colOptE, hasExplicitImgCol ? 8 : 7);
                    const rawKey = getVal(colKey, hasExplicitImgCol ? 9 : 8) || 'A';
                    const score = Number(getVal(colScore, hasExplicitImgCol ? 10 : 9)) || 10;
                    const explanation = getVal(colExp, hasExplicitImgCol ? 11 : 10);
                    const rawDuration = colDuration !== -1 ? Number(getVal(colDuration, -1)) : null;
                    const durationSeconds = (rawDuration && !isNaN(rawDuration) && rawDuration > 0) ? rawDuration : null;
                    const rawMethod = colMethod !== -1 ? getVal(colMethod, -1).toUpperCase() : '';
                    const isPartialMethod = rawMethod.includes('PARTIAL') || rawMethod.includes('PROPORSIONAL');
                    const rawOptionScores = colOptionScores !== -1 ? getVal(colOptionScores, -1) : '';
                    const parsedScoresArr = rawOptionScores ? rawOptionScores.split(/[,; ]+/).filter(Boolean).map(s => {
                        const n = Number(s.trim());
                        return isNaN(n) ? null : n;
                    }) : [];

                    let options = [];
                    let correctAnswer = null;

                    if (type === 'TRUE_FALSE') {
                        const rawOptions = [optA, optB, optC, optD, optE].filter(o => o && String(o).trim());
                        let statements = [];

                        // Check if legacy Excel where optA='Benar' & optB='Salah'
                        if (rawOptions.length === 2 && 
                            (rawOptions[0].trim().toLowerCase() === 'benar' || rawOptions[0].trim().toLowerCase() === 'sesuai' || rawOptions[0].trim().toLowerCase() === 'tepat') && 
                            (rawOptions[1].trim().toLowerCase() === 'salah' || rawOptions[1].trim().toLowerCase() === 'tidak sesuai' || rawOptions[1].trim().toLowerCase() === 'tidak tepat')) {
                            statements.push({ id: '1', text: questionText, score: parsedScoresArr[0] !== undefined ? parsedScoresArr[0] : null });
                        } else if (rawOptions.length > 0) {
                            rawOptions.slice(0, 5).forEach((st, sIdx) => {
                                statements.push({ 
                                    id: String(sIdx + 1), 
                                    text: String(st).trim(),
                                    score: parsedScoresArr[sIdx] !== undefined ? parsedScoresArr[sIdx] : null
                                });
                            });
                        } else {
                            statements.push({ id: '1', text: 'Pernyataan 1', score: parsedScoresArr[0] !== undefined ? parsedScoresArr[0] : null });
                        }
                        options = statements;

                        // Parse keys e.g. "B,B,S" or "S,S,TS" or "T,T,TT" or full words
                        const keyTokens = String(rawKey || '').split(/[,; ]+/).filter(Boolean);
                        const keyMap = {};
                        const isSesuaiMode = tfType === 'SESUAI_TIDAK';
                        const isTepatMode = tfType === 'TEPAT_TIDAK';

                        statements.forEach((st, sIdx) => {
                            const tok = (keyTokens[sIdx] || keyTokens[0] || '').trim().toUpperCase();
                            let isTrue = true;
                            if (isSesuaiMode) {
                                // Sesuai (TRUE), Tidak Sesuai (FALSE)
                                if (tok === 'TS' || tok.includes('TIDAK') || tok === 'FALSE' || tok === 'SALAH' || tok === '0') {
                                    isTrue = false;
                                } else {
                                    isTrue = true;
                                }
                            } else if (isTepatMode) {
                                // Tepat (TRUE), Tidak Tepat (FALSE)
                                if (tok === 'TT' || tok.includes('TIDAK') || tok === 'FALSE' || tok === 'SALAH' || tok === '0') {
                                    isTrue = false;
                                } else {
                                    isTrue = true;
                                }
                            } else {
                                // Benar (TRUE), Salah (FALSE)
                                if (tok === 'S' || tok === 'SALAH' || tok === 'FALSE' || tok === '0') {
                                    isTrue = false;
                                } else {
                                    isTrue = true;
                                }
                            }
                            keyMap[st.id] = isTrue ? 'TRUE' : 'FALSE';
                        });
                        correctAnswer = keyMap;
                    } else if (type === 'MCQ_COMPLEX') {
                        if (optA) options.push({ id: 'A', text: optA, imageUrl: '', score: parsedScoresArr[0] !== undefined ? parsedScoresArr[0] : null });
                        if (optB) options.push({ id: 'B', text: optB, imageUrl: '', score: parsedScoresArr[1] !== undefined ? parsedScoresArr[1] : null });
                        if (optC) options.push({ id: 'C', text: optC, imageUrl: '', score: parsedScoresArr[2] !== undefined ? parsedScoresArr[2] : null });
                        if (optD) options.push({ id: 'D', text: optD, imageUrl: '', score: parsedScoresArr[3] !== undefined ? parsedScoresArr[3] : null });
                        if (optE) options.push({ id: 'E', text: optE, imageUrl: '', score: parsedScoresArr[4] !== undefined ? parsedScoresArr[4] : null });
                        correctAnswer = rawKey.toUpperCase().split(/[,; ]+/).filter(Boolean);
                    } else {
                        if (optA) options.push({ id: 'A', text: optA, imageUrl: '' });
                        if (optB) options.push({ id: 'B', text: optB, imageUrl: '' });
                        if (optC) options.push({ id: 'C', text: optC, imageUrl: '' });
                        if (optD) options.push({ id: 'D', text: optD, imageUrl: '' });
                        if (optE) options.push({ id: 'E', text: optE, imageUrl: '' });
                        correctAnswer = rawKey.toUpperCase().charAt(0) || 'A';
                    }

                    const finalScoringMethod = (type === 'MCQ_COMPLEX' || type === 'TRUE_FALSE')
                        ? (isPartialMethod || parsedScoresArr.length > 0 ? 'PARTIAL' : 'EXACT')
                        : 'EXACT';

                    let finalScore = score;
                    if (finalScoringMethod === 'PARTIAL') {
                        let sumWeights = 0;
                        if (type === 'TRUE_FALSE') {
                            options.forEach(o => { if (o.score) sumWeights += Number(o.score); });
                        } else if (type === 'MCQ_COMPLEX') {
                            const cArr = Array.isArray(correctAnswer) ? correctAnswer : [];
                            options.forEach(o => { if (cArr.includes(o.id) && o.score) sumWeights += Number(o.score); });
                        }
                        if (sumWeights > finalScore) {
                            finalScore = Math.round(sumWeights * 100) / 100;
                        }
                    }

                    parsed.push({
                        id: 'Q_' + Math.floor(Math.random() * 90000 + 10000),
                        type: type,
                        tfType: tfType,
                        text: questionText,
                        bottomText: bottomText,
                        imageUrl: formatDirectImageUrl(rawImg),
                        score: finalScore,
                        durationSeconds: durationSeconds,
                        options: options,
                        correctAnswer: correctAnswer,
                        scoringMethod: finalScoringMethod,
                        explanation: explanation
                    });
                });

                if (parsed.length === 0) {
                    if (previewEl) {
                        previewEl.innerHTML = `<div class="card p-3 text-error text-center text-xs">Tidak ditemukan baris soal yang valid dalam file Excel.</div>`;
                    }
                    return;
                }

                pendingImportQuestions = parsed;
                if (previewEl) {
                    previewEl.innerHTML = `
                        <div class="card p-3 mb-3" style="background: var(--primary-50); border-color: var(--primary-200);">
                            <div class="flex items-center gap-2 text-primary font-bold">
                                <i class="ph ph-check-circle" style="font-size: 1.25rem;"></i> Ditemukan ${parsed.length} Soal Valid
                            </div>
                            <p class="text-xs text-secondary mt-1">Total Poin: <strong>${parsed.reduce((a,c) => a + c.score, 0)}</strong> poin • Format terverifikasi.</p>
                        </div>
                        <div style="max-height: 160px; overflow-y: auto; font-size: 0.82rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.5rem; background: #ffffff;">
                            ${parsed.map((pq, pi) => `
                                <div class="py-1.5 px-2 flex justify-between items-center" style="border-bottom: 1px solid var(--border-color); gap: 0.5rem;">
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
                                        <strong>#${pi+1}</strong> [${pq.type === 'TRUE_FALSE' ? getTfLabels(pq.tfType).name : pq.type}] ${escapeHtml(pq.text)}
                                    </span>
                                    <span class="badge badge-active text-xs" style="flex-shrink: 0;">${pq.score} Poin</span>
                                </div>
                            `).join('')}
                        </div>
                        <div style="padding: 1rem 0 3rem 0;">
                            <button id="confirmImportBtn" class="btn btn-primary w-full justify-center" onclick="confirmImportQuestions()" style="padding: 0.8rem 1rem; font-size: 0.95rem; font-weight: 600;">
                                <i class="ph ph-plus"></i> Tambahkan ${parsed.length} Soal ke Ujian
                            </button>
                        </div>
                    `;

                    setTimeout(() => {
                        const btn = document.getElementById('confirmImportBtn');
                        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 120);
                }
            } catch (err) {
                console.error("Excel parse error:", err);
                if (previewEl) {
                    previewEl.innerHTML = `<div class="card p-3 text-error text-center text-xs">Gagal membaca file Excel: ${err.message}</div>`;
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    window.confirmImportQuestions = function() {
        if (!pendingImportQuestions || pendingImportQuestions.length === 0) return;
        questions.push(...pendingImportQuestions);
        renderQuestionsList();
        UI.closeModal();
        UI.showToast(`Berhasil menambahkan ${pendingImportQuestions.length} soal dari Excel!`, 'success');
        pendingImportQuestions = [];

        // Scroll to the first newly added question
        setTimeout(() => {
            const cards = document.querySelectorAll('#questionsListContainer .question-card-item');
            if (cards.length > 0) {
                cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    };

    window.saveAllQuestions = async function() {
        // Validation: Check if any question with partial scoring has option points > question score
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (q.scoringMethod === 'PARTIAL') {
                const totalPoints = getQuestionCustomPointsTotal(q);
                const qScore = Number(q.score || 0);
                if (totalPoints > 0 && totalPoints > qScore) {
                    UI.showToast(`Peringatan: Pada Soal #${i + 1}, total poin opsi/pernyataan (${totalPoints}) melebihi Skor Soal (${qScore}). Harap ubah Skor Soal terlebih dahulu!`, 'warning');
                    
                    const cardList = document.querySelectorAll('#questionsListContainer .question-card-item');
                    if (cardList && cardList[i]) {
                        cardList[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    const scoreInput = document.getElementById(`q-score-input-${i}`);
                    if (scoreInput) {
                        scoreInput.focus();
                    }
                    checkQuestionScoreWarning(i);
                    return;
                }
            }
        }

        const btn = document.getElementById('saveQuestionsBtn');
        const mBtn = document.getElementById('mSaveQuestionsBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';
        }
        if (mBtn) {
            mBtn.disabled = true;
            mBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        }

        try {
            const res = await api.saveQuestions(AppState.user.sessionId, examId, questions);
            if (res.success) {
                UI.showToast('Semua soal berhasil disimpan ke database!', 'success');
            } else {
                UI.showToast(res.message || 'Gagal menyimpan soal.', 'error');
            }
        } catch (e) {
            UI.showToast('Terjadi kesalahan saat menyimpan.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan Soal';
            }
            if (mBtn) {
                mBtn.disabled = false;
                mBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan';
            }
        }
    };

    document.addEventListener('viewRendered', function onRender(e) {
        if (e.detail.path === '/question-builder') {
            renderQuestionsList();
            document.removeEventListener('viewRendered', onRender);
        }
    });

    return `
        <div class="view">
            <nav class="navbar glass">
                <div class="container flex justify-between items-center" style="gap: 0.5rem; flex-wrap: wrap;">
                    <div class="flex items-center gap-3">
                        <button class="btn btn-icon btn-secondary" onclick="Router.navigate('/dashboard')" title="Kembali ke Dashboard">
                            <i class="ph ph-arrow-left"></i>
                        </button>
                        <h3 style="margin:0; font-size: 1.15rem; white-space: nowrap;">Kelola Soal</h3>
                    </div>
                    <div class="flex items-center gap-2" style="flex-wrap: wrap;">
                        <div class="teacher-profile-chip" title="${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}">
                            <i class="ph ph-user-circle"></i>
                            <span>${escapeHtml(AppState.user ? (AppState.user.teacherName || AppState.user.username || 'Guru') : 'Guru')}</span>
                        </div>
                        <button class="btn btn-outline-success btn-sm flex items-center gap-1.5" onclick="downloadCurrentQuestionsExcel()" title="Download seluruh soal ujian ini ke file Excel (.xlsx)">
                            <i class="ph ph-file-arrow-down text-success"></i> <span class="hidden sm-inline">Download Soal</span> Excel
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="openImportModal()">
                            <i class="ph ph-microsoft-excel-logo text-success"></i> <span class="hidden sm-inline">Import</span> Excel
                        </button>
                        <button id="saveQuestionsBtn" class="btn btn-primary btn-sm" onclick="saveAllQuestions()">
                            <i class="ph ph-floppy-disk"></i> Simpan
                        </button>
                    </div>
                </div>
            </nav>

            <div class="container mt-6">
                <style>
                    .qb-layout { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }
                    @media (max-width: 768px) {
                        .qb-layout { grid-template-columns: 1fr; }
                        .sidebar-tools { display: none !important; }
                    }
                </style>
                <div class="qb-layout">
                    <div id="questionsListContainer">
                        <!-- Rendered by JS -->
                    </div>
                    
                    <div class="card sidebar-tools" style="position: sticky; top: 100px;">
                        <h4 class="mb-3 text-sm font-semibold">Tambah Soal</h4>
                        <div class="flex-col gap-2">
                            <button class="btn btn-secondary justify-center w-full" onclick="addQuestion('MCQ')">
                                <i class="ph ph-list-bullets text-primary"></i> Pilihan Ganda
                            </button>
                            <button class="btn btn-secondary justify-center w-full" onclick="addQuestion('MCQ_COMPLEX')">
                                <i class="ph ph-check-square text-primary"></i> Ganda Kompleks
                            </button>
                            <button class="btn btn-secondary justify-center w-full" onclick="addQuestion('TRUE_FALSE')">
                                <i class="ph ph-toggle-left text-primary"></i> Benar / Salah
                            </button>
                            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.5rem 0;">
                            <button class="btn btn-outline-primary justify-center w-full" onclick="openImportModal()">
                                <i class="ph ph-microsoft-excel-logo text-success"></i> Import Excel
                            </button>
                            <button class="btn btn-outline-success justify-center w-full" onclick="downloadCurrentQuestionsExcel()">
                                <i class="ph ph-file-arrow-down text-success"></i> Download Soal (Excel)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile Sticky Floating Action Bar -->
            <div class="qb-mobile-floating-bar">
                <button class="btn btn-secondary" onclick="addQuestion('MCQ')">
                    <i class="ph ph-plus"></i> + Soal
                </button>
                <button class="btn btn-outline-success" onclick="downloadCurrentQuestionsExcel()" title="Download Soal">
                    <i class="ph ph-file-arrow-down"></i> Excel
                </button>
                <button class="btn btn-outline-primary" onclick="openImportModal()">
                    <i class="ph ph-microsoft-excel-logo text-success"></i> Import
                </button>
                <button id="mSaveQuestionsBtn" class="btn btn-primary" onclick="saveAllQuestions()">
                    <i class="ph ph-floppy-disk"></i> Simpan
                </button>
            </div>
        </div>
    `;
});
