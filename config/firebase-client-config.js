// config/firebase-client-config.js
// Copy these values into any EJS view that needs Firebase Auth in the browser
// (see views/auth/sign-in.ejs and views/auth/sign-up-success.ejs).
// Find them in: Firebase Console → Project Settings → General → Your apps → SDK setup and configuration.
//
// These values are PUBLIC by design (they identify your project, not secrets) and are safe
// to ship to the browser. Real protection comes from Firestore Security Rules / your backend checks.

const firebaseConfig = {
  apiKey: "AIzaSyCUvapmcqTVqe-L6tfU9jWaPVIVTfkIIbg",
  authDomain: "club-54d21.firebaseapp.com",
  projectId: "club-54d21",
  storageBucket: "club-54d21.firebasestorage.app",
  messagingSenderId: "139667812534",
  appId: "1:139667812534:web:08390b510501dbbbc7b617",
};

// Synthetic email domain: your app logs in with a username, not an email,
// so we turn "ahmed" into "ahmed@handball-app.local" behind the scenes.
const EMAIL_DOMAIN = "handball-app.local";

module.exports = { firebaseConfig, EMAIL_DOMAIN };