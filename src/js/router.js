// Simple Hash-based Router
const Router = {
    routes: {},
    currentRoute: null,
    
    addRoute(path, handler) {
        this.routes[path] = handler;
    },
    
    navigate(path) {
        const targetHash = path.startsWith('#') ? path : '#' + path;
        if (window.location.hash === targetHash) {
            this.handleRoute();
        } else {
            window.location.hash = targetHash;
        }
    },
    
    async handleRoute() {
        let hash = window.location.hash || '#/login';
        if (hash === '#' || hash === '#/') hash = '#/login';

        // Extract path and query params (e.g. #/exam?id=123)
        const rawPath = hash.startsWith('#') ? hash.substring(1) : hash;
        const [path, queryString] = rawPath.split('?');
        const params = new URLSearchParams(queryString || '');
        
        const app = document.getElementById('app');
        if (!app) return;
        
        if (this.routes[path]) {
            this.currentRoute = path;
            // Clear current view
            app.innerHTML = '<div class="loading-full"><i class="ph ph-spinner ph-spin"></i><span>Memuat...</span></div>';
            
            try {
                // Execute route handler
                const viewHtml = await this.routes[path](params);
                app.innerHTML = viewHtml;
                
                // Trigger an event so views can attach event listeners after DOM update
                document.dispatchEvent(new CustomEvent('viewRendered', { detail: { path, params } }));
            } catch (error) {
                console.error("Route error:", error);
                app.innerHTML = `<div class="container mt-6"><div class="card"><h2 class="text-error">Error</h2><p>Gagal memuat halaman: ${error.message || error}</p></div></div>`;
            }
        } else {
            app.innerHTML = `<div class="container mt-6 text-center view">
                <h2>404 Not Found</h2>
                <p class="text-muted mb-4">Halaman yang Anda tuju tidak ditemukan.</p>
                <button class="btn btn-primary" onclick="Router.navigate('/login')">Kembali ke Awal</button>
            </div>`;
        }
    },
    
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        
        const resolveInitialRoute = (params = {}) => {
            // Priority 1: Check existing hash
            if (window.location.hash && window.location.hash !== '#' && window.location.hash !== '#/') {
                this.handleRoute();
                return;
            }
            
            // Priority 2: Check query parameters (injected, GAS client, or URL search)
            const injected = (typeof window !== 'undefined' && window.__INITIAL_PARAMS__) || {};
            const urlParams = new URLSearchParams(window.location.search);
            const examId = params.exam || params.examId || injected.exam || injected.examId || urlParams.get('exam') || urlParams.get('examId');
            const mode = params.mode || injected.mode || urlParams.get('mode');
            const page = params.page || injected.page || urlParams.get('page');
            const role = params.role || injected.role || urlParams.get('role');
            const portal = params.portal || injected.portal || urlParams.get('portal');
            const view = params.view || injected.view || urlParams.get('view');
            
            if (examId) {
                window.location.hash = `#/student/landing?examId=${encodeURIComponent(examId)}`;
            } else if (page === 'student' || page === 'siswa' || page === 'portal' ||
                       mode === 'student' || mode === 'siswa' ||
                       role === 'student' || role === 'siswa' ||
                       portal === 'student' || portal === 'siswa' ||
                       view === 'student' || view === 'siswa') {
                window.location.hash = `#/student/dashboard`;
            } else if (mode === 'teacher') {
                window.location.hash = `#/dashboard`;
            } else {
                window.location.hash = `#/login`;
            }
            
            this.handleRoute();
        };

        // If window.__INITIAL_PARAMS__ already has routing flags, resolve immediately!
        const initial = (typeof window !== 'undefined' && window.__INITIAL_PARAMS__) || {};
        if (initial.exam || initial.examId || initial.mode || initial.page || initial.role || initial.portal || initial.view) {
            resolveInitialRoute(initial);
            return;
        }

        // Retrieve URL parameters via Google Apps Script client API if in GAS, or URLSearchParams
        if (typeof google !== 'undefined' && google.script && google.script.url) {
            let resolved = false;
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolveInitialRoute({});
                }
            }, 2500);

            try {
                google.script.url.getLocation((loc) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        if (loc && loc.url) {
                            window.WEB_APP_URL = loc.url.split('?')[0].split('#')[0];
                        }
                        resolveInitialRoute(loc ? (loc.parameter || {}) : {});
                    }
                });
            } catch (err) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolveInitialRoute({});
                }
            }
        } else {
            resolveInitialRoute({});
        }
    }
};
