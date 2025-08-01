const Player = require('../models/players');

module.exports = async function (req, res, next) {
  const playerId = req.session.user?.playerId || req.session.user?.isPlayer;

  if (playerId) {
    try {
      const player = await Player.findById(playerId).populate('attendances');
      res.locals.currentPlayer = player;
    } catch (err) {
      console.error("Error loading player:", err);
      res.locals.currentPlayer = null;
    }
  } else {
    res.locals.currentPlayer = null;
  }

  next();
};
