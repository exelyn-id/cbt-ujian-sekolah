// Global State Management
const AppState = {
    mode: null, // 'teacher' | 'student'
    user: null, // { teacherId, teacherName, role }
    currentExam: null, // exam object
    questions: [], // array of questions for current exam
    attempt: null, // current attempt data
    answers: {}, // local autosave answers mapping
    timer: null, // interval reference
    
    // Subscriptions for reactivity (simple observer pattern)
    listeners: [],
    
    subscribe(listener) {
        this.listeners.push(listener);
    },
    
    notify() {
        this.listeners.forEach(listener => listener(this));
    },
    
    update(updates) {
        Object.assign(this, updates);
        this.notify();
    }
};

// Automatically restore persisted teacher/admin authentication on page reload
try {
    const savedUser = localStorage.getItem('cbt_auth_user');
    if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && (parsed.sessionId || parsed.role)) {
            AppState.user = parsed;
            AppState.mode = 'teacher';
        }
    }
} catch (e) {
    console.warn("Failed to restore auth from localStorage:", e);
}

// Global UI Utilities (Toasts, Modals)
const UI = {
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ph-info';
        if (type === 'success') icon = 'ph-check-circle';
        if (type === 'error') icon = 'ph-warning-circle';
        if (type === 'warning') icon = 'ph-warning';
        
        toast.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="ph ${icon} ph-xl"></i>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    showModal(htmlContent) {
        const container = document.getElementById('modal-container');
        const body = document.getElementById('modal-body');
        if (!container || !body) return;
        
        body.innerHTML = htmlContent;
        container.classList.remove('hidden');
    },
    
    closeModal() {
        const container = document.getElementById('modal-container');
        if (container) {
            container.classList.add('hidden');
        }
    }
};

// Global helper to safely escape HTML special characters
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Helper for True/False label variants (Benar/Salah, Sesuai/Tidak Sesuai, Tepat/Tidak Tepat)
function getTfLabels(tfType) {
    const type = String(tfType || '').toUpperCase();
    if (type.includes('SESUAI')) {
        return {
            id: 'SESUAI_TIDAK',
            name: 'Sesuai / Tidak Sesuai',
            positive: 'Sesuai',
            negative: 'Tidak Sesuai'
        };
    }
    if (type.includes('TEPAT')) {
        return {
            id: 'TEPAT_TIDAK',
            name: 'Tepat / Tidak Tepat',
            positive: 'Tepat',
            negative: 'Tidak Tepat'
        };
    }
    return {
        id: 'BENAR_SALAH',
        name: 'Benar / Salah',
        positive: 'Benar',
        negative: 'Salah'
    };
}
window.getTfLabels = getTfLabels;

// Global helper to convert Google Drive and general image links into direct loadable URLs
function formatDirectImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    
    // Base64 images are directly valid in <img src="...">
    if (url.startsWith('data:image/')) return url;

    // Check if Google Drive link (various sharing formats)
    let driveId = null;
    const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1 && m1[1]) {
        driveId = m1[1];
    } else {
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m2 && m2[1]) {
            driveId = m2[1];
        } else {
            const m3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m3 && m3[1]) {
                driveId = m3[1];
            }
        }
    }

    if (driveId) {
        // Direct Google CDN link that works in <img> without cookie restrictions
        return 'https://lh3.googleusercontent.com/d/' + driveId;
    }

    // Dropbox raw image conversion
    if (url.includes('dropbox.com') && url.includes('dl=0')) {
        return url.replace('dl=0', 'raw=1');
    }

    return url;
}
window.formatDirectImageUrl = formatDirectImageUrl;

// Fallback image error handler
window.handleImgError = function(imgEl) {
    if (!imgEl) return;
    const currentSrc = imgEl.src || '';
    if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
        imgEl.src = currentSrc.replace('https://lh3.googleusercontent.com/d/', 'https://drive.google.com/thumbnail?sz=w1000&id=');
    } else if (currentSrc.includes('drive.google.com/thumbnail')) {
        imgEl.src = currentSrc.replace('https://drive.google.com/thumbnail?sz=w1000&id=', 'https://drive.google.com/uc?export=view&id=');
    } else {
        imgEl.style.display = 'none';
    }
};

// Bind closeModal to global scope for onclick handlers
window.closeModal = UI.closeModal;

// ============================================================================
// EXCEL EXPORT UTILITIES (SOAL & HASIL UJIAN)
// ============================================================================

/**
 * Downloads a list of questions into a standardized Excel (.xlsx) file.
 */
function downloadQuestionsAsExcel(questionsList, examTitle) {
    if (!questionsList || !Array.isArray(questionsList) || questionsList.length === 0) {
        UI.showToast('Belum ada soal untuk didownload.', 'warning');
        return;
    }
    if (typeof XLSX === 'undefined') {
        UI.showToast('Library Excel sedang dimuat, coba sesaat lagi.', 'warning');
        return;
    }

    try {
        const headers = [
            "Nomor Urut", "Tipe Soal", "Teks Soal", "Teks Bawah Gambar", "URL Gambar Soal",
            "Opsi A / Pernyataan 1", "Opsi B / Pernyataan 2", "Opsi C / Pernyataan 3", "Opsi D / Pernyataan 4", "Opsi E / Pernyataan 5",
            "Kunci Jawaban", "Bobot Poin", "Pembahasan"
        ];

        const rows = [headers];

        questionsList.forEach((q, idx) => {
            const no = q.orderNo || (idx + 1);
            let tipeStr = q.type || 'MCQ';
            let keyStr = '';

            const opts = Array.isArray(q.options) ? q.options : [];
            const optTexts = ['', '', '', '', ''];

            if (q.type === 'TRUE_FALSE') {
                const tfType = q.tfType || 'BENAR_SALAH';
                if (tfType === 'SESUAI_TIDAK') tipeStr = 'SESUAI_TIDAK_SESUAI';
                else if (tfType === 'TEPAT_TIDAK') tipeStr = 'TEPAT_TIDAK_TEPAT';
                else tipeStr = 'BENAR_SALAH';

                opts.forEach((opt, oIdx) => {
                    if (oIdx < 5) optTexts[oIdx] = opt.statement || opt.text || '';
                });

                const keysArr = [];
                opts.forEach((opt, oIdx) => {
                    let ansVal = '';
                    if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
                        ansVal = q.correctAnswer[opt.id] || q.correctAnswer[String(oIdx + 1)] || q.correctAnswer[oIdx] || '';
                    } else {
                        ansVal = q.correctAnswer;
                    }
                    const isPos = (ansVal === 'TRUE' || ansVal === true || String(ansVal).toUpperCase() === 'B' || (String(ansVal).toUpperCase() === 'S' && tfType === 'SESUAI_TIDAK') || (String(ansVal).toUpperCase() === 'T' && tfType === 'TEPAT_TIDAK'));
                    
                    if (tfType === 'SESUAI_TIDAK') {
                        keysArr.push(isPos ? 'S' : 'TS');
                    } else if (tfType === 'TEPAT_TIDAK') {
                        keysArr.push(isPos ? 'T' : 'TT');
                    } else {
                        keysArr.push(isPos ? 'B' : 'S');
                    }
                });
                keyStr = keysArr.join(',');
            } else if (q.type === 'MCQ_COMPLEX') {
                tipeStr = 'MCQ_COMPLEX';
                opts.forEach((opt, oIdx) => {
                    if (oIdx < 5) optTexts[oIdx] = opt.text || '';
                });
                if (Array.isArray(q.correctAnswer)) {
                    keyStr = q.correctAnswer.join(',');
                } else if (typeof q.correctAnswer === 'string') {
                    keyStr = q.correctAnswer;
                }
            } else {
                tipeStr = 'MCQ';
                opts.forEach((opt, oIdx) => {
                    if (oIdx < 5) optTexts[oIdx] = opt.text || '';
                });
                keyStr = String(q.correctAnswer || 'A');
            }

            rows.push([
                no,
                tipeStr,
                q.text || q.questionText || '',
                q.bottomText || '',
                q.imageUrl || q.questionImageUrl || '',
                optTexts[0],
                optTexts[1],
                optTexts[2],
                optTexts[3],
                optTexts[4],
                keyStr,
                Number(q.score || 10),
                q.explanation || ''
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 10 }, { wch: 22 }, { wch: 45 }, { wch: 30 }, { wch: 25 },
            { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
            { wch: 15 }, { wch: 10 }, { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daftar_Soal");

        const rawTitle = examTitle || (AppState.currentExam && AppState.currentExam.title) || 'Ujian';
        const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim().substring(0, 40) || 'Ujian';
        const fileName = `Soal_${cleanTitle}.xlsx`;

        XLSX.writeFile(wb, fileName);
        UI.showToast(`Berhasil mendownload ${questionsList.length} soal ke file ${fileName}!`, 'success');
    } catch (err) {
        console.error("downloadQuestionsAsExcel error:", err);
        UI.showToast('Gagal membuat file Excel: ' + err.message, 'error');
    }
}
window.downloadQuestionsAsExcel = downloadQuestionsAsExcel;

/**
 * Downloads questions for a specific examId by fetching them first.
 */
async function downloadExamQuestionsExcel(examId, examTitle) {
    if (!AppState.user || !AppState.user.sessionId) {
        UI.showToast('Sesi tidak valid, silakan login ulang.', 'error');
        return;
    }
    UI.showToast('Mengambil data soal ujian...', 'info');
    try {
        const res = await api.getQuestions(AppState.user.sessionId, examId);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            downloadQuestionsAsExcel(res.data, examTitle);
        } else {
            UI.showToast(res.message || 'Ujian ini belum memiliki soal untuk didownload.', 'warning');
        }
    } catch (err) {
        console.error("downloadExamQuestionsExcel error:", err);
        UI.showToast('Gagal memuat soal ujian.', 'error');
    }
}
window.downloadExamQuestionsExcel = downloadExamQuestionsExcel;

/**
 * Downloads comprehensive exam results and student answers as a multi-sheet Excel file.
 */
async function downloadExamResultsExcel(examId, examTitle, triggerBtnId) {
    if (!AppState.user || !AppState.user.sessionId) {
        UI.showToast('Sesi tidak valid, silakan login ulang.', 'error');
        return;
    }
    if (typeof XLSX === 'undefined') {
        UI.showToast('Library Excel sedang dimuat, coba sesaat lagi.', 'warning');
        return;
    }

    const btn = triggerBtnId ? document.getElementById(triggerBtnId) : null;
    let oldBtnHtml = '';
    if (btn) {
        oldBtnHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyiapkan Excel...';
    }

    UI.showToast('Menyiapkan file Excel hasil ujian dan jawaban siswa...', 'info');

    try {
        const res = await api.getExamResultsExportData(AppState.user.sessionId, examId);
        if (!res.success || !res.data) {
            throw new Error(res.message || 'Gagal memuat data hasil dari server.');
        }

        const data = res.data;
        const exam = data.exam || {};
        const questions = Array.isArray(data.questions) ? data.questions : [];
        const attempts = Array.isArray(data.attempts) ? data.attempts : [];

        if (attempts.length === 0) {
            UI.showToast('Belum ada siswa yang mengerjakan ujian ini.', 'warning');
            return;
        }

        const wb = XLSX.utils.book_new();

        // -------------------------------------------------------------
        // SHEET 1: REKAPITULASI NILAI SISWA
        // -------------------------------------------------------------
        const rekapRows = [
            ["REKAPITULASI HASIL UJIAN SISWA"],
            ["Judul Ujian", exam.title || examTitle || '-'],
            ["Mata Pelajaran", exam.subject || '-'],
            ["Target Kelas", exam.className || 'Semua'],
            ["Standar KKM", exam.kkm || 75],
            ["Total Peserta", attempts.length],
            ["Waktu Download", new Date().toLocaleString('id-ID')],
            [],
            [
                "No", "NIS", "Nama Peserta", "Kelas", "Percobaan", "Status",
                "Nilai Akhir", "KKM", "Hasil KKM", "Jml Benar", "Jml Salah", "Keluar Tab / App",
                "Waktu Mulai", "Waktu Selesai", "Durasi Pengerjaan"
            ]
        ];

        attempts.forEach((att, idx) => {
            let durationStr = '-';
            if (att.startedAt && att.submittedAt) {
                const diffMs = new Date(att.submittedAt) - new Date(att.startedAt);
                if (diffMs > 0) {
                    const totalSec = Math.floor(diffMs / 1000);
                    const mins = Math.floor(totalSec / 60);
                    const secs = totalSec % 60;
                    durationStr = `${mins}m ${secs}s`;
                }
            }

            rekapRows.push([
                idx + 1,
                att.nis || '-',
                att.name || '-',
                att.className || '-',
                `Ke-${att.attemptNumber || 1}`,
                att.status === 'SUBMITTED' ? 'Selesai' : 'Sedang Mengerjakan',
                att.score !== null && att.score !== undefined ? att.score : '-',
                att.kkm || exam.kkm || 75,
                att.passStatus || '-',
                att.totalCorrect !== undefined ? att.totalCorrect : '-',
                att.totalWrong !== undefined ? att.totalWrong : '-',
                `${att.tabSwitchCount || 0}x`,
                att.startedAt ? new Date(att.startedAt).toLocaleString('id-ID') : '-',
                att.submittedAt ? new Date(att.submittedAt).toLocaleString('id-ID') : '-',
                durationStr
            ]);
        });

        const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows);
        wsRekap['!cols'] = [
            { wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
            { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
            { wch: 20 }, { wch: 20 }, { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap_Nilai");

        // -------------------------------------------------------------
        // SHEET 2: MATRIKS JAWABAN SISWA PER NOMOR SOAL
        // -------------------------------------------------------------
        if (questions.length > 0) {
            const formatKeyText = (q) => {
                if (q.type === 'TRUE_FALSE') {
                    const tfType = q.tfType || 'BENAR_SALAH';
                    const opts = q.options || [];
                    const keys = [];
                    opts.forEach((opt, oIdx) => {
                        let ansVal = '';
                        if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
                            ansVal = q.correctAnswer[opt.id] || q.correctAnswer[String(oIdx + 1)] || q.correctAnswer[oIdx] || '';
                        } else {
                            ansVal = q.correctAnswer;
                        }
                        const isPos = (ansVal === 'TRUE' || ansVal === true || String(ansVal).toUpperCase() === 'B' || (String(ansVal).toUpperCase() === 'S' && tfType === 'SESUAI_TIDAK') || (String(ansVal).toUpperCase() === 'T' && tfType === 'TEPAT_TIDAK'));
                        if (tfType === 'SESUAI_TIDAK') keys.push(isPos ? 'S' : 'TS');
                        else if (tfType === 'TEPAT_TIDAK') keys.push(isPos ? 'T' : 'TT');
                        else keys.push(isPos ? 'B' : 'S');
                    });
                    return keys.join(',');
                } else if (q.type === 'MCQ_COMPLEX') {
                    return Array.isArray(q.correctAnswer) ? q.correctAnswer.join(',') : String(q.correctAnswer || '');
                } else {
                    return String(q.correctAnswer || 'A');
                }
            };

            const formatStudentAnswerCell = (ansObj, q) => {
                if (!ansObj || ansObj.studentAnswer === null || ansObj.studentAnswer === undefined || ansObj.studentAnswer === '') {
                    return '-';
                }
                const statusTag = ansObj.isCorrect ? ' [✓]' : ' [✗]';

                if (q.type === 'TRUE_FALSE') {
                    const tfType = q.tfType || 'BENAR_SALAH';
                    const sMap = ansObj.studentAnswer;
                    if (typeof sMap === 'object' && sMap !== null) {
                        const opts = q.options || [];
                        const arr = [];
                        opts.forEach((opt, oIdx) => {
                            const v = sMap[opt.id] || sMap[String(oIdx + 1)] || sMap[oIdx] || '';
                            const isPos = (v === 'TRUE' || v === true || String(v).toUpperCase() === 'B' || (String(v).toUpperCase() === 'S' && tfType === 'SESUAI_TIDAK') || (String(v).toUpperCase() === 'T' && tfType === 'TEPAT_TIDAK'));
                            if (tfType === 'SESUAI_TIDAK') arr.push(isPos ? 'S' : 'TS');
                            else if (tfType === 'TEPAT_TIDAK') arr.push(isPos ? 'T' : 'TT');
                            else arr.push(isPos ? 'B' : 'S');
                        });
                        return arr.join(',') + statusTag;
                    }
                    return String(sMap) + statusTag;
                } else if (q.type === 'MCQ_COMPLEX') {
                    const val = Array.isArray(ansObj.studentAnswer) ? ansObj.studentAnswer.join(',') : String(ansObj.studentAnswer);
                    return val + statusTag;
                } else {
                    return String(ansObj.studentAnswer) + statusTag;
                }
            };

            const matriksHeaders = ["No", "NIS", "Nama Peserta", "Kelas", "Nilai Akhir"];
            questions.forEach((q, qIdx) => {
                const typeLabel = q.type === 'TRUE_FALSE' ? getTfLabels(q.tfType).name : (q.type === 'MCQ_COMPLEX' ? 'PG Kompleks' : 'PG');
                matriksHeaders.push(`Soal ${q.orderNo || (qIdx + 1)} (${typeLabel})`);
            });

            const matriksRows = [
                ["MATRIKS JAWABAN SISWA PER NOMOR SOAL"],
                ["Keterangan Simbol: [✓] = Benar, [✗] = Salah"],
                [],
                matriksHeaders
            ];

            // Kunci Jawaban Row
            const keyRow = ["-", "-", "KUNCI JAWABAN", "-", "-"];
            questions.forEach(q => {
                keyRow.push(formatKeyText(q));
            });
            matriksRows.push(keyRow);

            // Student Rows
            attempts.forEach((att, idx) => {
                const sRow = [
                    idx + 1,
                    att.nis || '-',
                    att.name || '-',
                    att.className || '-',
                    att.score !== null && att.score !== undefined ? att.score : '-'
                ];
                questions.forEach(q => {
                    const ansObj = att.answers ? att.answers[q.questionId] : null;
                    sRow.push(formatStudentAnswerCell(ansObj, q));
                });
                matriksRows.push(sRow);
            });

            const wsMatriks = XLSX.utils.aoa_to_sheet(matriksRows);
            const matriksCols = [
                { wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 12 }
            ];
            questions.forEach(() => matriksCols.push({ wch: 20 }));
            wsMatriks['!cols'] = matriksCols;
            XLSX.utils.book_append_sheet(wb, wsMatriks, "Matriks_Jawaban");

            // -------------------------------------------------------------
            // SHEET 3: ANALISIS BUTIR SOAL
            // -------------------------------------------------------------
            const analisisRows = [
                ["ANALISIS BUTIR SOAL UJIAN"],
                ["Judul Ujian", exam.title || examTitle || '-'],
                ["Total Siswa Mengikuti", attempts.length],
                [],
                [
                    "No Soal", "Tipe Soal", "Teks Pertanyaan", "Teks Bawah Gambar",
                    "Kunci Jawaban", "Bobot Poin", "Jml Siswa Menjawab", "Jml Jawaban Benar", "Jml Jawaban Salah", "Tingkat Ketuntasan (%)"
                ]
            ];

            questions.forEach((q, qIdx) => {
                let answeredCount = 0;
                let correctCount = 0;
                let wrongCount = 0;

                attempts.forEach(att => {
                    const ansObj = att.answers ? att.answers[q.questionId] : null;
                    if (ansObj && ansObj.studentAnswer !== null && ansObj.studentAnswer !== undefined && ansObj.studentAnswer !== '') {
                        answeredCount++;
                        if (ansObj.isCorrect) correctCount++;
                        else wrongCount++;
                    }
                });

                const passPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
                const typeName = q.type === 'TRUE_FALSE' ? getTfLabels(q.tfType).name : (q.type === 'MCQ_COMPLEX' ? 'Pilihan Ganda Kompleks' : 'Pilihan Ganda');

                analisisRows.push([
                    q.orderNo || (qIdx + 1),
                    typeName,
                    q.text || q.questionText || '',
                    q.bottomText || '',
                    formatKeyText(q),
                    q.score || 10,
                    answeredCount,
                    correctCount,
                    wrongCount,
                    `${passPct}%`
                ]);
            });

            const wsAnalisis = XLSX.utils.aoa_to_sheet(analisisRows);
            wsAnalisis['!cols'] = [
                { wch: 8 }, { wch: 24 }, { wch: 45 }, { wch: 30 },
                { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, wsAnalisis, "Analisis_Butir_Soal");
        }

        const rawTitle = exam.title || examTitle || 'Ujian';
        const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim().substring(0, 40) || 'Ujian';
        const fileName = `Hasil_Ujian_${cleanTitle}.xlsx`;

        XLSX.writeFile(wb, fileName);
        UI.showToast(`Berhasil mendownload hasil ujian siswa ke file ${fileName}!`, 'success');
    } catch (err) {
        console.error("downloadExamResultsExcel error:", err);
        UI.showToast('Gagal membuat file Excel hasil ujian: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldBtnHtml;
        }
    }
}
window.downloadExamResultsExcel = downloadExamResultsExcel;
window.downloadExamResultsFromDashboard = downloadExamResultsExcel;
window.downloadExamQuestionsFromDashboard = downloadExamQuestionsExcel;

