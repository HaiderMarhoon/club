const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم اللاعب مطلوب'],
    trim: true
  },
  category: {
    type: String,
    enum: ['under14', 'under16', 'under18'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual for attendance records
playerSchema.virtual('attendances', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'player'
})

module.exports = mongoose.model('Player', playerSchema)