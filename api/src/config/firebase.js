const {
    initializeApp,
    getApps,
    cert,
} = require("firebase-admin/app");

const fs = require("fs");
const path = require("path");

function loadServiceAccount() {
    const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // Production: Read from Environment Variable
    if (credentials) {
        try {
            return JSON.parse(credentials);
        } catch (error) {
            throw new Error(
                "Invalid FIREBASE_SERVICE_ACCOUNT_JSON format"
            );
        }
    }

    // Local: Read from JSON File
    const filePath = path.join(
        __dirname,
        "../../firebase-service-account.json"
    );

    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    throw new Error(
        "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON."
    );
}

const firebaseApp =
    getApps().length === 0
        ? initializeApp({
            credential: cert(loadServiceAccount()),
        })
        : getApps()[0];

console.log("🔥 Firebase Admin initialized");

module.exports = firebaseApp;