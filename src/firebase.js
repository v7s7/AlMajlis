// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBte0xZFABcJAzBaxu9CThKsGRzkkLoHSQ",
  authDomain: "al-majlis-be85c.firebaseapp.com",
  projectId: "al-majlis-be85c",
  appId: "1:687312358649:web:c443e20ceb893f0d93e628"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// No Storage export
