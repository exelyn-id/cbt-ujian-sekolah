import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(BASE_DIR, 'src')

css_files = [
    os.path.join(SRC_DIR, 'css', 'styles.css')
]

js_files = [
    os.path.join(SRC_DIR, 'js', 'state.js'),
    os.path.join(SRC_DIR, 'js', 'api-mock.js'),
    os.path.join(SRC_DIR, 'js', 'router.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'teacher-login.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'teacher-dashboard.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'exam-editor.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'question-builder.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'teacher-results.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'student-dashboard.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'student-landing.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'student-exam.js'),
    os.path.join(SRC_DIR, 'js', 'views', 'student-result.js'),
    os.path.join(SRC_DIR, 'js', 'app.js')
]

# Read all CSS
combined_css = ""
for fpath in css_files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            combined_css += f"/* --- {os.path.basename(fpath)} --- */\n" + f.read() + "\n\n"

# Read all JS
combined_js = ""
for fpath in js_files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            combined_js += f"// --- {os.path.basename(fpath)} ---\n" + f.read() + "\n\n"

single_html_template = f"""<!DOCTYPE html>
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
{combined_css}
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
{combined_js}
    </script>
</body>
</html>
"""

# Write to root index.html
output_root = os.path.join(BASE_DIR, 'index.html')
with open(output_root, 'w', encoding='utf-8') as f:
    f.write(single_html_template)

print(f"Successfully generated single-file index.html at {output_root} ({len(single_html_template)} bytes)")

# Validation: Syntax check with Node.js
import subprocess, tempfile
with tempfile.NamedTemporaryFile(suffix='.js', mode='w', encoding='utf-8', delete=False) as tf:
    tf.write(combined_js)
    temp_js_path = tf.name

try:
    res = subprocess.run(['node', '-c', temp_js_path], capture_output=True, text=True)
    if res.returncode != 0:
        print("ERROR: JavaScript Syntax Check Failed:")
        print(res.stderr)
        exit(1)
    else:
        print("Verification: JavaScript syntax is 100% valid (0 syntax errors).")
finally:
    if os.path.exists(temp_js_path):
        os.remove(temp_js_path)

# Verify no '//script' pattern to avoid GAS HTML sanitizer truncation
if '//script' in combined_js.lower():
    print("WARNING: Found '//script' in JS which triggers GAS Caja comment sanitizer truncation!")
else:
    print("Verification: No dangerous '//script' pattern found.")

