const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const SRC_DIR = path.join(BASE_DIR, 'src');

const cssFiles = [
    path.join(SRC_DIR, 'css', 'styles.css')
];

const jsFiles = [
    path.join(SRC_DIR, 'js', 'state.js'),
    path.join(SRC_DIR, 'js', 'api-mock.js'),
    path.join(SRC_DIR, 'js', 'router.js'),
    path.join(SRC_DIR, 'js', 'views', 'teacher-login.js'),
    path.join(SRC_DIR, 'js', 'views', 'teacher-dashboard.js'),
    path.join(SRC_DIR, 'js', 'views', 'exam-editor.js'),
    path.join(SRC_DIR, 'js', 'views', 'question-builder.js'),
    path.join(SRC_DIR, 'js', 'views', 'teacher-results.js'),
    path.join(SRC_DIR, 'js', 'views', 'student-dashboard.js'),
    path.join(SRC_DIR, 'js', 'views', 'student-landing.js'),
    path.join(SRC_DIR, 'js', 'views', 'student-exam.js'),
    path.join(SRC_DIR, 'js', 'views', 'student-result.js'),
    path.join(SRC_DIR, 'js', 'app.js')
];

let combinedCss = '';
for (const fpath of cssFiles) {
    if (fs.existsSync(fpath)) {
        combinedCss += `/* --- ${path.basename(fpath)} --- */\n` + fs.readFileSync(fpath, 'utf-8') + '\n\n';
    }
}

let combinedJs = '';
for (const fpath of jsFiles) {
    if (fs.existsSync(fpath)) {
        combinedJs += `// --- ${path.basename(fpath)} ---\n` + fs.readFileSync(fpath, 'utf-8') + '\n\n';
    }
}

const singleHtmlTemplate = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web App Ujian Online</title>
    <meta name="color-scheme" content="light">
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Phosphor Icons -->
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/css/icons.css">
    <script src="https://unpkg.com/@phosphor-icons/web" defer></script>
    <!-- SheetJS (Excel .xlsx parser & exporter) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <style>
${combinedCss}
    </style>
</head>
<body>
    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>
    
    <!-- Modal Container -->
    <div id="modal-container" class="modal-container hidden">
        <div class="modal-overlay" onclick="closeModal()"></div>
        <div class="modal-content" id="modal-body"></div>
    </div>

    <!-- App Container (Dynamic Views injected here) -->
    <div id="app" class="app-container">
        <div class="loading-full">
            <i class="ph ph-spinner ph-spin"></i> <span>Memuat Aplikasi...</span>
        </div>
    </div>

    <script>
${combinedJs}
    </script>
</body>
</html>
`;

// Write to root index.html
const outputRoot = path.join(BASE_DIR, 'index.html');
fs.writeFileSync(outputRoot, singleHtmlTemplate, 'utf-8');

// Write to public/ directory for Vercel Output Directory
const publicDir = path.join(BASE_DIR, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}
const outputPublic = path.join(publicDir, 'index.html');
fs.writeFileSync(outputPublic, singleHtmlTemplate, 'utf-8');

console.log(`Successfully generated single-file index.html at root and ${outputPublic} (${singleHtmlTemplate.length} bytes)`);
