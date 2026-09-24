// ============================================================================
// API Endpoint: /api/autosave (Instant Real-Time Student Answer Autosave)
// ============================================================================
const { kv } = require('./_redis');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { attemptId, examId, answersMap, tabSwitchCount } = req.body || {};

        if (!attemptId) {
            return res.status(400).json({ success: false, message: 'attemptId is required' });
        }

        const now = Date.now();
        const payload = {
            attemptId,
            examId,
            answers: answersMap || {},
            tabSwitchCount: Number(tabSwitchCount || 0),
            updatedAt: now
        };

        // Save to Redis (TTL 3 days)
        await kv.set(`attempt:answers:${attemptId}`, payload, { ex: 86400 * 3 });

        return res.status(200).json({
            success: true,
            savedAt: now,
            message: 'Jawaban berhasil disimpan.'
        });
    } catch (err) {
        console.error('API /api/autosave error:', err);
        return res.status(500).json({
            success: false,
            message: 'Gagal melakukan autosave: ' + err.message
        });
    }
};
