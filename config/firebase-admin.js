// config/firebase-admin.js
// Initializes the Firebase Admin SDK for server-side use (Firestore + Auth).
//
// Setup:
// 1. In Firebase Console → Project Settings → Service Accounts → Generate new private key.
// 2. Save the JSON file somewhere OUTSIDE your repo (never commit it), e.g. ./secrets/serviceAccountKey.json
// 3. Set the env var GOOGLE_APPLICATION_CREDENTIALS to its path, OR paste the values into .env
//    and use admin.credential.cert({...}) instead of applicationDefault().

const { initializeApp, getApps, getApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

// firebase-admin v14 uses the modular API. Keeping this small compatibility
// object prevents the controllers from depending on an obsolete Admin SDK API.
const hasInlineServiceAccount = Boolean(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentialValueIsPrivateKey = Boolean(credentialPath && credentialPath.includes('-----BEGIN'));
const hasServiceAccountFile = Boolean(credentialPath && !credentialValueIsPrivateKey && fs.existsSync(credentialPath));
const firebaseConfigured = hasInlineServiceAccount || hasServiceAccountFile;
const firebaseConfigurationError = credentialValueIsPrivateKey
  ? 'GOOGLE_APPLICATION_CREDENTIALS يجب أن يحتوي مسار ملف JSON، وليس نص المفتاح الخاص.'
  : null;

if (credentialValueIsPrivateKey) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'club-54d21';
  // Local development can use either a service-account JSON path in
  // GOOGLE_APPLICATION_CREDENTIALS or the three values below in .env.
  // The JSON key must never be committed to source control.
  const credential = hasInlineServiceAccount
    ? cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
    : applicationDefault();

  initializeApp({
    credential,
    projectId,
  });
}

// Use the configured named database. Without this, the SDK queries
// "(default)" even when the Firebase console database is named "club".
const db = getFirestore(getApp(), process.env.FIREBASE_DATABASE_ID || '(default)');
const auth = getAuth();
const admin = { firestore: { FieldValue } };

module.exports = { admin, db, auth, firebaseConfigured, firebaseConfigurationError };
