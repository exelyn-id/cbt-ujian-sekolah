// ============================================================================
// Application Bootstrapper & Lifecycle Initialization
// ============================================================================
(function() {
    let appInitialized = false;

    function startApp() {
        if (appInitialized) return;
        appInitialized = true;

        try {
            console.log("Web App Ujian Online: Menginisialisasi Router...");
            Router.init();
        } catch (err) {
            console.error("Fatal Error initializing application:", err);
            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = `
                    <div class="container mt-6">
                        <div class="card text-center" style="max-width: 480px; margin: 3rem auto; padding: 2rem;">
                            <div class="text-error mb-3">
                                <i class="ph ph-warning-circle" style="font-size: 3rem;"></i>
                            </div>
                            <h3 style="margin-bottom: 0.5rem;">Gagal Memuat Aplikasi</h3>
                            <p class="text-muted text-sm mb-4">
                                ${err && err.message ? err.message : 'Terjadi kesalahan sistem saat inisialisasi aplikasi.'}
                            </p>
                            <button class="btn btn-primary" onclick="window.location.reload()">
                                Muat Ulang Halaman
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }

    // Support both direct load and sandboxed iframe environments (Google Apps Script)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(startApp, 10);
    } else {
        document.addEventListener('DOMContentLoaded', startApp);
        window.addEventListener('load', startApp);
        // Fallback timer if events were already dispatched
        setTimeout(startApp, 300);
    }
})();
