import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcc6ANkeJAuUSvedrhuumEog2zI4YPzXc",
  authDomain: "event-management-system-27c89.firebaseapp.com",
  databaseURL: "https://event-management-system-27c89-default-rtdb.firebaseio.com",
  projectId: "event-management-system-27c89",
  storageBucket: "event-management-system-27c89.firebasestorage.app",
  messagingSenderId: "536795248572",
  appId: "1:536795248572:web:320f3d8b0920f7db8a9db9",
  measurementId: "G-0BXTHJD0VP"
};

console.log("🔥 Firebase Config:", {
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey ? "✓ Set" : "✗ Missing",
  authDomain: firebaseConfig.authDomain,
});

// Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
console.log("📱 Firebase App initialized:", app.name || "default");

export const firestore = getFirestore(app);
console.log("🗄️ Firestore initialized");

export default app;
