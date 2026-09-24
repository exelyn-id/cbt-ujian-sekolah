// ============================================================================
// API Endpoint: /api/teacher (Teacher Operations & Management Gateway)
// ============================================================================
const { callGoogleAppsScript } = require('./_sheets');
const { kv } = require('./_redis');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const action = req.query.action || (req.body && req.body.action);
        if (!action) {
            return res.status(400).json({ success: false, message: 'Action parameter is required' });
        }

        // Forward teacher management action to Google Apps Script
        const gasRes = await callGoogleAppsScript(action, req.body || req.query);

        // If action was saving or toggling exam, invalidate/update Redis cache for students!
        if (action === 'save_exam' || action === 'toggle_exam_portal' || action === 'delete_exam') {
            try {
                // Invalidate public exams list so students get latest changes
                await kv.del('exams:active_list');
            } catch (e) {}
        }

        return res.status(200).json(gasRes || { success: false, message: 'No response from Google Apps Script' });
    } catch (err) {
        console.error('API /api/teacher error:', err);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server guru: ' + err.message
        });
    }
};
