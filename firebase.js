import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAHJ_U7_H7rO1CLDEmgYm2bY-956R2B3jI",
  authDomain: "karting-competitie.firebaseapp.com",
  databaseURL: "https://karting-competitie-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "karting-competitie",
  storageBucket: "karting-competitie.firebasestorage.app",
  messagingSenderId: "915335846004",
  appId: "1:915335846004:web:5fbc6592f60a93a9031921"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db, ref, push, set, remove, onValue, get, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };
