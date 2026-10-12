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

router.get('/dashboard', isAdmin, (req, res) => res.redirect('/#accounts'));

router.get('/players', isAdmin, async (req, res, next) => {
  try {
    const { players, users } = await require('../services/admin-accounts')();

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
    const { password, role = 'admin' } = req.body;
    const username = String(req.body.username || '').trim().toLowerCase();
    validateCredentials(username, password);

    if (!username || !password || !['admin', 'coach'].includes(role)) {
      req.flash('error', 'جميع الحقول مطلوبة');
      return res.status(400).render('admin/addAdmin', { formData: req.body, title: 'إضافة مسؤول', messages: req.flash() });
    }

    const existing = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      req.flash('error', 'اسم المستخدم موجود بالفعل');
      return res.status(400).render('admin/addAdmin', { formData: req.body, title: 'إضافة مسؤول', messages: req.flash() });
    }

    const userRecord = await createAccount({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      displayName: username,
    });

    const isAdminUser = role === 'admin';


    await finishAccount(userRecord.uid, {
      username,
      isAdmin: isAdminUser,
      isCoach: role === 'coach',
      isPlayer: null,
      isView: false,
      createdAt: new Date(),
    });

    req.flash('success', 'تم إضافة المسؤول بنجاح');
    res.redirect('/#accounts');
  } catch (err) {
    req.flash('error', accountError(err));
    res.redirect('/admin/add-admin');
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
    const { password, playerId } = req.body;
    const username = String(req.body.username || '').trim().toLowerCase();
    validateCredentials(username, password);

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

    const userRecord = await createAccount({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      displayName: username,
    });



    await finishAccount(userRecord.uid, {
      username,
      isAdmin: false,
      isPlayer: playerId,
      isView: false,
      createdAt: new Date(),
    });

    req.flash('success', 'تم إنشاء حساب اللاعب بنجاح');
    res.redirect('/#accounts');
  } catch (err) {
    res.status(400).render('admin/createPlayerAccount', { title: 'إنشاء حساب لاعب', players: await reloadPlayers(), error: accountError(err), formData: { username: req.body.username, playerId: req.body.playerId } });
  }
});

function validateCredentials(username, password) {
  if (!username || /[\s@]/.test(username)) throw new Error('اسم المستخدم مطلوب ولا يقبل مسافات أو @');
  if (typeof password !== 'string' || password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
}
function accountError(err) {
  return ({ 'auth/email-already-exists': 'اسم المستخدم موجود بالفعل', 'auth/invalid-email': 'اسم المستخدم غير صالح', 'auth/invalid-password': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })[err.code] || (err.code ? 'تعذر حفظ الحساب. تحقق من إعدادات Firebase وحاول مجددًا.' : err.message);
}
async function createAccount(data) { return auth.createUser(data); }
async function finishAccount(uid, data) {
  try {
    await auth.setCustomUserClaims(uid, { isAdmin: !!data.isAdmin, isCoach: !!data.isCoach, isPlayer: data.isPlayer || null, isView: !!data.isView });
    await db.collection('users').doc(uid).set(data);
  } catch (err) { await auth.deleteUser(uid).catch(() => {}); throw err; }
}
router.get('/accounts/:id/edit', isAdmin, async (req,res,next) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('الحساب غير موجود');
    res.render('admin/editAccount', { title: 'تعديل الحساب', account: { ...doc.data(), _id: doc.id }, players: await loadPlayersForAccountForm(), error: null });
  } catch(err) { next(err); }
});
router.post('/accounts/:id/edit', isAdmin, async (req,res,next) => {
  const ref = db.collection('users').doc(req.params.id);
  try {
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('الحساب غير موجود');
    const playerId = String(req.body.playerId || '');
    const password = req.body.password;
    if (password) validateCredentials(doc.data().username, password);
    if (playerId) {
      if (!(await db.collection('players').doc(playerId).get()).exists) throw new Error('اللاعب غير موجود');
      const linked = await db.collection('users').where('isPlayer', '==', playerId).get();
      if (linked.docs.some(d => d.id !== doc.id)) throw new Error('اللاعب مرتبط بحساب آخر');
    }
    const data = doc.data();
    const authUser = await auth.getUser(doc.id);
    await auth.setCustomUserClaims(doc.id, { ...authUser.customClaims, isPlayer: playerId || null });
    try { await ref.update({ isPlayer: playerId || null }); }
    catch(err) { await auth.setCustomUserClaims(doc.id, authUser.customClaims || {}); throw err; }
    if (password) { await auth.updateUser(doc.id, { password }); await auth.revokeRefreshTokens(doc.id); }
    req.flash('success', 'تم حفظ الحساب بنجاح');
    res.redirect('/#accounts');
  } catch(err) {
    const doc = await ref.get();
    if (!doc.exists) return next(err);
    res.status(400).render('admin/editAccount', { title: 'تعديل الحساب', account: { ...doc.data(), _id: doc.id }, players: await loadPlayersForAccountForm(), error: accountError(err) });
  }
});
module.exports = router;
