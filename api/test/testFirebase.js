require("../src/config/firebase");

const { getApp } = require("firebase-admin/app");
const serviceAccount = require("../firebase-service-account.json");

function testFirebase() {
    try {
        const app = getApp();

        console.log("🔥 Firebase Admin initialized");
        console.log("Firebase project:", serviceAccount.project_id);
        console.log("Firebase app name:", app.name);
        console.log("✅ Firebase Admin test successful");
    } catch (error) {
        console.error("❌ Firebase Admin test failed:");
        console.error(error);
        process.exit(1);
    }
}

testFirebase();