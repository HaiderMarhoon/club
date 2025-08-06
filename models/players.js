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
  height: {
    type: Number,
    min: [100, 'الطول يجب أن يكون على الأقل 100 سم'],
    max: [250, 'الطول يجب أن لا يتجاوز 250 سم']
  },
  weight: {
    type: Number,
    min: [30, 'الوزن يجب أن يكون على الأقل 30 كجم'],
    max: [150, 'الوزن يجب أن لا يتجاوز 150 كجم']
  },
  phoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return /^[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} ليس رقم هاتف صالح!`
    }
  },
  shirtNumber: {
    type: Number,
    min: [1, 'رقم القميص يجب أن يكون على الأقل 1'],
    max: [99, 'رقم القميص يجب أن لا يتجاوز 99']
  },
  sportsTests: [{
    testName: String,
    result: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
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