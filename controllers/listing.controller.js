const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase-admin');
const requireSignedIn = require('../middleware/require-signed-in');
const isAdmin = require('../middleware/is-admin');

function getCategoryName(category) {
  const names = {
    under14: 'تجمع (Under 14)',
    under16: 'أشبال (Under 16)',
    under18: 'ناشئين (Under 18)',
    under20: 'تحت 20 سنة (Under 20)',
    man: 'الرجال',
  };
  return names[category] || category;
}

// Safely converts a Firestore Timestamp, JS Date, string, number, or
// missing/null value into a real JS Date object (or null if it can't be
// parsed at all). Same helper used in controllers/attendance.js — keep
// them in sync, or better, move this into a shared utils file.
function toJSDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

router.get('/', (req, res) => {
  res.render('index.ejs', { user: req.user, currentPlayer: res.locals.currentPlayer });
});

router.get('/new', requireSignedIn, (req, res) => {
  res.render('listings/new', {
    title: 'إضافة لاعب جديد',
    categories: ['under14', 'under16', 'under18'],
  });
});

router.post('/', requireSignedIn, async (req, res) => {
  try {
    const playerData = {
  name: req.body.name,
  category: req.body.category,
  height: req.body.height ? Number(req.body.height) : null,
  weight: req.body.weight ? Number(req.body.weight) : null,
  phoneNumber: req.body.phoneNumber || null,
  shirtNumber: req.body.shirtNumber ? Number(req.body.shirtNumber) : null,
  sportsTests: req.body.sportsTests ? JSON.parse(req.body.sportsTests) : [],
  createdAt: new Date(),
};

    await db.collection('players').add(playerData);
    req.flash('success', 'تم إضافة اللاعب بنجاح');
    res.redirect(`/listings/${playerData.category}`);
  } catch (error) {
    console.error('Error saving player:', error);
    req.flash('error', 'فشل في حفظ اللاعب: ' + error.message);
    res.redirect('/listings/new');
  }
});

router.get('/view', requireSignedIn, (req, res) => {
  res.render('listings/view', { categories: ['under14', 'under16', 'under18'] });
});

router.get('/:category', requireSignedIn, async (req, res) => {
  try {
    const category = req.params.category;
    // Requires a composite index (category ASC, name ASC) — Firestore will
    // print a direct console link to create it the first time this runs.
    const playersSnap = await db.collection('players').where('category', '==', category).orderBy('name').get();
    const players = playersSnap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() }));

    const playersWithAttendance = await Promise.all(
      players.map(async player => {
        const attSnap = await db.collection('attendance').where('player', '==', player.id).get();
        const records = attSnap.docs.map(d => d.data());
        return {
          ...player,
          presentCount: records.filter(a => a.status === 'present').length,
          lateCount: records.filter(a => a.status === 'late').length,
          absentCount: records.filter(a => a.status === 'absent').length,
          totalRecords: records.length,
        };
      })
    );

    res.render('listings/category', {
      category,
      players: playersWithAttendance,
      categoryName: getCategoryName(category),
    });
  } catch (error) {
    console.error('Error loading players by category:', error);
    req.flash('error', 'فشل في تحميل اللاعبين');
    res.redirect('/listings');
  }
});

router.get('/profile/:id', requireSignedIn, async (req, res) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.id).get();
    if (!playerDoc.exists) {
      req.flash('error', 'اللاعب غير موجود');
      return res.redirect('/listings');
    }
    const playerData = playerDoc.data();

    // sportsTests is an array field on the player doc — each entry's `date`
    // may be a Firestore Timestamp, a plain string, or missing, depending
    // on when/how it was written. Normalize it the same way as attendance dates.
    const sportsTests = (playerData.sportsTests || []).map(test => ({
      ...test,
      date: toJSDate(test.date),
    }));

    const player = { _id: playerDoc.id, id: playerDoc.id, ...playerData, sportsTests };

    // Requires a composite index (player ASC, date DESC)
    const attSnap = await db.collection('attendance')
      .where('player', '==', player.id)
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    const attendanceRecords = attSnap.docs.map(d => {
      const data = d.data();
      return { _id: d.id, id: d.id, ...data, date: toJSDate(data.date) };
    });

    res.render('listings/profile', {
      player,
      attendanceRecords,
      categoryName: getCategoryName(player.category),
    });
  } catch (error) {
    console.error('Error loading player profile:', error);
    req.flash('error', 'فشل في تحميل الملف الشخصي');
    res.redirect('/listings');
  }
});

router.get('/:id/edit', requireSignedIn, async (req, res) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.id).get();
    if (!playerDoc.exists) {
      req.flash('error', 'اللاعب غير موجود');
      return res.redirect('/listings');
    }
    res.render('listings/edit', {
      player: { _id: playerDoc.id, id: playerDoc.id, ...playerDoc.data() },
      categories: ['under14', 'under16', 'under18', 'under20', 'man'],
    });
  } catch (error) {
    console.error('Error loading player for edit:', error);
    req.flash('error', 'خطأ في تحميل بيانات اللاعب للتعديل');
    res.redirect('/listings');
  }
});

router.put('/:id', requireSignedIn, async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      category: req.body.category,
      height: req.body.height ? Number(req.body.height) : null,
      weight: req.body.weight ? Number(req.body.weight) : null,
      phoneNumber: req.body.phoneNumber,
      shirtNumber: req.body.shirtNumber ? Number(req.body.shirtNumber) : null,
      sportsTests: req.body.sportsTests || [],
    };

    await db.collection('players').doc(req.params.id).update(updateData);
    req.flash('success', 'تم تحديث بيانات اللاعب بنجاح');
    res.redirect(`/listings/profile/${req.params.id}`);
  } catch (error) {
    console.error('Error updating player:', error);
    req.flash('error', 'خطأ في تحديث بيانات اللاعب: ' + error.message);
    res.redirect(`/listings/${req.params.id}/edit`);
  }
});

router.delete('/:id', requireSignedIn, async (req, res) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.id).get();
    const category = playerDoc.exists ? playerDoc.data().category : null;

    await db.collection('players').doc(req.params.id).delete();

    const attSnap = await db.collection('attendance').where('player', '==', req.params.id).get();
    const batch = db.batch();
    attSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    req.flash('success', 'تم حذف اللاعب بنجاح');
    res.redirect(category ? `/listings/${category}` : '/listings');
  } catch (error) {
    console.error('Error deleting player:', error);
    req.flash('error', 'خطأ في حذف اللاعب');
    res.redirect('/listings');
  }
});

router.get('/admin/dashboard', isAdmin, (req, res) => {
  res.render('admin/dashboard');
});

module.exports = router;