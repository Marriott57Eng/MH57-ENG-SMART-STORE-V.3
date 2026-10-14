import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Safe non-blocking connection check on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      if (db) {
        getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.warn("Please check your Firebase configuration or internet connection.");
          }
        });
      }
    } catch (_) {}
  }, 1000);
}

