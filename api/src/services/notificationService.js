const admin = require("../config/firebase");

async function sendPushNotification({
    token,
    title,
    body,
    data = {},
}) {
    if (!token) {
        throw new Error("FCM token is required");
    }

    const stringData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
            key,
            String(value),
        ])
    );

    const message = {
        token,

        notification: {
            title,
            body,
        },

        data: stringData,
    };

    const response = await admin.messaging().send(message);

    console.log("FCM notification sent:", response);

    return response;
}

module.exports = {
    sendPushNotification,
};