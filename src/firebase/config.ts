import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration - weekly-brief-2025
const firebaseConfig = {
  apiKey: "AIzaSyDJ5oCi5ylGIfkCS_RvE7FeQNaTQBvGhIQ",
  authDomain: "weekly-brief-2025.firebaseapp.com",
  projectId: "weekly-brief-2025",
  storageBucket: "weekly-brief-2025.firebasestorage.app",
  messagingSenderId: "487940577484",
  appId: "1:487940577484:web:1d6262da34bd9bb98bca69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app; 