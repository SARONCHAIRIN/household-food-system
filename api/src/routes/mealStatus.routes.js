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
        const [rows] = await db.pool.query('SELECT * FROM MEAL_STATUS ORDER BY date DESC');
        const formatted = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            memberId: r.member_id.toString()
        }));
        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * @swagger
 * /api/v1/meal-statuses:
 *   post:
 *     summary: Set or update meal status for a date with a cut-off time (12:00 AM)
 *     description: Members can declare whether they will EAT or NOT_EAT before 11:00 AM on the target date.
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
 *         description: Cut-off time passed or invalid data
 */
router.post('/', verifyToken, async(req, res) => {
    try {
        const { date, status } = req.body;
        const memberId = req.user.id;
        const confirmationType = 'MANUAL';

        if (!['EAT', 'NOT_EAT'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use EAT or NOT_EAT' });
        }

        // 🌟 ពិនិត្យមើល Cut-off Time (ម៉ោង ១១:០០ ព្រឹក) សម្រាប់ថ្ងៃដែលចង់ប្ដូរ
        const targetDateStr = new Date(date).toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);

        // បើកែប្រែសម្រាប់ថ្ងៃបច្ចុប្បន្ន (Today)
        if (targetDateStr === todayStr) {
            const currentHour = new Date().getHours(); // ម៉ោងបច្ចុប្បន្ន (0 - 23)
            const cutoffHour = 12; // កំណត់ម៉ោង ១១:០០ ព្រឹក

            if (currentHour >= cutoffHour) {
                return res.status(400).json({
                    error: 'Cut-off time passed! You cannot change your meal status after 11:00 AM. It is locked as EAT.'
                });
            }
        }

        // ពិនិត្យមើលថាតើមាន Record សម្រាប់ថ្ងៃហ្នឹងរួចហើយឬยัง
        const [existing] = await db.pool.query(
            'SELECT id FROM MEAL_STATUS WHERE member_id = ? AND date = ?', [memberId, date]
        );

        if (existing.length > 0) {
            // បើមានហើយ ធ្វើការ Update
            await db.pool.query(
                'UPDATE MEAL_STATUS SET status = ?, confirmation_type = ?, confirmed_at = NOW() WHERE member_id = ? AND date = ?', [status, confirmationType, memberId, date]
            );
            return res.json({ message: 'Meal status updated successfully' });
        } else {
            // បើទាន់មានទេ ធ្វើការ Insert ថ្មី
            const query = `
                INSERT INTO MEAL_STATUS (member_id, date, status, confirmation_type, confirmed_at)
                VALUES (?, ?, ?, ?, NOW())
            `;
            await db.pool.query(query, [memberId, date, status, confirmationType]);
            return res.status(201).json({ message: 'Meal status recorded successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;