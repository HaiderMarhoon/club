// middleware/attach-user.js
// Mount GLOBALLY in app.js, after cookie-parser (session/flash order doesn't matter for this one).
// This only resolves *who* is logged in via the Firebase session cookie set by
// POST /auth/session-login. It intentionally does NOT touch req.session, so it
// won't interfere with express-session/express-flash, which are still used for
// flash messages only.

const { auth, db } = require('../config/firebase-admin');
const { docToObject } = require('../config/firestore-helpers');

module.exports = async function attachUser(req, res, next) {
  const sessionCookie = req.cookies?.session;
  req.user = null;

  if (sessionCookie) {
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie, true);
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (userDoc.exists) {
        req.user = { uid: decoded.uid, ...docToObject(userDoc) };
      } else {
        res.clearCookie('session');
      }
    } catch (err) {
      res.clearCookie('session');
    }
  }

  console.log('attach-user result:', req.user); // TEMP — remove after debugging
  next();
};
