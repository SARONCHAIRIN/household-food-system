import { initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export async function getFCMToken(): Promise<string | null> {
  try {
    if (!("Notification" in window)) {
      throw new Error("Browser does not support notifications");
    }

    if (!("serviceWorker" in navigator)) {
      throw new Error("Browser does not support Service Workers");
    }

    const supported = await isSupported();

    if (!supported) {
      throw new Error("Firebase Messaging is not supported");
    }

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== "granted") {
      throw new Error("Notification permission was not granted");
    }

    const registration =
      await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("🔥 FCM Token:", token);

    return token || null;
  } catch (error) {
    console.error("❌ FCM Token Error:", error);
    return null;
  }
}