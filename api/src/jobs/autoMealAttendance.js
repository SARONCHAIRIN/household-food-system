const cron = require('node-cron');
const db = require('../prismaClient');

/**
 * Returns today's date formatted as YYYY-MM-DD in the target timezone.
 * @param {string} timeZone
 * @returns {string}
 */
function getTodayDateStr(timeZone = process.env.TIMEZONE || 'Asia/Phnom_Penh') {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/**
 * Core logic to check and auto-create missing meal attendance records as EAT / AUTO.
 * Completely idempotent: running multiple times for the same date will not duplicate
 * or overwrite existing records.
 *
 * @param {string} [customDate] - Optional date string (YYYY-MM-DD). Defaults to today in target timezone.
 * @returns {Promise<{success: boolean, date: string, message: string, processedCount: number, createdCount: number, createdRecords?: Array}>}
 */
async function runAutoMealAttendance(customDate = null) {
    const targetDate = customDate || getTodayDateStr();
    console.log(`[AutoMealAttendance] Checking meal attendance for date: ${targetDate}`);

    // 1. Fetch all ACTIVE members
    const membersResult = await db.pool.query(`
        SELECT id, name, username, email
        FROM "USERS"
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
    `);

    const activeMembers = membersResult.rows;

    if (activeMembers.length === 0) {
        console.log('[AutoMealAttendance] No active members found.');
        return {
            success: true,
            date: targetDate,
            message: 'No active members found',
            processedCount: 0,
            createdCount: 0,
            createdRecords: []
        };
    }

    // 2. Query existing meal_statuses for today's date
    const existingStatusesResult = await db.pool.query(
        `SELECT id, member_id, date, status, confirmation_type
         FROM "MEAL_STATUS"
         WHERE date = $1`,
        [targetDate]
    );

    const existingRows = existingStatusesResult.rows;
    const recordedMemberIds = new Set(existingRows.map(r => r.member_id.toString()));

    // 3. Filter for active members who have NO status recorded for today
    const missingMembers = activeMembers.filter(
        m => !recordedMemberIds.has(m.id.toString())
    );

    if (missingMembers.length === 0) {
        console.log(`[AutoMealAttendance] All ${activeMembers.length} active member(s) already have meal statuses for ${targetDate}.`);
        return {
            success: true,
            date: targetDate,
            message: 'All active members already have recorded meal statuses',
            processedCount: activeMembers.length,
            createdCount: 0,
            createdRecords: []
        };
    }

    console.log(
        `[AutoMealAttendance] Found ${missingMembers.length} active member(s) missing meal attendance for ${targetDate}. Creating default EAT / AUTO records...`
    );

    // 4. Perform bulk insert in a database transaction with ON CONFLICT DO NOTHING for idempotency
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const valueClauses = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const member of missingMembers) {
            valueClauses.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
            );
            queryParams.push(member.id, targetDate, 'EAT', 'AUTO');
            paramIndex += 4;
        }

        const insertQuery = `
            INSERT INTO "MEAL_STATUS" (
                member_id,
                date,
                status,
                confirmation_type,
                confirmed_at,
                created_at,
                updated_at
            )
            VALUES ${valueClauses.join(', ')}
            ON CONFLICT (member_id, date) DO NOTHING
            RETURNING id, member_id, date, status, confirmation_type
        `;

        const insertResult = await client.query(insertQuery, queryParams);
        await client.query('COMMIT');

        const createdRecords = insertResult.rows.map(r => ({
            id: r.id.toString(),
            memberId: r.member_id.toString(),
            date: targetDate,
            status: r.status,
            confirmationType: r.confirmation_type
        }));

        console.log(
            `[AutoMealAttendance] Successfully created ${createdRecords.length} default meal attendance record(s) for ${targetDate}.`
        );

        return {
            success: true,
            date: targetDate,
            message: `Successfully created ${createdRecords.length} auto-default meal status(es)`,
            processedCount: activeMembers.length,
            missingCount: missingMembers.length,
            createdCount: createdRecords.length,
            createdRecords
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[AutoMealAttendance] Transaction failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Initializes and schedules the node-cron job to run every day at 11:00 AM.
 * Target timezone defaults to Asia/Phnom_Penh.
 *
 * @returns {import('node-cron').ScheduledTask}
 */
function startAutoMealAttendanceJob() {
    const timeZone = process.env.TIMEZONE || 'Asia/Phnom_Penh';

    // 0 11 * * * = Daily at 11:00 AM
    const task = cron.schedule('0 11 * * *', async () => {
        console.log(`[CRON] Firing 11:00 AM auto-attendance job in timezone: ${timeZone}`);
        try {
            const result = await runAutoMealAttendance();
            console.log('[CRON] Auto-attendance job result:', result);
        } catch (error) {
            console.error('[CRON] Auto-attendance job encountered an error:', error);
        }
    }, {
        scheduled: true,
        timezone: timeZone
    });

    console.log(`[CRON] Scheduled 11:00 AM auto-meal attendance job (Timezone: ${timeZone})`);
    return task;
}

// Allow direct execution via CLI: node src/jobs/autoMealAttendance.js [YYYY-MM-DD]
if (require.main === module) {
    const customDate = process.argv[2] || null;
    runAutoMealAttendance(customDate)
        .then(result => {
            console.log('[AutoMealAttendance CLI] Finished:', JSON.stringify(result, null, 2));
            return db.pool.end();
        })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[AutoMealAttendance CLI] Error:', err);
            db.pool.end().finally(() => process.exit(1));
        });
}

module.exports = {
    getTodayDateStr,
    runAutoMealAttendance,
    startAutoMealAttendanceJob
};
