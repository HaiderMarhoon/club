const { db } = require('../config/firebase-admin');
const categoryNames = { under14: 'تحت 14', under16: 'تحت 16', under18: 'تحت 18', under20: 'تحت 20', man: 'الرجال' };

exports.dashboard = async (req, res, next) => {
  try {
    const selectedCategory = req.query.category || '';
    const [playersSnap, eventsSnap, legacySnap, attendanceSnap] = await Promise.all([
      db.collection('players').get(), db.collection('events').get(),
      db.collection('gameStats').get(), db.collection('attendance').get(),
    ]);
    const docs = playersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !selectedCategory || p.category === selectedCategory);
    const allowed = new Set(docs.map(p => p.id)); const rows = {};
    const ensure = id => rows[id] ||= { id, name: 'لاعب', category: '', goals: 0, shots: 0, saves: 0, faced: 0, assists: 0, steals: 0, turnovers: 0, blocks: 0, suspensions: 0, present: 0, absent: 0, late: 0, matches: new Set() };
    docs.forEach(p => Object.assign(ensure(p.id), { name: p.name, category: p.category }));
    eventsSnap.docs.forEach(doc => {
      const e = doc.data(); if (!e.playerId || !allowed.has(e.playerId)) return; const r = ensure(e.playerId);
      if (e.matchId) r.matches.add(e.matchId);
      if (e.type === 'shot') { r.shots++; if (e.result === 'goal') r.goals++; }
      if (e.type === 'save') { r.faced++; if (e.result === 'save') r.saves++; }
      if (e.type === 'assist') r.assists++;
      if (e.assistPlayerId && allowed.has(e.assistPlayerId)) ensure(e.assistPlayerId).assists++;
      if (e.type === 'steal') r.steals++;
      if (['turnover', 'technicalFault'].includes(e.type)) r.turnovers++;
      if (e.type === 'block') r.blocks++;
      if (e.type === 'suspension') r.suspensions++;
    });
    legacySnap.docs.forEach(doc => { const s = doc.data(); if (!s.playerId || !allowed.has(s.playerId)) return; const r = ensure(s.playerId); r.goals += Number(s.goals || 0); r.shots += Number(s.shotsAttempted || 0); r.saves += Number(s.saves || 0); r.faced += Number(s.shotsAgainst || 0); });
    attendanceSnap.docs.forEach(doc => { const a = doc.data(); if (!a.player || !allowed.has(a.player)) return; const r = ensure(a.player); if (a.status === 'present') r.present++; else if (a.status === 'absent') r.absent++; else if (a.status === 'late') r.late++; });
    const players = Object.values(rows).map(r => ({ ...r, matches: r.matches.size, categoryName: categoryNames[r.category] || r.category, accuracy: r.shots ? Math.round(r.goals * 100 / r.shots) : 0, saveRate: r.faced ? Math.round(r.saves * 100 / r.faced) : 0, attendanceRate: r.present + r.absent + r.late ? Math.round(r.present * 100 / (r.present + r.absent + r.late)) : 0 })).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'ar'));
    res.render('statistics/dashboard', { title: 'لوحة الإحصاءات', players, selectedCategory, categoryNames });
  } catch (err) { next(err); }
};
