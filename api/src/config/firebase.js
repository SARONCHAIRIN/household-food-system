// import { initializeApp } from "firebase/app";
// import {
//     getMessaging,
//     getToken,
//     onMessage,
// } from "firebase/messaging";

// const firebaseConfig = {
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//     appId: import.meta.env.VITE_FIREBASE_APP_ID,
// };

// const app = initializeApp(firebaseConfig);

// export const messaging = getMessaging(app);

// export async function requestNotificationPermission(): Promise < string > {
//     if (!("Notification" in window)) {
//         throw new Error("This browser does not support notifications.");
//     }

//     if (!("serviceWorker" in navigator)) {
//         throw new Error("This browser does not support Service Workers.");
//     }

//     const permission = await Notification.requestPermission();

//     console.log("Notification permission:", permission);

//     if (permission !== "granted") {
//         throw new Error("Notification permission was not granted.");
//     }

//     const registration = await navigator.serviceWorker.register(
//         "/firebase-messaging-sw.js"
//     );

//     console.log(
//         "Firebase Messaging Service Worker registered:",
//         registration
//     );

//     const token = await getToken(messaging, {
//         vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
//         serviceWorkerRegistration: registration,
//     });

//     if (!token) {
//         throw new Error("FCM token was not generated.");
//     }

//     console.log("FCM Web Token:", token);

//     return token;
// }

// export function listenForForegroundMessages() {
//     onMessage(messaging, (payload) => {
//         console.log("Foreground notification:", payload);

//         const title =
//             payload.notification ? .title ? ? "Household Food";

//         const body =
//             payload.notification ? .body ? ? "";

//         if (Notification.permission === "granted") {
//             new Notification(title, {
//                 body,
//             });
//         }
//     });
// }

const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(
    path.join(
        __dirname,
        "../../../firebase-service-account.json"
    )
);

if (admin.getApps().length === 0) {
    admin.initializeApp({
        credential: admin.cert(serviceAccount),
    });
}

module.exports = admin;