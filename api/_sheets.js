// ============================================================================
// Google Spreadsheet / Google Apps Script Bridge
// ============================================================================

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w/exec";

function getScriptUrl() {
    return process.env.GOOGLE_SCRIPT_URL || process.env.APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
}

/**
 * Sends a structured payload to Google Apps Script doPost(e) / doGet(e)
 */
async function callGoogleAppsScript(action, payload = {}) {
    const url = getScriptUrl();
    if (!url) {
        throw new Error('Google Apps Script URL belum dikonfigurasi (GOOGLE_SCRIPT_URL).');
    }

    const body = {
        action: action,
        secret: process.env.SYNC_SECRET || 'SMANLI_CBT_SYNC_SECRET_2026',
        timestamp: new Date().toISOString(),
        ...payload
    };

    try {
        // 1. Try standard HTTP POST
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            redirect: 'follow',
        });

        const rawText = await response.text();
        const trimmed = rawText.trim();

        // 2. Check if Apps Script returned valid JSON
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed);
            } catch (jsonErr) {}
        }

        // 3. Fallback: If POST returned HTML (e.g. deployment missing doPost), attempt GET fallback
        if (trimmed.startsWith('<') || trimmed.includes('doPost')) {
            console.warn(`[Google Apps Script] POST returned HTML for "${action}". Attempting GET fallback...`);
            try {
                const getUrl = new URL(url);
                getUrl.searchParams.set('action', action);
                getUrl.searchParams.set('payload', JSON.stringify(payload));
                const getRes = await fetch(getUrl.toString(), { redirect: 'follow' });
                const getText = (await getRes.text()).trim();
                if (getText.startsWith('{') || getText.startsWith('[')) {
                    return JSON.parse(getText);
                }
            } catch (getErr) {
                console.warn('[Google Apps Script] GET fallback also failed:', getErr.message);
            }
        }

        throw new Error(`Google Apps Script mengembalikan non-JSON. Pastikan Web App dideploy dengan hak akses "Siapa saja" (Anyone) dan versi terbaru telah diterapkan.`);
    } catch (err) {
        console.error(`[Google Apps Script] Error calling ${action}:`, err.message);
        return {
            success: false,
            message: err.message,
            error: err
        };
    }
}

module.exports = {
    getScriptUrl,
    callGoogleAppsScript
};
