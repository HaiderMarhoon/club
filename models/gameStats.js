const mongoose = require('mongoose')

const gameStatsSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  
  matchDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  matchName: {
    type: String,
    required: true,
    trim: true
  },
  
  opponent: {
    type: String,
    trim: true
  },
  
  category: {
    type: String,
    enum: ['under14', 'under16', 'under18', 'under20', 'man'],
    required: true
  },
  
  position: {
    type: String,
    enum: ['player', 'goalkeeper'],
    default: 'player'
  },
  
  // Offensive Stats
  passes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  goals: {
    type: Number,
    default: 0,
    min: 0
  },
  
  shotsAttempted: {
    type: Number,
    default: 0,
    min: 0
  },
  
  shotDetails: [{
    type: {
      type: String,
      enum: ['goal', 'miss', 'blocked'],
      required: true
    },
    zone: String, // e.g., "left wing", "center", "right wing", "7m line"
    time: String, // game time
    result: String // additional notes
  }],
  
  // Defensive Stats (including GK)
  saves: {
    type: Number,
    default: 0,
    min: 0
  },
  
  saveDetails: [{
    zone: String, // where the shot came from
    type: {
      type: String,
      enum: ['regular_save', 'diving_save', 'penalty_save'],
      required: true
    },
    time: String,
    result: String
  }],
  
  turnovers: {
    type: Number,
    default: 0,
    min: 0
  },
  
  turnoverDetails: [{
    type: String, // e.g., "bad pass", "charging", "ball out of bounds"
    time: String,
    description: String
  }],
  
  // GK Specific
  goalsAgainst: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // General Stats
  minutesPlayed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  rating: {
    type: Number,
    min: 1,
    max: 10
  },
  
  notes: {
    type: String,
    trim: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for goal accuracy percentage
gameStatsSchema.virtual('goalAccuracy').get(function() {
  if (this.shotsAttempted === 0) return 0
  return Math.round((this.goals / this.shotsAttempted) * 100)
})

// Virtual for save percentage (for GK)
gameStatsSchema.virtual('savePercentage').get(function() {
  const shotsAgainst = this.saves + this.goalsAgainst
  if (shotsAgainst === 0) return 0
  return Math.round((this.saves / shotsAgainst) * 100)
})

gameStatsSchema.index({ player: 1, matchDate: -1 })
gameStatsSchema.index({ category: 1, matchDate: -1 })

module.exports = mongoose.model('GameStats', gameStatsSchema)
