const GameStats = require('../models/gameStats')
const Player = require('../models/players')

// Display all game stats for a player
exports.playerStats = async (req, res, next) => {
  try {
    const { playerId } = req.params
    const player = await Player.findById(playerId)
    
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }

    const stats = await GameStats.find({ player: playerId })
      .sort({ matchDate: -1 })
      .lean()

    // Calculate totals
    const totals = stats.reduce((acc, stat) => {
      acc.passes += stat.passes
      acc.goals += stat.goals
      acc.shots += stat.shotsAttempted
      acc.saves += stat.saves
      acc.turnovers += stat.turnovers
      acc.goalsAgainst += stat.goalsAgainst
      return acc
    }, { passes: 0, goals: 0, shots: 0, saves: 0, turnovers: 0, goalsAgainst: 0 })

    res.render('gameStats/playerStats', {
      player,
      stats,
      totals,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ في تحميل إحصائيات اللاعب')
    res.redirect('/listings')
  }
}

// Display form to record new game stats
exports.recordGameForm = async (req, res, next) => {
  try {
    const { playerId } = req.params
    const player = await Player.findById(playerId)
    
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }

    res.render('gameStats/recordGame', {
      player,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ')
    res.redirect('/listings')
  }
}

// Create new game stats record
exports.recordGame = async (req, res, next) => {
  try {
    const { playerId } = req.params
    const {
      matchDate, matchName, opponent, position,
      passes, goals, shotsAttempted, saves, turnovers, 
      goalsAgainst, minutesPlayed, rating, notes
    } = req.body

    const player = await Player.findById(playerId)
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }

    const gameStats = new GameStats({
      player: playerId,
      matchDate: matchDate || new Date(),
      matchName,
      opponent,
      category: player.category,
      position: position || 'player',
      passes: parseInt(passes) || 0,
      goals: parseInt(goals) || 0,
      shotsAttempted: parseInt(shotsAttempted) || 0,
      saves: parseInt(saves) || 0,
      turnovers: parseInt(turnovers) || 0,
      goalsAgainst: parseInt(goalsAgainst) || 0,
      minutesPlayed: parseInt(minutesPlayed) || 0,
      rating: parseInt(rating) || null,
      notes
    })

    await gameStats.save()
    req.flash('success', 'تم تسجيل إحصائيات المباراة بنجاح')
    res.redirect(`/game-stats/player/${playerId}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في تسجيل الإحصائيات')
    res.redirect(`/game-stats/record/${playerId}`)
  }
}

// Display form to record shot details
exports.recordShotForm = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const gameStats = await GameStats.findById(gameStatsId).populate('player')
    
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    res.render('gameStats/recordShot', {
      gameStats,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ')
    res.redirect('/listings')
  }
}

// Add shot record
exports.recordShot = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const { type, zone, time, result } = req.body

    const gameStats = await GameStats.findById(gameStatsId)
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    gameStats.shotDetails.push({
      type,
      zone,
      time,
      result
    })

    // Update shot counts
    if (type === 'goal') gameStats.goals += 1
    gameStats.shotsAttempted += 1

    await gameStats.save()
    req.flash('success', 'تم تسجيل الرمية بنجاح')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في تسجيل الرمية')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  }
}

// Display form to record save details
exports.recordSaveForm = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const gameStats = await GameStats.findById(gameStatsId).populate('player')
    
    if (!gameStats || gameStats.position !== 'goalkeeper') {
      req.flash('error', 'حارس المرمى غير موجود')
      return res.redirect('/listings')
    }

    res.render('gameStats/recordSave', {
      gameStats,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ')
    res.redirect('/listings')
  }
}

// Add save record
exports.recordSave = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const { zone, type, time, result } = req.body

    const gameStats = await GameStats.findById(gameStatsId)
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    gameStats.saveDetails.push({
      zone,
      type,
      time,
      result
    })

    gameStats.saves += 1
    await gameStats.save()
    
    req.flash('success', 'تم تسجيل التصدي بنجاح')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في تسجيل التصدي')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  }
}

// Display form to record turnover
exports.recordTurnoverForm = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const gameStats = await GameStats.findById(gameStatsId).populate('player')
    
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    res.render('gameStats/recordTurnover', {
      gameStats,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ')
    res.redirect('/listings')
  }
}

// Add turnover record
exports.recordTurnover = async (req, res, next) => {
  try {
    const { gameStatsId } = req.params
    const { type, time, description } = req.body

    const gameStats = await GameStats.findById(gameStatsId)
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    gameStats.turnoverDetails.push({
      type,
      time,
      description
    })

    gameStats.turnovers += 1
    await gameStats.save()
    
    req.flash('success', 'تم تسجيل الخسارة بنجاح')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في تسجيل الخسارة')
    res.redirect(`/game-stats/edit/${gameStatsId}`)
  }
}

// Display edit form for game stats
exports.editGameForm = async (req, res, next) => {
  try {
    const gameStats = await GameStats.findById(req.params.gameStatsId).populate('player')
    
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    res.render('gameStats/editGame', {
      gameStats,
      messages: req.flash()
    })
  } catch (error) {
    req.flash('error', 'حدث خطأ')
    res.redirect('/listings')
  }
}

// Update game stats
exports.editGame = async (req, res, next) => {
  try {
    const gameStats = await GameStats.findById(req.params.gameStatsId)
    
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    const { matchDate, matchName, opponent, position, minutesPlayed, rating, notes } = req.body

    Object.assign(gameStats, {
      matchDate,
      matchName,
      opponent,
      position,
      minutesPlayed: parseInt(minutesPlayed) || 0,
      rating: parseInt(rating) || null,
      notes
    })

    await gameStats.save()
    req.flash('success', 'تم تحديث الإحصائيات بنجاح')
    res.redirect(`/game-stats/player/${gameStats.player}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في تحديث الإحصائيات')
    res.redirect(`/game-stats/edit/${req.params.gameStatsId}`)
  }
}

// Delete game stats
exports.deleteGame = async (req, res, next) => {
  try {
    const gameStats = await GameStats.findByIdAndDelete(req.params.gameStatsId)
    
    if (!gameStats) {
      req.flash('error', 'سجل المباراة غير موجود')
      return res.redirect('/listings')
    }

    req.flash('success', 'تم حذف سجل المباراة بنجاح')
    res.redirect(`/game-stats/player/${gameStats.player}`)
  } catch (error) {
    req.flash('error', 'حدث خطأ في حذف السجل')
    res.redirect('/listings')
  }
}
