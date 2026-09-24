Router.addRoute('/login', async () => {
    return `
        <div class="view flex items-center justify-center" style="background-color: var(--primary-50); min-height: 100vh;">
            <div class="card" style="width: 100%; max-width: 400px; margin: 1rem;">
                <div class="text-center mb-6">
                    <h2>CBT Online</h2>
                </div>
                
                <form id="loginForm" onsubmit="handleLogin(event)">
                    <div class="input-group">
                        <label class="input-label" for="username">Username</label>
                        <input type="text" id="username" class="input-control" placeholder="Masukkan username" required autocomplete="username">
                    </div>
                    
                    <div class="input-group">
                        <label class="input-label" for="password">Password</label>
                        <input type="password" id="password" class="input-control" placeholder="Masukkan password" required autocomplete="current-password">
                    </div>
                    
                    <button type="submit" id="loginBtn" class="btn btn-primary w-full mt-4">
                        Masuk
                    </button>
                    
                    <div class="mt-5 pt-4 text-center" style="border-top: 1px dashed var(--border-color);">
                        <p class="text-xs text-muted mb-2">Apakah Anda seorang siswa?</p>
                        <a href="#/student/dashboard" class="btn btn-outline-primary btn-sm w-full flex items-center justify-center gap-1.5" style="text-decoration: none; font-weight: 600;">
                            <i class="ph ph-student"></i> Buka Portal Ujian Siswa (Tanpa Login)
                        </a>
                    </div>
                </form>
            </div>
        </div>
    `;
});

// Using global function so it can be called from onclick/onsubmit in HTML string
window.handleLogin = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('loginBtn');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Memproses...';
    
    try {
        const response = await api.loginTeacher(username, password);
        if (response.success) {
            try {
                localStorage.setItem('cbt_auth_user', JSON.stringify(response.data));
            } catch (err) {}
            AppState.update({ 
                mode: 'teacher',
                user: response.data
            });
            UI.showToast('Login berhasil', 'success');
            Router.navigate('/dashboard');
        } else {
            UI.showToast(response.message || 'Login gagal', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Masuk';
        }
    } catch (e) {
        UI.showToast('Terjadi kesalahan koneksi', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Masuk';
    }
};
