const express = require('express');
const router = express.Router();
const stats = require('../controllers/game-stats-controller');
const isSignedIn = require('../middleware/is-signed-in');
const canManageTeam = require('../middleware/can-manage-team');

// Interactive live match-tracking page: clickable court (shot origin) +
// clickable goal (target zone), with a live-updating stats panel.
router.get('/live/:playerId', isSignedIn, canManageTeam, stats.recordLiveForm);

// JSON: a player's aggregated career stats + every shot/save location
// recorded so far (used by the live page's polling refresh).
router.get('/player/:playerId', isSignedIn, stats.playerStats);

// Records a single event (shot / save / turnover / ...). Used by both the
// court dashboard (public/js/court.js) and the new live page above.
router.post('/event', isSignedIn, canManageTeam, stats.recordEventToGameStats);

// Deletes one match's aggregate stats record.
router.delete('/:gameStatsId', isSignedIn, canManageTeam, stats.deleteGame);

module.exports = router;