// ============================================================================
// Google Spreadsheet / Google Apps Script Bridge
// ============================================================================

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwD5Ezfr1xclvOw4Q6h6vIxwSTY9Sjq75424i4ex7LbGcAG5QdP27-9KBJeuqARXdQo1w/exec";

function getScriptUrl() {
    return process.env.GOOGLE_SCRIPT_URL || process.env.APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
}

/**
 * Sends a structured payload to Google Apps Script doPost(e)
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
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            redirect: 'follow',
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google Apps Script HTTP Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data;
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
