const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

function getServiceAccount() {
    const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // Production: Read credentials from Render Environment
    if (credentials) {
        try {
            return JSON.parse(credentials);
        } catch {
            throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
        }
    }

    // Local Development: Read credentials from JSON file
    const filePath = path.resolve(
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

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(getServiceAccount()),
    });
}

module.exports = admin;