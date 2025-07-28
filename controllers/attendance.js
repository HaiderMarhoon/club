const express = require('express')
const router = express.Router()
const Attendance = require('../models/attendance')
const Player = require('../models/players')
const isSignedIn = require('../middleware/is-signed-in')

// View attendance form for a category
router.get('/:category', isSignedIn, async (req, res) => {
  try {
    const category = req.params.category
    const players = await Player.find({ category }).sort({ name: 1 })
    
    res.render('attendance/form', {
      category,
      players,
      today: new Date().toISOString().split('T')[0],
      categoryName: getCategoryName(category)
    })
  } catch (err) {
    console.error('Error loading attendance form:', err)
    req.flash('error', 'خطأ في تحميل نموذج الحضور')
    res.redirect(`/listings/${req.params.category}`)
  }
})

// Submit attendance
router.post('/', isSignedIn, async (req, res) => {
  try {
    const { category, date, attendances } = req.body
    
    // Validate input
    if (!date || !attendances) {
      req.flash('error', 'البيانات المطلوبة غير مكتملة')
      return res.redirect(`/attendance/${category}`)
    }
    
    // Create attendance records
    const records = Object.entries(attendances).map(([playerId, data]) => ({
      player: playerId,
      status: data.status,
      comment: data.comment,
      date: new Date(date)
    }))
    
    await Attendance.insertMany(records)
    
    req.flash('success', 'تم تسجيل الحضور بنجاح')
    res.redirect(`/listings/${category}`)
  } catch (err) {
    console.error('Error saving attendance:', err)
    req.flash('error', 'خطأ في حفظ بيانات الحضور')
    res.redirect(`/attendance/${req.body.category}`)
  }
})

// View attendance history for a player
router.get('/player/:id', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }
    
    const attendanceRecords = await Attendance.find({ player: req.params.id })
      .sort({ date: -1 })
    
    res.render('attendance/history', {
      player,
      records: attendanceRecords,
      categoryName: getCategoryName(player.category)
    })
  } catch (err) {
    console.error('Error loading attendance history:', err)
    req.flash('error', 'خطأ في تحميل سجل الحضور')
    res.redirect(`/listings`)
  }
})

// Helper function to get category name
function getCategoryName(category) {
  const names = {
    under14: 'تجمع (Under 14)',
    under16: 'أشبال (Under 16)',
    under18: 'ناشئين (Under 18)'
  }
  return names[category] || category
}

module.exports = router