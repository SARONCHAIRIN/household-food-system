const express = require('express');
const router = express.Router();

const db = require('../prismaClient');
const { verifyAdmin } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User and member management
 */


/**
 * =========================================================
 * PATCH /api/v1/users/{id}/status
 * Admin update member status
 * =========================================================
 */

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Admin update member status
 *     description: Change user status to ACTIVE, INACTIVE, or AWAY.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "29"
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
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Member not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/status', verifyAdmin, async (req, res) => {
    try {
        // Prisma User.id is BigInt
        const userId = BigInt(req.params.id);

        const { status } = req.body;

        // Validate status
        if (!['ACTIVE', 'INACTIVE', 'AWAY'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Use ACTIVE, INACTIVE, or AWAY'
            });
        }

        // Check user exists
        const userExists = await db.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!userExists) {
            return res.status(404).json({
                error: 'Member not found in database'
            });
        }

        console.log('Status update:', {
            userId: userId.toString(),
            username: userExists.username,
            oldStatus: userExists.status,
            newStatus: status
        });

        // Update status
        const updatedUser = await db.user.update({
            where: {
                id: userId
            },
            data: {
                status: status
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                status: true,
                fcmToken: true,
                joinedAt: true,
                inactiveAt: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.json({
            message: `Member status updated to ${status} successfully`,
            updatedUser: {
                ...updatedUser,
                id: updatedUser.id.toString()
            }
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
 * =========================================================
 * PATCH /api/v1/users/{id}/fcm-token
 * Save FCM token
 * =========================================================
 */

/**
 * @swagger
 * /api/v1/users/{id}/fcm-token:
 *   patch:
 *     summary: Save FCM token
 *     description: Save the Firebase Cloud Messaging token for a user's browser.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "29"
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
 *       400:
 *         description: FCM token is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/fcm-token', async (req, res) => {
    try {
        // Prisma User.id is BigInt
        const userId = BigInt(req.params.id);

        const { fcmToken } = req.body;

        // Validate FCM token
        if (!fcmToken || typeof fcmToken !== 'string') {
            return res.status(400).json({
                error: 'FCM token is required'
            });
        }

        // Remove unnecessary spaces
        const cleanToken = fcmToken.trim();

        if (!cleanToken) {
            return res.status(400).json({
                error: 'FCM token cannot be empty'
            });
        }

        // Check user exists
        const user = await db.user.findUnique({
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

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        console.log('========================================');
        console.log('FCM TOKEN UPDATE');
        console.log('========================================');
        console.log('User ID:', user.id.toString());
        console.log('Username:', user.username);
        console.log('Current status:', user.status);
        console.log('Has old FCM token:', Boolean(user.fcmToken));
        console.log('New FCM token received:', Boolean(cleanToken));
        console.log('========================================');

        // Save FCM token only
        const updatedUser = await db.user.update({
            where: {
                id: userId
            },
            data: {
                fcmToken: cleanToken
            },
            select: {
                id: true,
                username: true,
                status: true,
                fcmToken: true
            }
        });

        console.log('FCM token saved successfully for user:', userId.toString());

        return res.json({
            message: 'FCM token saved successfully',
            user: {
                ...updatedUser,
                id: updatedUser.id.toString()
            }
        });

    } catch (error) {
        console.error('========================================');
        console.error('ERROR SAVING FCM TOKEN');
        console.error('========================================');
        console.error(error);
        console.error('========================================');

        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});


module.exports = router;