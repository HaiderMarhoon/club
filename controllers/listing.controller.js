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

// Must stay before /:category so "export" is not treated as a category name.
router.get('/export', requireSignedIn, async (req, res) => {
  try {
    const category = req.query.category;
    if (!category) return res.status(400).send('الفئة مطلوبة');
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;
    const playersSnap = await db.collection('players').where('category', '==', category).orderBy('name').get();
    const rows = await Promise.all(playersSnap.docs.map(async doc => {
      const player = { id: doc.id, ...doc.data() };
      const attSnap = await db.collection('attendance').where('player', '==', doc.id).get();
      const records = attSnap.docs.map(d => d.data()).filter(a => {
        const date = toJSDate(a.date);
        return date && (!from || date >= from) && (!to || date <= to);
      });
      const present = records.filter(a => a.status === 'present').length;
      const late = records.filter(a => a.status === 'late').length;
      const absent = records.filter(a => a.status === 'absent').length;
      return [player.name, getCategoryName(category), present, late, absent, records.length, records.length ? Math.round(present * 100 / records.length) + '%' : '0%'];
    }));
    const csvRows = [['اسم اللاعب', 'الفئة', 'حضور', 'تأخر', 'غياب', 'الإجمالي', 'نسبة الحضور'], ...rows];
    const csv = '\uFEFF' + csvRows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${category}-attendance.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting category:', error);
    res.status(500).send('تعذر تصدير بيانات الفئة');
  }
});

router.get('/:category', requireSignedIn, async (req, res) => {
  try {
    const category = req.params.category;
    // Requires a composite index (category ASC, name ASC) — Firestore will
    // print a direct console link to create it the first time this runs.
    const playersSnap = await db.collection('players').where('category', '==', category).orderBy('name').get();
    const players = playersSnap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() }));

    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;
    const playersWithAttendance = await Promise.all(
      players.map(async player => {
        const attSnap = await db.collection('attendance').where('player', '==', player.id).get();
        const records = attSnap.docs.map(d => d.data()).filter(a => {
          const date = toJSDate(a.date);
          return date && (!from || date >= from) && (!to || date <= to);
        });
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
      dateFrom: req.query.from || '',
      dateTo: req.query.to || '',
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
    const [attSnap, playerEventsSnap, assistEventsSnap] = await Promise.all([
      db.collection('attendance').where('player', '==', player.id).orderBy('date', 'desc').limit(10).get(),
      db.collection('events').where('playerId', '==', player.id).get(),
      db.collection('events').where('assistPlayerId', '==', player.id).get(),
    ]);
    const attendanceRecords = attSnap.docs.map(d => {
      const data = d.data();
      return { _id: d.id, id: d.id, ...data, date: toJSDate(data.date) };
    });

    const playerEvents = playerEventsSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    const shots = playerEvents.filter(e => e.type === 'shot');
    const goals = shots.filter(e => e.result === 'goal').length;
    const savesFaced = playerEvents.filter(e => e.type === 'save');
    const saves = savesFaced.filter(e => e.result === 'save').length;
    const playerStats = {
      matches: new Set(playerEvents.map(e => e.matchId).filter(Boolean)).size,
      goals, shots: shots.length, accuracy: shots.length ? Math.round(goals * 100 / shots.length) : 0,
      saves, shotsFaced: savesFaced.length, saveRate: savesFaced.length ? Math.round(saves * 100 / savesFaced.length) : 0,
      assists: assistEventsSnap.size + playerEvents.filter(e => e.type === 'assist').length,
      steals: playerEvents.filter(e => e.type === 'steal').length,
      turnovers: playerEvents.filter(e => ['turnover', 'technicalFault'].includes(e.type)).length,
      blocks: playerEvents.filter(e => e.type === 'block').length,
      suspensions: playerEvents.filter(e => e.type === 'suspension').length,
      recentEvents: playerEvents.sort((a, b) => {
        const ta = a.createdAt && (a.createdAt.seconds || a.createdAt._seconds) || 0;
        const tb = b.createdAt && (b.createdAt.seconds || b.createdAt._seconds) || 0;
        return tb - ta;
      }).slice(0, 10),
    };

    res.render('listings/profile', {
      player,
      attendanceRecords,
      categoryName: getCategoryName(player.category),
      playerStats,
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
