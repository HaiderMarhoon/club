const { db, admin } = require('../config/firebase-admin');

const shotTypes = new Set(['shot6m', 'shot7m', 'shot9m', 'shotWing', 'shotFastBreak', 'shotOrganized']);

// Turns one recorded event into the Firestore counter increments for the
// player's aggregate stats doc. Called inside a transaction in
// recordEventToGameStats below.
function countersFor(event) {
  const counters = { events: 1 };

  if (shotTypes.has(event.type)) {
    counters.shotsAttempted = 1;
    if (event.result === 'goal') counters.goals = 1;
    else if (event.result === 'miss') counters.misses = 1;
    else if (event.result === 'blocked') counters.blocked = 1;
    else if (event.result === 'save') counters.shotsSaved = 1; // shot that the keeper stopped
  }

  if (event.type === 'save') {
    counters.shotsAgainst = 1;
    if (event.result === 'save') counters.saves = 1;
    if (event.result === 'goal') counters.goalsAgainst = 1;
  }

  if (event.type === 'turnover') counters.turnovers = 1;
  if (event.type === 'foul') counters.fouls = 1;
  if (event.type === 'steal') counters.steals = 1;
  if (event.type === 'suspension') counters.suspensions = 1;
  if (event.type === 'pass') counters.passes = 1;

  return counters;
}

// POST /game-stats/event
// Records ONE live event (a shot, a save, a turnover...) against a player's
// running match stats. Called by both the court dashboard (public/js/court.js)
// and the new live tracking page (views/gameStats/live.ejs).
//
// event.shotLocation: "x,y" as percentages (0-100) of the court diagram —
//   where the player shot FROM.
// event.goalDirection: which zone of the goal the shot was aimed at, e.g.
//   "top-left" / "mid-center" / "bottom-right" / "outside".
exports.recordEventToGameStats = async (req, res, next) => {
  try {
    const event = req.body || {};
    if (!event.playerId || !event.type) {
      return res.status(400).json({ success: false, message: 'اللاعب ونوع الحدث مطلوبان.' });
    }

    // One aggregate doc per player per match (or per draft match name if no
    // formal matchId exists yet), so live totals accumulate as events come in.
    const key = event.matchId || `draft-${event.matchName || 'match'}`;
    const statId = `${event.playerId}_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const ref = db.collection('gameStats').doc(statId);

    const detail = {
      type: event.type,
      result: event.result || '',
      time: event.time || '',
      period: event.period || '',
      goalDirection: event.goalDirection || '',
      shotLocation: event.shotLocation || '',
      position: event.position || null,
      note: event.note || '',
      createdAt: new Date(),
    };

    const increments = countersFor(event);

    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      const update = {
        playerId: event.playerId,
        playerName: event.player || '',
        category: event.playerCategory || '',
        matchId: event.matchId || null,
        matchName: event.matchName || '',
        opponent: event.opponent || '',
        updatedAt: new Date(),
        details: admin.firestore.FieldValue.arrayUnion(detail),
      };
      Object.entries(increments).forEach(([field, value]) => {
        update[field] = admin.firestore.FieldValue.increment(value);
      });
      if (!existing.exists) update.createdAt = new Date();
      tx.set(ref, update, { merge: true });
    });

    res.json({ success: true, statId, detail });
  } catch (err) { next(err); }
};

// GET /game-stats/player/:playerId  (JSON — used for the live-updating panel)
exports.playerStats = async (req, res, next) => {
  try {
    const playerId = req.params.playerId;
    if (!req.user) return res.status(403).json({ success: false, message: 'غير مصرح بعرض هذه الإحصاءات.' });

    const snap = await db.collection('gameStats').where('playerId', '==', playerId).get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const keys = ['events', 'shotsAttempted', 'goals', 'misses', 'blocked', 'shotsSaved',
      'saves', 'shotsAgainst', 'goalsAgainst', 'turnovers', 'fouls', 'steals', 'suspensions', 'passes'];
    const totals = records.reduce((sum, row) => {
      keys.forEach(k => sum[k] += Number(row[k] || 0));
      return sum;
    }, Object.fromEntries(keys.map(k => [k, 0])));

    totals.goalAccuracy = totals.shotsAttempted ? Math.round(totals.goals * 100 / totals.shotsAttempted) : 0;
    totals.savePercentage = totals.shotsAgainst ? Math.round(totals.saves * 100 / totals.shotsAgainst) : 0;

    // Flatten every event that has a court/goal location so the client can
    // plot a shot map.
    const shotEvents = [];
    records.forEach(r => (r.details || []).forEach(d => {
      if (d.shotLocation || d.goalDirection) {
        shotEvents.push({
          matchName: r.matchName,
          opponent: r.opponent,
          matchId: r.matchId,
          ...d,
        });
      }
    }));

    res.json({ success: true, records, totals, shotEvents });
  } catch (err) { next(err); }
};

// GET /game-stats/live/:playerId — renders the interactive court+goal
// tracking page for one player.
exports.recordLiveForm = async (req, res, next) => {
  try {
    const playerDoc = await db.collection('players').doc(req.params.playerId).get();
    if (!playerDoc.exists) {
      req.flash('error', 'اللاعب غير موجود');
      return res.redirect('/listings');
    }
    const player = { _id: playerDoc.id, id: playerDoc.id, ...playerDoc.data() };
    res.render('gameStats/live', { player, title: `إحصائيات مباشرة - ${player.name}` });
  } catch (err) { next(err); }
};

// DELETE /game-stats/:gameStatsId — removes one match's aggregate record.
exports.deleteGame = async (req, res, next) => {
  try {
    await db.collection('gameStats').doc(req.params.gameStatsId).delete();
    res.json({ success: true });
  } catch (err) { next(err); }
};