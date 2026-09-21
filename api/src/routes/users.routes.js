const express = require('express');
const router = express.Router();
const db = require('../prismaClient');
const { verifyAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Admin update member status
 *     description: Change user status to ACTIVE, INACTIVE, or AWAY.
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - ACTIVE
 *                   - INACTIVE
 *                   - AWAY
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'INACTIVE', 'AWAY'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Use ACTIVE, INACTIVE, or AWAY'
            });
        }

        const userExists = await db.user.findUnique({
            where: {
                id: String(id)
            }
        });

        if (!userExists) {
            return res.status(404).json({
                error: 'Member not found in database'
            });
        }

        const updatedUser = await db.user.update({
            where: {
                id: String(id)
            },
            data: {
                status
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                status: true,
                fcmToken: true,
                joined_at: true,
                inactive_at: true,
                created_at: true,
                updated_at: true
            }
        });

        return res.json({
            message: `Member status updated to ${status} successfully`,
            updatedUser
        });

    } catch (error) {
        console.error('Error updating user status:', error);

        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});


/**
 * @swagger
 * /api/v1/users/{id}/fcm-token:
 *   patch:
 *     summary: Save FCM token
 *     description: Save the Firebase Cloud Messaging token for a user's browser.
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
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 example: "FCM_TOKEN"
 *     responses:
 *       200:
 *         description: FCM token saved successfully
 */
router.patch('/:id/fcm-token', async (req, res) => {
    try {
        const { id } = req.params;
        const { fcmToken } = req.body;

        if (!fcmToken || typeof fcmToken !== 'string') {
            return res.status(400).json({
                error: 'FCM token is required'
            });
        }

        const userId = BigInt(id);

        const userExists = await db.user.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                username: true,
                status: true,
                fcmToken: true
            }
        });

        if (!userExists) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        console.log('FCM update:', {
            userId: userExists.id.toString(),
            username: userExists.username,
            currentStatus: userExists.status
        });

        const updatedUser = await db.user.update({
            where: {
                id: userId
            },
            data: {
                fcmToken: fcmToken
            },
            select: {
                id: true,
                username: true,
                status: true,
                fcmToken: true
            }
        });

        res.json({
            message: 'FCM token saved successfully',
            user: {
                ...updatedUser,
                id: updatedUser.id.toString()
            }
        });

    } catch (error) {
        console.error('Error saving FCM token:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});


module.exports = router;