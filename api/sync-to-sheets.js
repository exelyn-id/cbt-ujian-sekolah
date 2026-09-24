// ============================================================================
// API Endpoint: /api/sync-to-sheets (Buffered Batch Sync to Google Sheets)
// ============================================================================
const { kv } = require('./_redis');
const { callGoogleAppsScript } = require('./_sheets');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const queueLen = await kv.llen('queue:sync_to_sheets');
        if (queueLen === 0) {
            return res.status(200).json({
                success: true,
                message: 'Antrean sinkronisasi kosong. Seluruh data sudah tersimpan di Google Spreadsheet.',
                syncedCount: 0
            });
        }

        // Process in controlled batches of up to 20 attempts
        const BATCH_SIZE = 20;
        const attemptIdsToProcess = [];

        for (let i = 0; i < BATCH_SIZE; i++) {
            const id = await kv.lpop('queue:sync_to_sheets');
            if (!id) break;
            attemptIdsToProcess.push(id);
        }

        if (attemptIdsToProcess.length === 0) {
            return res.status(200).json({ success: true, syncedCount: 0 });
        }

        // Retrieve full records
        const attemptsData = [];
        const answersData = [];

        for (const id of attemptIdsToProcess) {
            const record = await kv.get(`attempt:record:${id}`);
            if (record) {
                attemptsData.push(record);
                if (Array.isArray(record.answers)) {
                    for (const ans of record.answers) {
                        answersData.push({
                            attemptId: record.attemptId,
                            examId: record.examId,
                            questionId: ans.questionId,
                            studentAnswerJson: JSON.stringify(ans.studentAnswer),
                            savedAt: record.submittedAt,
                            scoreAwarded: ans.scoreAwarded,
                            isCorrect: ans.isCorrect,
                            maxScore: ans.maxScore
                        });
                    }
                }
            }
        }

        if (attemptsData.length === 0) {
            return res.status(200).json({ success: true, message: 'Tidak ada data valid dalam antrean.', syncedCount: 0 });
        }

        // Send batch payload to Google Apps Script doPost
        console.log(`[Sync Worker] Mengirim batch ${attemptsData.length} hasil ujian ke Google Spreadsheet...`);
        const gasRes = await callGoogleAppsScript('batch_sync_attempts', {
            attempts: attemptsData,
            answers: answersData
        });

        if (!gasRes || !gasRes.success) {
            console.error('[Sync Worker] Gagal sinkronisasi ke Google Sheets:', gasRes ? gasRes.message : 'Unknown error');
            // Re-enqueue items on failure to prevent data loss!
            for (const id of attemptIdsToProcess) {
                await kv.rpush('queue:sync_to_sheets', id);
            }
            return res.status(500).json({
                success: false,
                message: 'Gagal mengirim batch ke Google Spreadsheet: ' + (gasRes ? gasRes.message : 'Timeout'),
                requeuedCount: attemptIdsToProcess.length
            });
        }

        console.log(`[Sync Worker] Sukses sinkronisasi ${attemptsData.length} peserta ke Google Spreadsheet.`);

        return res.status(200).json({
            success: true,
            message: `Berhasil menyinkronkan ${attemptsData.length} hasil ujian ke Google Spreadsheet.`,
            syncedCount: attemptsData.length,
            remainingQueue: await kv.llen('queue:sync_to_sheets')
        });
    } catch (err) {
        console.error('API /api/sync-to-sheets error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal Error: ' + err.message
        });
    }
};
