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

    // Define today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's attendance records
    const attendanceToday = await Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd },
      player: { $in: players.map(p => p._id) }
    });

    // Create playerId to attendanceId mapping
    const attendanceMap = {};
    attendanceToday.forEach(record => {
      attendanceMap[record.player.toString()] = record._id;
    });

    // Prepare players data with attendance info
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
    const player = await Player.findById(req.params.id);
    const user = req.session.user;

    if (!player) {
      req.flash('error', 'اللاعب غير موجود');
      return res.redirect('/listings');
    }

    const isSamePlayer = user.isPlayer && user._id.toString() === player._id.toString();
    const canView = user.isAdmin || user.isView || isSamePlayer;

    if (!canView) {
      req.flash('error', 'غير مصرح لك بعرض هذا السجل');
      return res.redirect('/');
    }

    // 📊 Get attendance records (sorted by date descending)
    const records = await Attendance.find({ player: player._id }).sort({ date: -1 });

    // 🧾 Render attendance history page
    res.render('attendance/history', {
      player,
      records,
      categoryName: getCategoryName(player.category)
    });

  } catch (err) {
    console.error('Error loading attendance history:', err);
    req.flash('error', 'خطأ في تحميل سجل الحضور');
    res.redirect('/listings');
  }
});

router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate('player');
    
    if (!attendance) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }

    res.render('attendance/edit', {
      attendance,
      player: attendance.player,
      today: attendance.date.toISOString().split('T')[0],
      categoryName: getCategoryName(attendance.player.category)
    });
  } catch (err) {
    console.error('Error loading attendance edit form:', err);
    req.flash('error', 'خطأ في تحميل نموذج التعديل');
    res.redirect(`/attendance/player/${req.params.id}`);
  }
});


// PUT Update Attendance
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const { status, comment, date } = req.body; // Changed from 'comment' to 'notes'

    if (!status || !date) {
      req.flash('error', 'الحالة وتاريخ التدريب مطلوبان');
      return res.redirect(`/attendance/${req.params.id}/edit`);
    }

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      {
        status,
        comment: comment || '',
        date: new Date(date),
        updatedAt: new Date()
      },
      { new: true }
    ).populate('player');

    if (!attendance) {
      req.flash('error', 'سجل الحضور غير موجود');
      return res.redirect('/attendance');
    }

    req.flash('success', 'تم تحديث سجل الحضور بنجاح');
    res.redirect(`/attendance/player/${attendance.player._id}`);
  } catch (err) {
    console.error('Error updating attendance:', err);
    req.flash('error', 'خطأ في تحديث سجل الحضور');
    res.redirect(`/attendance/${req.params.id}/edit`);
  }
});

// Delete attendance record
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
    under18: 'ناشئين (Under 18)',
    under20: 'تحت 20 سنة (Under 20)',
    man: 'الرجال'
  }
  return names[category] || category
}

module.exports = router