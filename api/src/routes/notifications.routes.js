const express = require("express");
const router = express.Router();

const db = require("../prismaClient");
require("../config/firebase");

const { getMessaging } = require("firebase-admin/messaging");
/**
 * @swagger
 * /api/v1/notifications/test:
 *   post:
 *     summary: Send test FCM notification
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "31"
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to send notification
 */

router.post("/test", async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: "userId is required",
            });
        }

        const id = BigInt(userId);

        // Get only the FCM token we need
        const result = await db.pool.query(
            `
      SELECT id, username, "fcmToken"
      FROM "USERS"
      WHERE id = $1
      LIMIT 1
      `,
            [id.toString()]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                error: "User not found",
            });
        }

        if (!user.fcmToken) {
            return res.status(400).json({
                error: "User does not have an FCM token",
            });
        }

        const message = {
            token: user.fcmToken,

            notification: {
                title: "🍽️ Test Notification",
                body: "Backend → Firebase Admin → Browser ដំណើរការហើយ!",
            },

            data: {
                type: "TEST_NOTIFICATION",
                screen: "meals",
            },

            webpush: {
                notification: {
                    icon: "/favicon.ico",
                },
            },
        };

        const firebaseMessageId = await getMessaging().send(message);

        console.log(
            `✅ FCM sent successfully to user ${user.id}`
        );

        res.json({
            message: "Notification sent successfully",
            userId: user.id.toString(),
            firebaseMessageId,
        });
    } catch (error) {
        console.error("FCM TEST ERROR:", error);

        res.status(500).json({
            error: "Failed to send notification",
            message: error.message,
        });
    }
});

module.exports = router;