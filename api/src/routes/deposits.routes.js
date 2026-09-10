const express = require('express');
const router = express.Router();
const db = require('../prismaClient'); // ប្រើប្រាស់ db client របស់អ្នក
const { verifyAdmin, verifyToken } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/admin/deposits:
 *   post:
 *     summary: Admin inputs deposit for a member
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - userId
 *                 - amount
 *               properties:
 *                 userId:
 *                   type: string
 *                   example: "3"
 *                 amount:
 *                   type: number
 *                   example: 25.00
 *                 note:
 *                   type: string
 *                   example: "Cash deposit given to admin for monthly food"
 *     responses:
 *       201:
 *         description: Deposit added successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Member not found
 */
// POST /api/v1/admin/deposits - Admin បញ្ចូលប្រាក់កក់ឱ្យសមាជិក
router.post('/admin/deposits', verifyAdmin, async(req, res) => {
    try {
        const { userId, amount, note } = req.body;

        // ១. ពិនិត្យទិន្នន័យចាំបាច់
        if (!userId || amount === undefined || amount === null) {
            return res.status(400).json({ error: 'User ID and amount are required' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a valid positive number' });
        }

        // ២. ពិនិត្យមើលថាតើសមាជិកនោះមានក្នុង Database ឬអត់
        const targetUser = await db.user.findFirst ?
            await db.user.findFirst({ where: { id: userId } }) :
            await db.pool.query('SELECT * FROM "USERS" WHERE id = $1', [userId]).then(r => r.rows[0]);

        if (!targetUser) {
            return res.status(404).json({ error: 'Member not found in database' });
        }

        // ៣. បញ្ចូលប្រាក់កក់ចូលទៅក្នុង Table member_deposits
        const insertQuery = `
            INSERT INTO member_deposits (id, user_id, amount, type, note, created_at)
            VALUES (gen_random_uuid(), $1, $2, 'DEPOSIT', $3, NOW())
            RETURNING *;
        `;

        const result = await db.pool.query(insertQuery, [userId, parsedAmount, note || 'Admin manual deposit']);
        const newDeposit = result.rows[0];

        res.status(201).json({
            message: 'Deposit added successfully by admin',
            deposit: {
                id: newDeposit.id,
                userId: newDeposit.user_id.toString(),
                amount: parseFloat(newDeposit.amount),
                type: newDeposit.type,
                note: newDeposit.note,
                createdAt: newDeposit.created_at
            }
        });

    } catch (error) {
        console.error("Error adding member deposit:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});


/**
 * @swagger
 * /api/v1/deposits/balance:
 *   get:
 *     summary: Get current deposit balance and transaction history
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional for Admin to check a specific member's balance
 *     responses:
 *       200:
 *         description: Balance and history retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// GET /api/v1/deposits/balance - មើលសមតុល្យប្រាក់កក់ និងប្រវត្តិប្រតិបត្តិការ
router.get('/deposits/balance', verifyToken, async(req, res) => {
    try {
        let targetUserId = req.user.id;

        // ប្រសិនបើជា Admin ហើយចង់ឆែកឱ្យ User ផ្សេង អាចផ្ញើ query ?userId=xxx មកបាន
        if (req.user.role === 'ADMIN' && req.query.userId) {
            targetUserId = req.query.userId;
        }

        // ១. ទាញយកប្រវត្តិប្រតិបត្តិការទាំងអស់របស់ User នោះ
        const historyQuery = `
            SELECT id, user_id, amount, type, note, created_at
            FROM member_deposits
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const historyResult = await db.pool.query(historyQuery, [targetUserId]);
        const deposits = historyResult.rows;

        // ២. គណនាសមតុល្យសរុប (Balance = Sum of Deposits - Sum of Deductions)
        let totalBalance = 0;
        deposits.forEach(item => {
            const amt = parseFloat(item.amount);
            if (item.type === 'DEPOSIT') {
                totalBalance += amt;
            } else if (item.type === 'DEDUCTION') {
                totalBalance -= amt;
            }
        });

        res.status(200).json({
            userId: targetUserId.toString(),
            balance: parseFloat(totalBalance.toFixed(2)),
            totalTransactions: deposits.length,
            history: deposits.map(d => ({
                id: d.id,
                amount: parseFloat(d.amount),
                type: d.type,
                note: d.note,
                createdAt: d.created_at
            }))
        });

    } catch (error) {
        console.error("Error fetching deposit balance:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

module.exports = router;