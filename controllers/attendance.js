const express = require('express')
const router = express.Router()
const Attendance = require('../models/attendance')
const Player = require('../models/players')
const isSignedIn = require('../middleware/is-signed-in')

// View attendance form for a category

router.get('/:category', isSignedIn, async (req, res) => {
  try {
    const category = req.params.category;
    const players = await Player.find({ category }).sort({ name: 1 });

    // Define start and end of "today"
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get all attendance records for these players today
    const attendanceToday = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      player: { $in: players.map(p => p._id) }
    });

    // Map playerId to attendanceId
    const attendanceMap = {};
    attendanceToday.forEach(record => {
      attendanceMap[record.player.toString()] = record._id;
    });

    // Add attendanceId to each player
    const playersWithAttendance = players.map(player => ({
      ...player.toObject(),
      attendanceId: attendanceMap[player._id.toString()] || null,
    }));

    res.render('attendance/form', {
      category,
      players: playersWithAttendance,
      today: new Date().toISOString().split('T')[0],
      categoryName: getCategoryName(category),
    });
  } catch (err) {
    console.error('Error loading attendance form:', err);
    req.flash('error', 'خطأ في تحميل نموذج الحضور');
    res.redirect(`/listings/${req.params.category}`);
  }
});



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

// Edit attendance record - GET

router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate('player');
    
    if (!attendance) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }

    res.render('attendance/edit', {
      attendance,
      playerId: attendance.player._id, // Explicitly pass playerId
      statusOptions: ['present', 'late', 'absent'],
      categoryName: getCategoryName(attendance.player.category),
      title: 'تعديل سجل الحضور'
    });
  } catch (err) {
    console.error('Error loading attendance edit form:', err);
    req.flash('error', 'خطأ في تحميل نموذج التعديل');
    res.redirect(`/attendance/player/${req.params.id}`);
  }
});

// Update attendance record - PUT
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const { status, comment, date } = req.body
    
    const updatedAttendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, comment, date: new Date(date) },
      { new: true }
    ).populate('player')

    if (!updatedAttendance) {
      req.flash('error', 'سجل الحضور غير موجود')
      return res.redirect('/attendance')
    }

    req.flash('success', 'تم تحديث سجل الحضور بنجاح')
    res.redirect(`/attendance/player/${updatedAttendance.player._id}`)
  } catch (err) {
    console.error('Error updating attendance:', err)
    req.flash('error', 'خطأ في تحديث سجل الحضور')
    res.redirect(`/attendance/${req.params.id}/edit`)
  }
})

// Delete attendance record - DELETE
router.delete('/:id', isSignedIn, async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id)
      .populate('player')

    if (!attendance) {
      req.flash('error', 'سجل الحضور غير موجود')
      return res.redirect('/attendance')
    }

    req.flash('success', 'تم حذف سجل الحضور بنجاح')
    res.redirect(`/attendance/player/${attendance.player._id}`)
  } catch (err) {
    console.error('Error deleting attendance:', err)
    req.flash('error', 'خطأ في حذف سجل الحضور')
    res.redirect(`/attendance/${req.params.id}/edit`)
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