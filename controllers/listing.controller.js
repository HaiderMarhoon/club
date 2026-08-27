const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase-admin');
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

function eventSecond(event) {
  const parts = String(event.matchTime || '0:0').split(':').map(Number);
  const withinPeriod = (parts[0] || 0) * 60 + (parts[1] || 0);
  return (Math.max(1, Number(event.period) || 1) - 1) * 1800 + withinPeriod;
}

function calculatePlayingSeconds(playerId, matches, playerEvents) {
  const byMatch = {};
  playerEvents.filter(e => e.matchId).forEach(e => (byMatch[e.matchId] ||= []).push(e));
  let total = 0;
  matches.forEach(match => {
    if (!(match.roster || []).some(p => p._id === playerId)) return;
    const events = (byMatch[match._id] || []).slice().sort((a, b) => eventSecond(a) - eventSecond(b));
    const maxEvent = events.reduce((max, e) => Math.max(max, eventSecond(e)), 0);
    const matchEnd = (Math.max(1, Number(match.period) || 1) - 1) * 1800 + Number(match.clockSeconds || 0);
    const end = Math.max(maxEvent, matchEnd);
    let enteredAt = (match.startingLineup || []).includes(playerId) ? 0 : null;
    events.filter(e => e.type === 'substitution').forEach(e => {
      const at = eventSecond(e);
      if (e.result === 'in' && enteredAt === null) enteredAt = at;
      if (e.result === 'out' && enteredAt !== null) { total += Math.max(0, at - enteredAt); enteredAt = null; }
    });
    if (enteredAt !== null) total += Math.max(0, end - enteredAt);
  });
  return Math.round(total);
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
  position: req.body.position === 'goalkeeper' ? 'goalkeeper' : 'court',
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
    const [attSnap, playerEventsSnap, assistEventsSnap, matchesSnap] = await Promise.all([
      db.collection('attendance').where('player', '==', player.id).orderBy('date', 'desc').limit(10).get(),
      db.collection('events').where('playerId', '==', player.id).get(),
      db.collection('events').where('assistPlayerId', '==', player.id).get(),
      db.collection('matches').get(),
    ]);
    const attendanceRecords = attSnap.docs.map(d => {
      const data = d.data();
      return { _id: d.id, id: d.id, ...data, date: toJSDate(data.date) };
    });

    const playerEvents = playerEventsSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    const matches = matchesSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    const matchNames = Object.fromEntries(matches.map(m => [m._id, m.name]));
    const shots = playerEvents.filter(e => e.type === 'shot');
    const goals = shots.filter(e => e.result === 'goal').length;
    const savesFaced = playerEvents.filter(e => e.type === 'save');
    const saves = savesFaced.filter(e => e.result === 'save').length;
    const playingSeconds = calculatePlayingSeconds(player.id, matches, playerEvents);
    const technicalErrors = playerEvents.filter(e => ['technicalFault', 'turnover', 'lineTouch'].includes(e.type)).map(e => ({
      type: e.technicalLabel || (e.type === 'turnover' ? 'فقدان كرة' : e.type === 'lineTouch' ? 'دخول المنطقة' : 'خطأ فني'),
      matchName: matchNames[e.matchId] || 'مباراة', period: e.period || '-', time: e.matchTime || '--:--',
    })).reverse();
    const playerShots = playerEvents.filter(e => ['shot', 'save'].includes(e.type) && e.shotLocation).map(e => ({
      id: e._id, eventType: e.type, opponentShooter: e.opponentShooter || '', result: e.result, shotType: e.shotType, shotLocation: e.shotLocation,
      goalDirection: e.goalDirection, goalLocation: e.goalLocation, matchName: matchNames[e.matchId] || 'مباراة',
      period: e.period || '-', time: e.matchTime || '--:--',
    }));
    const performanceMatches = matches.filter(m =>
      (m.roster || []).some(p => p._id === player.id) || playerEvents.some(e => e.matchId === m._id)
    ).map(m => {
      const evs = playerEvents.filter(e => e.matchId === m._id);
      const matchShots = evs.filter(e => e.type === 'shot');
      const mapShots = evs.filter(e => ['shot', 'save'].includes(e.type));
      const matchGoals = matchShots.filter(e => e.result === 'goal').length;
      const faced = evs.filter(e => e.type === 'save');
      const matchErrors = evs.filter(e => ['technicalFault', 'turnover', 'lineTouch'].includes(e.type));
      return {
        id: m._id, name: m.name || 'مباراة', opponent: m.teamB || '', status: m.status || '',
        date: m.createdAt && (m.createdAt.seconds || m.createdAt._seconds) ? new Date((m.createdAt.seconds || m.createdAt._seconds) * 1000).toISOString() : '',
        stats: {
          goals: matchGoals, shots: matchShots.length,
          accuracy: matchShots.length ? Math.round(matchGoals * 100 / matchShots.length) : 0,
          saves: faced.filter(e => e.result === 'save').length, faced: faced.length,
          assists: evs.filter(e => e.type === 'assist').length + assistEventsSnap.docs.filter(d => d.data().matchId === m._id).length,
          steals: evs.filter(e => e.type === 'steal').length,
          errors: matchErrors.length, blocks: evs.filter(e => e.type === 'block').length,
          playingSeconds: calculatePlayingSeconds(player.id, [m], evs),
        },
        shots: mapShots.filter(e => e.shotLocation).map(e => ({
          id: e._id, eventType: e.type, opponentShooter: e.opponentShooter || '', result: e.result, shotType: e.shotType, shotLocation: e.shotLocation,
          goalDirection: e.goalDirection, goalLocation: e.goalLocation, matchName: m.name || 'مباراة',
          period: e.period || '-', time: e.matchTime || '--:--',
        })),
        errors: matchErrors.map(e => ({
          type: e.technicalLabel || (e.type === 'turnover' ? 'فقدان كرة' : e.type === 'lineTouch' ? 'دخول المنطقة' : 'خطأ فني'),
          period: e.period || '-', time: e.matchTime || '--:--',
        })),
      };
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const minutes = playingSeconds / 60;
    const advice = [];
    if (shots.length >= 3 && goals / shots.length < 0.5) advice.push('رفع جودة اختيار التسديدة والتركيز على الزوايا الأكثر نجاحاً.');
    if (technicalErrors.length > Math.max(2, shots.length * 0.25)) advice.push('تقليل الأخطاء الفنية عبر تحسين القرار والتمرير تحت الضغط.');
    if (minutes >= 10 && goals / minutes < 0.15 && shots.length) advice.push('زيادة الفاعلية الهجومية والتحرك بدون كرة لخلق فرص أكثر.');
    if (playerEvents.filter(e => e.type === 'steal').length > technicalErrors.length) advice.push('الأداء الدفاعي والاسترجاع نقطة قوة؛ حافظ على نفس مستوى الضغط.');
    if (!advice.length) advice.push('الأداء متوازن وفق البيانات المسجلة؛ استمر مع التركيز على الثبات من مباراة لأخرى.');
    const playerStats = {
      matches: new Set(playerEvents.map(e => e.matchId).filter(Boolean)).size,
      goals, shots: shots.length, accuracy: shots.length ? Math.round(goals * 100 / shots.length) : 0,
      saves, shotsFaced: savesFaced.length, saveRate: savesFaced.length ? Math.round(saves * 100 / savesFaced.length) : 0,
      assists: assistEventsSnap.size + playerEvents.filter(e => e.type === 'assist').length,
      steals: playerEvents.filter(e => e.type === 'steal').length,
      turnovers: playerEvents.filter(e => ['turnover', 'technicalFault'].includes(e.type)).length,
      blocks: playerEvents.filter(e => e.type === 'block').length,
      suspensions: playerEvents.filter(e => e.type === 'suspension').length,
      playingSeconds,
      goalsPer60: minutes ? (goals * 60 / minutes).toFixed(1) : '0.0',
      errorsPer60: minutes ? (technicalErrors.length * 60 / minutes).toFixed(1) : '0.0',
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
      playerShots,
      technicalErrors,
      advice,
      coachNotes: (playerData.coachNotes || []).slice().reverse(),
      performanceMatches,
    });
  } catch (error) {
    console.error('Error loading player profile:', error);
    req.flash('error', 'فشل في تحميل الملف الشخصي');
    res.redirect('/listings');
  }
});

router.post('/profile/:id/notes', requireSignedIn, async (req, res) => {
  try {
    if (!req.user || (!req.user.isAdmin && !req.user.isCoach)) {
      return res.status(403).send('غير مصرح بإضافة ملاحظة');
    }
    const text = String(req.body.note || '').trim();
    if (!text) {
      req.flash('error', 'اكتب الملاحظة أولاً');
      return res.redirect(`/listings/profile/${req.params.id}`);
    }
    const note = {
      text: text.slice(0, 1000),
      author: req.user.username || req.user.email || 'المدرب',
      createdAt: new Date().toISOString(),
    };
    await db.collection('players').doc(req.params.id).update({ coachNotes: admin.firestore.FieldValue.arrayUnion(note) });
    req.flash('success', 'تم حفظ الملاحظة');
    res.redirect(`/listings/profile/${req.params.id}`);
  } catch (error) {
    console.error('Error adding coach note:', error);
    req.flash('error', 'تعذر حفظ الملاحظة');
    res.redirect(`/listings/profile/${req.params.id}`);
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
      position: req.body.position === 'goalkeeper' ? 'goalkeeper' : 'court',
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
