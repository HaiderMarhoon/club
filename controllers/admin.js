const express = require('express');
const router = express.Router();
const { db, auth } = require('../config/firebase-admin');
const { EMAIL_DOMAIN } = require('../config/firebase-client-config');
const isAdmin = require('../middleware/is-admin');

const categoryNames = { under14: 'تجمع (تحت 14)', under16: 'أشبال (تحت 16)', under18: 'ناشئين (تحت 18)', under20: 'تحت 20 سنة', man: 'الرجال' };

async function loadPlayersForAccountForm() {
  const [playersSnap, usersSnap] = await Promise.all([db.collection('players').get(), db.collection('users').get()]);
  const linkedPlayerIds = new Set(usersSnap.docs.map(doc => doc.data().isPlayer).filter(Boolean));
  return playersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      _id: doc.id,
      name: String(data.name || '').trim() || `لاعب بدون اسم (${doc.id.slice(0, 6)})`,
      categoryName: categoryNames[data.category] || data.category || 'فئة غير محددة',
      shirtNumber: data.shirtNumber || '',
      hasAccount: linkedPlayerIds.has(doc.id),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

router.get('/players', isAdmin, async (req, res, next) => {
  try {
    const playersSnap = await db.collection('players').get();
    const players = playersSnap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() }));

    // Firestore has no populate(); fetch users, then resolve each linked player manually.
    const usersSnap = await db.collection('users').get();
    const users = await Promise.all(
      usersSnap.docs
        .filter(d => d.data().isPlayer)
        .map(async d => {
          const data = d.data();
          const playerDoc = await db.collection('players').doc(data.isPlayer).get();
          return {
            _id: d.id,
            username: data.username,
            // Firestore returns a Timestamp here, not a JS Date — .toDate()
            // converts it so the view's .toLocaleDateString() call works.
            createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate()
              : data.createdAt,
            isPlayer: playerDoc.exists ? { _id: playerDoc.id, ...playerDoc.data() } : null,
          };
        })
    );

    res.render('admin/players-list', {
      title: 'قائمة اللاعبين',
      players,
      users,
      messages: req.flash(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/add-admin', isAdmin, (req, res) => {
  res.render('admin/addAdmin', { title: 'إضافة مسؤول', messages: req.flash() });
});

router.post('/add-admin', isAdmin, async (req, res, next) => {
  try {
    const { username, password, role = 'admin' } = req.body;

    if (!username || !password || !['admin', 'coach'].includes(role)) {
      req.flash('error', 'جميع الحقول مطلوبة');
      return res.status(400).render('admin/addAdmin', { formData: req.body, title: 'إضافة مسؤول', messages: req.flash() });
    }

    const existing = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      req.flash('error', 'اسم المستخدم موجود بالفعل');
      return res.status(400).render('admin/addAdmin', { formData: req.body, title: 'إضافة مسؤول', messages: req.flash() });
    }

    const userRecord = await auth.createUser({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      displayName: username,
    });

    const isAdminUser = role === 'admin';
    await auth.setCustomUserClaims(userRecord.uid, isAdminUser ? { isAdmin: true } : { isCoach: true });

    await db.collection('users').doc(userRecord.uid).set({
      username,
      isAdmin: isAdminUser,
      isCoach: role === 'coach',
      isPlayer: null,
      isView: false,
      createdAt: new Date(),
    });

    req.flash('success', 'تم إضافة المسؤول بنجاح');
    res.redirect('/admin/players');
  } catch (err) {
    next(err);
  }
});

router.get('/create-player-account', isAdmin, async (req, res, next) => {
  try {
    const players = await loadPlayersForAccountForm();
    res.render('admin/createPlayerAccount', { players, title: 'إنشاء حساب لاعب' });
  } catch (err) {
    next(err);
  }
});

router.post('/create-player-account', isAdmin, async (req, res, next) => {
  const reloadPlayers = async () => {
    return loadPlayersForAccountForm();
  };

  try {
    const { username, password, playerId } = req.body;

    if (!username || !password || !playerId) {
      return res.status(400).render('admin/createPlayerAccount', {
        players: await reloadPlayers(),
        error: 'جميع الحقول مطلوبة',
        formData: req.body,
      });
    }

    const existing = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      return res.status(400).render('admin/createPlayerAccount', {
        players: await reloadPlayers(),
        error: 'اسم المستخدم موجود بالفعل',
        formData: req.body,
      });
    }

    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) {
      return res.status(400).render('admin/createPlayerAccount', {
        players: await reloadPlayers(),
        error: 'اللاعب المحدد غير صحيح',
        formData: req.body,
      });
    }

    const linkedAccount = await db.collection('users').where('isPlayer', '==', playerId).limit(1).get();
    if (!linkedAccount.empty) {
      return res.status(400).render('admin/createPlayerAccount', {
        players: await reloadPlayers(), error: 'هذا اللاعب مرتبط بحساب بالفعل', formData: req.body,
      });
    }

    const userRecord = await auth.createUser({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      displayName: username,
    });

    await auth.setCustomUserClaims(userRecord.uid, { isPlayer: playerId });

    await db.collection('users').doc(userRecord.uid).set({
      username,
      isAdmin: false,
      isPlayer: playerId,
      isView: false,
      createdAt: new Date(),
    });

    req.flash('success', 'تم إنشاء حساب اللاعب بنجاح');
    res.redirect('/admin/players');
  } catch (err) {
    console.error('Error in user creation:', err);
    next(err);
  }
});

module.exports = router;
