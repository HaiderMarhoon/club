const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase-admin');
const requireSignedIn = require('../middleware/require-signed-in');

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

router.get('/players/list', requireSignedIn, async (req, res) => {
  try {
    const snap = await db.collection('attendance').get();
    const playerIds = [...new Set(snap.docs.map(d => d.data().player).filter(Boolean))];

    const players = await Promise.all(
      playerIds.map(async id => {
        const doc = await db.collection('players').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data();
        return { _id: doc.id, name: data.name, category: data.category, shirtNumber: data.shirtNumber || null };
      })
    );

    res.json(players.filter(Boolean));
  } catch (err) {
    console.error('Error loading attendance player list:', err);
    res.status(500).json({ success: false, message: 'خطأ في تحميل لاعبي الحضور' });
  }
});

router.get('/:category', requireSignedIn, async (req, res) => {
  try {
    const category = req.params.category;
    const playersSnap = await db.collection('players').where('category', '==', category).orderBy('name').get();
    const players = playersSnap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() }));

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const playerIds = players.map(p => p.id);
    let attendanceToday = [];

    // Firestore 'in' queries max out at 30 values, so chunk large rosters
    for (let i = 0; i < playerIds.length; i += 30) {
      const chunk = playerIds.slice(i, i + 30);
      if (!chunk.length) continue;
      const snap = await db.collection('attendance')
        .where('player', 'in', chunk)
        .where('date', '>=', todayStart)
        .where('date', '<=', todayEnd)
        .get();
      attendanceToday.push(...snap.docs.map(d => ({ _id: d.id, ...d.data() })));
    }

    const attendanceMap = {};
    attendanceToday.forEach(record => { attendanceMap[record.player] = record._id; });

    const playersWithAttendance = players.map(player => ({
      ...player,
      attendanceId: attendanceMap[player.id] || null,
    }));

    res.render('attendance/form', {
      category,
      players: playersWithAttendance,
      today: new Date().toISOString().split('T')[0],
      categoryName: getCategoryName(category),
    });
  } catch (err) {
    console.error('Error loading attendance form:', err);
    req.flash('error', 'خطأ في تحميل نموذج الحضور');
    res.redirect(`/listings/${req.params.category}`);
  }
});

router.post('/', requireSignedIn, async (req, res) => {
  try {
    const { category, date, attendances } = req.body;

    if (!date || !attendances) {
      req.flash('error', 'البيانات المطلوبة غير مكتملة');
      return res.redirect(`/attendance/${category}`);
    }

    const batch = db.batch();
    Object.entries(attendances).forEach(([playerId, data]) => {
      const ref = db.collection('attendance').doc();
      batch.set(ref, {
        player: playerId,
        status: data.status,
        comment: data.comment || '',
        date: new Date(date),
        createdAt: new Date(),
      });
    });
    await batch.commit();

    req.flash('success', 'تم تسجيل الحضور بنجاح');
    res.redirect(`/listings/${category}`);
  } catch (err) {
    console.error('Error saving attendance:', err);
    req.flash('error', 'خطأ في حفظ بيانات الحضور');
    res.redirect(`/attendance/${req.body.category}`);
  }
});

router.get('/player/:id', requireSignedIn, async (req, res) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.id).get();
    const user = req.user;

    if (!playerDoc.exists) {
      req.flash('error', 'اللاعب غير موجود');
      return res.redirect('/listings');
    }
    const player = { _id: playerDoc.id, id: playerDoc.id, ...playerDoc.data() };

    const isSamePlayer = user.isPlayer && user.isPlayer === player.id;
    const canView = user.isAdmin || user.isView || isSamePlayer;

    if (!canView) {
      req.flash('error', 'غير مصرح لك بعرض هذا السجل');
      return res.redirect('/');
    }

    const recSnap = await db.collection('attendance').where('player', '==', player.id).orderBy('date', 'desc').get();
    const records = recSnap.docs.map(d => ({ _id: d.id, ...d.data() }));

    res.render('attendance/history', {
      player,
      records,
      categoryName: getCategoryName(player.category),
    });
  } catch (err) {
    console.error('Error loading attendance history:', err);
    req.flash('error', 'خطأ في تحميل سجل الحضور');
    res.redirect('/listings');
  }
});

router.get('/:id/edit', requireSignedIn, async (req, res) => {
  try {
    const doc = await db.collection('attendance').doc(req.params.id).get();
    if (!doc.exists) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }
    const attendance = { _id: doc.id, ...doc.data() };
    const playerDoc = await db.collection('players').doc(attendance.player).get();
    const player = { _id: playerDoc.id, ...playerDoc.data() };

    res.render('attendance/edit', {
      attendance,
      player,
      today: attendance.date.toDate().toISOString().split('T')[0],
      categoryName: getCategoryName(player.category),
    });
  } catch (err) {
    console.error('Error loading attendance edit form:', err);
    req.flash('error', 'خطأ في تحميل نموذج التعديل');
    res.redirect(`/attendance/player/${req.params.id}`);
  }
});

router.put('/:id', requireSignedIn, async (req, res) => {
  try {
    const { status, comment, date } = req.body;

    if (!status || !date) {
      req.flash('error', 'الحالة وتاريخ التدريب مطلوبان');
      return res.redirect(`/attendance/${req.params.id}/edit`);
    }

    const ref = db.collection('attendance').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }

    await ref.update({
      status,
      comment: comment || '',
      date: new Date(date),
      updatedAt: new Date(),
    });

    req.flash('success', 'تم تحديث سجل الحضور بنجاح');
    res.redirect(`/attendance/player/${doc.data().player}`);
  } catch (err) {
    console.error('Error updating attendance:', err);
    req.flash('error', 'خطأ في تحديث سجل الحضور');
    res.redirect(`/attendance/${req.params.id}/edit`);
  }
});

router.delete('/:id', requireSignedIn, async (req, res) => {
  try {
    const ref = db.collection('attendance').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }
    const playerId = doc.data().player;
    await ref.delete();

    req.flash('success', 'تم حذف سجل الحضور بنجاح');
    res.redirect(`/attendance/player/${playerId}`);
  } catch (err) {
    console.error('Error deleting attendance:', err);
    req.flash('error', 'خطأ في حذف سجل الحضور');
    res.redirect(`/attendance/${req.params.id}/edit`);
  }
});

module.exports = router;