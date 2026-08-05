const express = require('express');
const router = express.Router();
const { db, auth, firebaseConfigured, firebaseConfigurationError } = require('../config/firebase-admin');
const { EMAIL_DOMAIN } = require('../config/firebase-client-config');

router.get('/', (req, res) => {
  res.render('home.ejs', { user: req.user, currentPlayer: res.locals.currentPlayer });
});

// SIGN UP VIEW
router.get('/sign-up', (req, res) => {
  res.render('auth/sign-up.ejs');
});

// POST - CREATE NEW USER (SIGN UP)
// Creates the account server-side via the Admin SDK, then hands the browser a page
// that signs the user in with the Firebase client SDK and opens a session.
router.post('/sign-up', async (req, res) => {
  try {
    if (!firebaseConfigured) {
      console.error('Firebase server credentials are missing. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
      return res.status(503).render('error', {
        title: 'إعداد Firebase غير مكتمل',
        error: { status: 503, message: firebaseConfigurationError || 'لا يمكن إنشاء الحساب قبل إضافة بيانات حساب خدمة Firebase في ملف .env.' },
      });
    }
    const { username, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.send('كلمة المرور غير متطابقة');
    }

    const existing = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      return res.send('اسم المستخدم موجود بالفعل');
    }

    const userRecord = await auth.createUser({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      displayName: username,
    });

    await db.collection('users').doc(userRecord.uid).set({
      username,
      isAdmin: false,
      isPlayer: null,
      isView: false,
      createdAt: new Date(),
    });

    // Renders a page that auto-signs-in with Firebase client SDK, then redirects to '/'
    res.render('auth/sign-up-success.ejs', { username, password });
  } catch (error) {
    console.error('Sign-up error:', error);
    if (error.code === 5 || error.code === 'NOT_FOUND') {
      return res.status(503).render('error', {
        title: 'قاعدة Firestore غير متاحة',
        error: {
          status: 503,
          message: 'لم يتم العثور على قاعدة Firestore للمشروع. أنشئ Cloud Firestore (وضع Native) في Firebase Console، وتأكد أن بيانات حساب الخدمة تخص المشروع نفسه.',
        },
      });
    }
    if (error.code === 'auth/configuration-not-found') {
      return res.status(503).render('error', {
        title: 'Firebase Authentication غير مفعّل',
        error: {
          status: 503,
          message: 'فعّل Firebase Authentication ثم مزوّد البريد الإلكتروني/كلمة المرور في المشروع نفسه الذي تستخدمه بيانات حساب الخدمة.',
        },
      });
    }
    if (error.code === 'auth/email-already-exists') {
      return res.send('اسم المستخدم موجود بالفعل');
    }
    if (error.code === 'auth/invalid-password') {
      return res.send('كلمة المرور يجب أن تتكون من 6 أحرف على الأقل');
    }
    res.send('حدث خطأ أثناء إنشاء الحساب');
  }
});

// SIGN IN VIEW
// Actual sign-in happens client-side with the Firebase SDK (see views/auth/sign-in.ejs),
// which then POSTs the resulting ID token to /auth/session-login below.
router.get('/sign-in', (req, res) => {
  res.render('auth/sign-in.ejs');
});

// Exchanges a verified Firebase ID token for a server session cookie
router.post('/session-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'رمز الدخول مفقود' });
    }

    // Verify freshness before minting a session cookie
    const decodedToken = await auth.verifyIdToken(idToken);

    // Accounts may have been created directly in Firebase Authentication
    // before this application was connected to Firestore. Create their
    // read-only application profile on first sign-in so attach-user can
    // recognise them instead of treating them as a visitor.
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      const username = decodedToken.name || (decodedToken.email || '').split('@')[0] || 'user';
      await userRef.set({
        username,
        isAdmin: false,
        isCoach: false,
        isPlayer: null,
        isView: true,
        createdAt: new Date(),
      });
    }

    const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    res.cookie('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Session login failed:', err);
    res.status(401).json({ success: false, message: 'فشل تسجيل الدخول' });
  }
});

// SIGN OUT
router.get('/sign-out', async (req, res) => {
  const sessionCookie = req.cookies?.session;
  res.clearCookie('session');

  if (sessionCookie) {
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie);
      await auth.revokeRefreshTokens(decoded.sub);
    } catch (err) {
      // cookie was already invalid — nothing to revoke
    }
  }

  res.redirect('/');
});

module.exports = router;
