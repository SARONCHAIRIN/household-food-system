const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/meal-statuses:
 *   get:
 *     summary: Get all meal statuses
 *     description: Retrieve all meal choice records for household members.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', verifyToken, async(req, res) => {
    try {
        const result = await db.pool.query(
            'SELECT * FROM "MEAL_STATUS" ORDER BY date DESC'
        );

        const rows = result.rows;

        const formatted = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            memberId: r.member_id.toString()
        }));

        res.json(formatted);
    } catch (error) {
        console.error('GET meal statuses error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * @swagger
 * /api/v1/meal-statuses:
 *   post:
 *     summary: Set or update meal status for a date
 *     description: Members can declare whether they will EAT or NOT_EAT before the cut-off time.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2026-09-09"
 *               status:
 *                 type: string
 *                 enum: [EAT, NOT_EAT]
 *                 example: "NOT_EAT"
 *     responses:
 *       200:
 *         description: Meal status updated successfully
 *       201:
 *         description: Meal status recorded successfully
 *       400:
 *         description: Invalid data or cut-off time passed
 *       403:
 *         description: Forbidden - Only active members can set meal attendance
 */
router.post('/', verifyToken, async(req, res) => {
    try {
        const { date, status } = req.body;
        const memberId = req.user.id;
        const confirmationType = 'MANUAL';

        // 1. Retrieve current User Account Status from DB
        const userRes = await db.pool.query(
            'SELECT id, status FROM "USERS" WHERE id = $1 LIMIT 1',
            [memberId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const userStatus = userRes.rows[0].status;

        // 2. Validate Active Eligibility:
        // Only ACTIVE members can set or update meal attendance.
        // Role Independence: Applies to all users (including ADMIN) based on their account status.
        if (userStatus !== 'ACTIVE') {
            return res.status(403).json({
                error: `Only active members can set meal attendance. Your account status is currently ${userStatus || 'INACTIVE'}.`
            });
        }

        // Validate status
        if (!['EAT', 'NOT_EAT'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Use EAT or NOT_EAT'
            });
        }

        // Validate date
        if (!date) {
            return res.status(400).json({
                error: 'Date is required'
            });
        }

        const tz = process.env.TIMEZONE || 'Asia/Phnom_Penh';
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const targetDateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? date
            : new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(parsedDate);
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

        // Cut-off time check (default 12:00 PM in target timezone, bypassable by ADMIN)
        if (targetDateStr === todayStr) {
            const currentHour = parseInt(
                new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()),
                10
            );
            const cutoffHour = process.env.CUTOFF_HOUR ? parseInt(process.env.CUTOFF_HOUR, 10) : 12;

            if (currentHour >= cutoffHour && req.user.role !== 'ADMIN') {
                return res.status(400).json({
                    error: `Cut-off time passed! You cannot change your meal status after ${cutoffHour}:00.`
                });
            }
        }

        // Check if record already exists (to provide proper 200/201 status and messaging)
        const existingResult = await db.pool.query(
            `SELECT id, confirmation_type
             FROM "MEAL_STATUS"
             WHERE member_id = $1
             AND date = $2
             LIMIT 1`,
            [memberId, targetDateStr]
        );

        const isUpdate = existingResult.rows.length > 0;

        // Atomic UPSERT:
        // - If record exists (whether AUTO or MANUAL), update status to choice and set confirmation_type = 'MANUAL'
        // - If no record exists, insert with confirmation_type = 'MANUAL'
        const upsertQuery = `
            INSERT INTO "MEAL_STATUS" (
                member_id,
                date,
                status,
                confirmation_type,
                confirmed_at,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (member_id, date)
            DO UPDATE SET
                status = EXCLUDED.status,
                confirmation_type = 'MANUAL',
                confirmed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, member_id, date, status, confirmation_type, confirmed_at, updated_at
        `;

        const result = await db.pool.query(upsertQuery, [
            memberId,
            targetDateStr,
            status,
            confirmationType
        ]);

        const record = result.rows[0];

        return res.status(isUpdate ? 200 : 201).json({
            message: isUpdate
                ? 'Meal status updated successfully'
                : 'Meal status recorded successfully',
            record: {
                id: record.id.toString(),
                memberId: record.member_id.toString(),
                date: targetDateStr,
                status: record.status,
                confirmationType: record.confirmation_type,
                confirmedAt: record.confirmed_at
            }
        });

    } catch (error) {
        console.error('POST meal status error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;