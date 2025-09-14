import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration - ATS-Auto-Registerator
const firebaseConfig = {
  apiKey: "AIzaSyCide6yOrsEaRvgYbUzn-ASbJPt8RsiDsA",
  authDomain: "ats-auto-registerator.firebaseapp.com",
  projectId: "ats-auto-registerator",
  storageBucket: "ats-auto-registerator.firebasestorage.app",
  messagingSenderId: "169041577582",
  appId: "1:169041577582:web:62ddda37b2344e5705087f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app; 