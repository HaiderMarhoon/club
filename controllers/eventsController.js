// controllers/eventsController.js
const { db, admin } = require('../config/firebase-admin');
const { FieldValue } = admin.firestore;

exports.addEvent = async (req, res) => {
  const eventData = {
    ...req.body,
    matchId: req.body.matchId || null,
    createdAt: new Date(),
    createdBy: req.user && (req.user.uid || req.user.id) || null,
  };
  const eventRef = await db.collection('events').add(eventData);

  if (req.body.matchId) {
    await db.collection('matches').doc(req.body.matchId).update({
      eventIds: FieldValue.arrayUnion(eventRef.id),
    });
  }

  res.json({ success: true, event: { _id: eventRef.id, ...eventData } });
};

exports.getStats = async (req, res) => {
  let query = db.collection('events');
  if (req.query.matchId) {
    query = query.where('matchId', '==', req.query.matchId);
  }
  const snap = await query.get();
  const events = snap.docs.map(d => d.data());

  const goals = events.filter(e => e.result === 'goal').length;
  const saves = events.filter(e => e.result === 'save').length;
  const fouls = events.filter(e => e.type === 'foul').length;
  const steals = events.filter(e => e.type === 'steal').length;
  const suspensions = events.filter(e => e.result === '2min').length;
  const lineTouches = events.filter(e => e.type === 'lineTouch').length;
  const walking = events.filter(e => e.type === 'walking').length;
  const passes = events.filter(e => e.type === 'pass').length;
  const turnovers = events.filter(e => e.type === 'turnover').length;
  const penalties = events.filter(e => e.type === 'penalty').length;

  const teamScores = {};
  events.forEach(e => {
    if (e.type === 'shot' && e.result === 'goal' && e.team) {
      teamScores[e.team] = (teamScores[e.team] || 0) + 1;
    }
  });

  const shots = events.filter(e => e.type === 'shot').length;
  const successRate = shots ? (goals / shots * 100).toFixed(2) : 0;

  res.json({
    totalEvents: events.length,
    goals, saves, fouls, steals, suspensions, lineTouches, walking,
    passes, turnovers, penalties, shots, successRate, teamScores,
  });
};

exports.saveMatch = async (req, res) => {
  const { name, teamA, teamB, period, events } = req.body;
  if (!name || !teamA || !teamB) {
    return res.status(400).json({ success: false, message: 'الرجاء إدخال اسم المباراة واسم الفريقين.' });
  }

  const matchRef = await db.collection('matches').add({
    name, teamA, teamB, period: period || '1', eventIds: [], status: 'live',
    clockSeconds: 0, clockRunning: false,
    roster: Array.isArray(req.body.roster) ? req.body.roster : [],
    startingLineup: Array.isArray(req.body.startingLineup) ? req.body.startingLineup.slice(0, 7) : [],
    createdAt: new Date(), updatedAt: new Date(),
  });

  if (Array.isArray(events) && events.length) {
    const batch = db.batch();
    const eventIds = [];
    events.forEach(ev => {
      const ref = db.collection('events').doc();
      batch.set(ref, { ...ev, matchId: matchRef.id });
      eventIds.push(ref.id);
    });
    await batch.commit();
    await matchRef.update({ eventIds });
  }

  const matchDoc = await matchRef.get();
  res.json({ success: true, match: { _id: matchRef.id, ...matchDoc.data() } });
};

exports.updateMatch = async (req, res) => {
  const matchRef = db.collection('matches').doc(req.params.id);
  const matchDoc = await matchRef.get();
  if (!matchDoc.exists) {
    return res.status(404).json({ success: false, message: 'المباراة غير موجودة.' });
  }

  const { name, teamA, teamB, period, events } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (teamA) updateData.teamA = teamA;
  if (teamB) updateData.teamB = teamB;
  if (period) updateData.period = period;
  ['status', 'clockSeconds', 'clockRunning', 'clockStartedAt', 'roster'].forEach(key => {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  });
  updateData.updatedAt = new Date();

  if (Array.isArray(events) && events.length) {
    const batch = db.batch();
    const newEventIds = [];
    events.forEach(ev => {
      const ref = db.collection('events').doc();
      batch.set(ref, { ...ev, matchId: req.params.id });
      newEventIds.push(ref.id);
    });
    await batch.commit();
    updateData.eventIds = FieldValue.arrayUnion(...newEventIds);
  }

  await matchRef.update(updateData);
  const updated = await matchRef.get();
  res.json({ success: true, match: { _id: updated.id, ...updated.data() } });
};

exports.getMatches = async (req, res) => {
  const snap = await db.collection('matches').orderBy('createdAt', 'desc').get();
  res.json(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
};

exports.getMatch = async (req, res) => {
  const matchDoc = await db.collection('matches').doc(req.params.id).get();
  if (!matchDoc.exists) {
    return res.status(404).json({ success: false, message: 'المباراة غير موجودة.' });
  }
  const matchData = matchDoc.data();
  const eventIds = matchData.eventIds || [];

  const events = await Promise.all(
    eventIds.map(async id => {
      const doc = await db.collection('events').doc(id).get();
      return doc.exists ? { _id: doc.id, ...doc.data() } : null;
    })
  );

  res.json({ success: true, match: { _id: matchDoc.id, ...matchData, eventIds: events.filter(Boolean) } });
};

exports.getPublicMatch = async (req, res) => {
  const matchDoc = await db.collection('matches').doc(req.params.id).get();
  if (!matchDoc.exists) return res.status(404).json({ success: false, message: 'المباراة غير موجودة.' });
  const matchData = matchDoc.data();
  const events = await Promise.all((matchData.eventIds || []).map(async id => {
    const doc = await db.collection('events').doc(id).get();
    if (!doc.exists) return null;
    const e = doc.data();
    return { _id: doc.id, team: e.team, player: e.player, playerId: e.playerId, type: e.type, result: e.result, period: e.period, matchTime: e.matchTime, shotType: e.shotType, goalDirection: e.goalDirection, goalLocation: e.goalLocation, shotLocation: e.shotLocation, technicalLabel: e.technicalLabel, createdAt: e.createdAt };
  }));
  const safeMatch = {
    _id: matchDoc.id, name: matchData.name, teamA: matchData.teamA, teamB: matchData.teamB,
    period: matchData.period, status: matchData.status, clockSeconds: matchData.clockSeconds || 0,
    clockRunning: !!matchData.clockRunning, clockStartedAt: matchData.clockStartedAt || null,
    roster: matchData.roster || [], eventIds: events.filter(Boolean),
  };
  res.json({ success: true, match: safeMatch });
};

exports.deleteMatch = async (req, res) => {
  const matchRef = db.collection('matches').doc(req.params.id);
  const matchDoc = await matchRef.get();
  if (!matchDoc.exists) {
    return res.status(404).json({ success: false, message: 'المباراة غير موجودة.' });
  }
  if (matchDoc.data().status !== 'finished') {
    return res.status(400).json({ success: false, message: 'يجب إنهاء المباراة قبل حذفها.' });
  }

  const eventsSnap = await db.collection('events').where('matchId', '==', req.params.id).get();
  const batch = db.batch();
  eventsSnap.docs.forEach(doc => batch.delete(doc.ref));
  batch.delete(matchRef);
  await batch.commit();

  res.json({ success: true, message: 'تم حذف المباراة.' });
};

exports.clearEvents = async (req, res) => {
  const snap = await db.collection('events').where('matchId', '==', null).get();
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  res.json({ success: true, message: 'تم مسح بيانات المباراة غير المحفوظة.' });
};

exports.deleteEvent = async (req, res) => {
  const eventRef = db.collection('events').doc(req.params.id);
  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) return res.status(404).json({ success: false, message: 'الحدث غير موجود.' });
  const event = eventDoc.data();
  const batch = db.batch();
  batch.delete(eventRef);
  if (event.matchId) {
    batch.update(db.collection('matches').doc(event.matchId), {
      eventIds: FieldValue.arrayRemove(req.params.id), updatedAt: new Date(),
    });
  }
  await batch.commit();
  res.json({ success: true, message: 'تم التراجع عن الحدث.' });
};
