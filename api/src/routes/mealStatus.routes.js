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
 */
router.post('/', verifyToken, async(req, res) => {
    try {
        const { date, status } = req.body;
        const memberId = req.user.id;
        const confirmationType = 'MANUAL';

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

        // Convert date safely
        const targetDateStr = new Date(date).toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);

        // Cut-off time: 12:00 PM
        if (targetDateStr === todayStr) {
            const currentHour = new Date().getHours();
            const cutoffHour = 12;

            if (currentHour >= cutoffHour) {
                return res.status(400).json({
                    error: 'Cut-off time passed! You cannot change your meal status after 12:00 PM.'
                });
            }
        }

        // Check existing record
        const existingResult = await db.pool.query(
            `SELECT id
             FROM "MEAL_STATUS"
             WHERE member_id = $1
             AND date = $2
             LIMIT 1`, [memberId, date]
        );

        const existing = existingResult.rows;

        // UPDATE existing record
        if (existing.length > 0) {
            await db.pool.query(
                `UPDATE "MEAL_STATUS"
                 SET status = $1,
                     confirmation_type = $2,
                     confirmed_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE member_id = $3
                 AND date = $4`, [
                    status,
                    confirmationType,
                    memberId,
                    date
                ]
            );

            return res.json({
                message: 'Meal status updated successfully'
            });
        }

        // INSERT new record
        await db.pool.query(
            `INSERT INTO "MEAL_STATUS"
                (member_id, date, status, confirmation_type, confirmed_at)
             VALUES
                ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [
                memberId,
                date,
                status,
                confirmationType
            ]
        );

        return res.status(201).json({
            message: 'Meal status recorded successfully'
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