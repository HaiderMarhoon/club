const { db } = require('../config/firebase-admin');
exports.dashboard = async (req, res, next) => {
  try {
    const [playersSnap, statsSnap, attendanceSnap] = await Promise.all([db.collection('players').get(), db.collection('gameStats').get(), db.collection('attendance').get()]);
    const names = Object.fromEntries(playersSnap.docs.map(d => [d.id, d.data().name])); const rows = {};
    const ensure = id => rows[id] ||= { id, name: names[id] || 'لاعب', goals: 0, shots: 0, saves: 0, against: 0, present: 0, absent: 0, late: 0 };
    playersSnap.docs.forEach(d => ensure(d.id));
    statsSnap.docs.forEach(d => { const s = d.data(); if (!s.playerId) return; const r = ensure(s.playerId); r.name = s.playerName || r.name; r.goals += Number(s.goals || 0); r.shots += Number(s.shotsAttempted || 0); r.saves += Number(s.saves || 0); r.against += Number(s.shotsAgainst || 0); });
    attendanceSnap.docs.forEach(d => { const a = d.data(); if (!a.player) return; const r = ensure(a.player); if (a.status === 'present') r.present++; else if (a.status === 'absent') r.absent++; else if (a.status === 'late') r.late++; });
    const players = Object.values(rows).map(r => ({ ...r, accuracy: r.shots ? Math.round(r.goals * 100 / r.shots) : 0, saveRate: r.against ? Math.round(r.saves * 100 / r.against) : 0 }));
    res.render('statistics/dashboard', { title: 'لوحة الإحصاءات', players });
  } catch (err) { next(err); }
};
