const express = require('express');
const router = express.Router();
const db = require('../prismaClient'); // ប្រើប្រាស់ db ជំនួសឱ្យ prisma
const { verifyAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Admin update member status
 *     description: Change user status to ACTIVE, INACTIVE, or AWAY when they are away.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, AWAY]
 *                 example: "AWAY"
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status', verifyAdmin, async(req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'INACTIVE', 'AWAY'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use ACTIVE, INACTIVE, or AWAY' });
        }

        // ប្រើ db.user ជំនួស prisma.user
        const userExists = await db.user.findUnique({
            where: { id: String(id) }
        });

        if (!userExists) {
            return res.status(404).json({ error: 'Member not found in database' });
        }

        const updatedUser = await db.user.update({
            where: { id: String(id) },
            data: { status: status },
        });

        res.json({ message: `Member status updated to ${status} successfully`, updatedUser });
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

module.exports = router;

module.exports = router;