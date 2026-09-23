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
