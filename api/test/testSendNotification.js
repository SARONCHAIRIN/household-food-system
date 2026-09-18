const admin = require("../src/config/firebase");
const { getMessaging } = require("firebase-admin/messaging");

async function testSendNotification() {
    const token = "f-JjJrdr2LgqLY3DjXSPDw:APA91bErnBbVDltakMzZi0G_KYqgt_CkFLP1O7A6QLMflPLZVcldatBFB__5BaRLrxCbRZ3X0rN3OBIEt3_OuVKymQdZ-pDt8pTlgkmD1XnheKH7X_gM2Hk";

    const message = {
        token: token,

        notification: {
            title: "Household Food",
            body: "Hello! This is a test notification 🔔",
        },

        data: {
            screen: "meals",
            type: "test",
            id: "123",
        },
    };

    try {
        const response = await getMessaging().send(message);

        console.log("✅ Notification sent successfully!");
        console.log("Firebase message ID:", response);
    } catch (error) {
        console.error("❌ Notification failed:");
        console.error(error);
    }
}

testSendNotification();