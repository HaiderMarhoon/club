const { db } = require('../config/firebase-admin');
module.exports = async function loadAdminAccounts() {
  const [playersSnap, usersSnap] = await Promise.all([db.collection('players').get(), db.collection('users').get()]);
  const players = playersSnap.docs.map(d => ({ ...d.data(), _id: d.id }));
  const byId = new Map(players.map(p => [p._id, p]));
  const users = usersSnap.docs.map(d => {
    const data = d.data();
    return { ...data, _id: d.id, isPlayer: byId.get(data.isPlayer) || null,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null };
  }).sort((a,b) => String(a.username || '').localeCompare(String(b.username || ''), 'ar'));
  return { players, users };
};
