const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent'],
    required: true
  },
  comment: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
})

// Index for better query performance
attendanceSchema.index({ player: 1, date: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)