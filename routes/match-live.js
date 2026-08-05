const express = require('express');
const router = express.Router();
const isSignedIn = require('../middleware/is-signed-in');
const canManageTeam = require('../middleware/can-manage-team');

// Full-match live tracking page: pick a roster, start a match, then log
// every event (shot/save/turnover/...) with court + goal location, live
// scoreboard and live per-player stats. Uses the EXISTING /players,
// /matches and /events endpoints (eventsController.js) — no backend
// changes required.
router.get('/', isSignedIn, canManageTeam, (req, res) => {
  res.render('matchLive', { title: 'مباراة مباشرة كاملة' });
});

module.exports = router;