const { db } = require('../config/firebase-admin');

module.exports = async function (req, res, next) {
  const playerId = req.user?.isPlayer;

  if (playerId) {
    try {
      const doc = await db.collection('players').doc(playerId).get();
      res.locals.currentPlayer = doc.exists ? { _id: doc.id, id: doc.id, ...doc.data() } : null;
    } catch (err) {
      console.error("Error loading player:", err);
      res.locals.currentPlayer = null;
    }
  } else {
    res.locals.currentPlayer = null;
  }

  next();
};
