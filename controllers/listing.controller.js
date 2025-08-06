const express = require('express')
const router = express.Router()
const Player = require('../models/players')
const Attendance = require('../models/attendance')
const isSignedIn = require('../middleware/is-signed-in')
const isAdmin = require('../middleware/is-admin')

// Show listing index page with category links
router.get('/', (req, res) => {
  res.render('listings/index')
})

// View form to add a new player (updated with new fields)
router.get('/new', isSignedIn, (req, res) => {
  res.render('listings/new', {
    title: 'إضافة لاعب جديد',
    categories: ['under14', 'under16', 'under18'] // Added for dropdown
  })
})

// Handle new player submission (updated with new fields)
router.post('/', isSignedIn, async (req, res) => {
  try {
    const playerData = {
      name: req.body.name,
      category: req.body.category,
      height: req.body.height,
      weight: req.body.weight,
      phoneNumber: req.body.phoneNumber,
      shirtNumber: req.body.shirtNumber,
      sportsTests: req.body.sportsTests ? JSON.parse(req.body.sportsTests) : []
    }

    const player = new Player(playerData)
    await player.save()
    req.flash('success', 'تم إضافة اللاعب بنجاح')
    res.redirect(`/listings/${player.category}`)
  } catch (error) {
    console.error('Error saving player:', error)
    req.flash('error', 'فشل في حفظ اللاعب: ' + error.message)
    res.redirect('/listings/new')
  }
})

// View all players grouped by category
router.get('/view', isSignedIn, async (req, res) => {
  try {
    const categories = ['under14', 'under16', 'under18']
    res.render('listings/view', { categories })
  } catch (error) {
    console.error('Error loading view page:', error)
    req.flash('error', 'فشل في تحميل الصفحة')
    res.redirect('/listings')
  }
})

// Show players by category (updated with profile link)
router.get('/:category', isSignedIn, async (req, res) => {
  try {
    const category = req.params.category
    const players = await Player.find({ category }).sort({ name: 1 })

    // Get attendance summary for each player
    const playersWithAttendance = await Promise.all(players.map(async player => {
      const attendanceRecords = await Attendance.find({ player: player._id })
      const presentCount = attendanceRecords.filter(a => a.status === 'present').length
      const lateCount = attendanceRecords.filter(a => a.status === 'late').length
      const absentCount = attendanceRecords.filter(a => a.status === 'absent').length

      return {
        ...player.toObject(),
        presentCount,
        lateCount,
        absentCount,
        totalRecords: attendanceRecords.length
      }
    }))

    res.render('listings/category', {
      category,
      players: playersWithAttendance,
      categoryName: getCategoryName(category)
    })
  }
  catch (error) {
    console.error('Error loading players by category:', error)
    req.flash('error', 'فشل في تحميل اللاعبين')
    res.redirect('/listings')
  }
})

// Player profile route
router.get('/profile/:id', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }

    // Get attendance records
    const attendanceRecords = await Attendance.find({ player: player._id })
      .sort({ date: -1 })
      .limit(10) // Show last 10 attendance records

    res.render('listings/profile', {
      player,
      attendanceRecords,
      categoryName: getCategoryName(player.category)
    })
  } catch (error) {
    console.error('Error loading player profile:', error)
    req.flash('error', 'فشل في تحميل الملف الشخصي')
    res.redirect('/listings')
  }
})

// Edit form (updated with new fields)
router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }
    res.render('listings/edit', {
      player,
      categories: ['under14', 'under16', 'under18'] // Added for dropdown
    })
  } catch (error) {
    console.error('Error loading player for edit:', error)
    req.flash('error', 'خطأ في تحميل بيانات اللاعب للتعديل')
    res.redirect('/listings')
  }
})

// Update player (updated with new fields)
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      category: req.body.category,
      height: req.body.height,
      weight: req.body.weight,
      phoneNumber: req.body.phoneNumber,
      shirtNumber: req.body.shirtNumber,
      sportsTests: req.body.sportsTests || [] // Handle sports tests array
    };

    const player = await Player.findByIdAndUpdate(req.params.id, updateData, { new: true });
    req.flash('success', 'تم تحديث بيانات اللاعب بنجاح');
    res.redirect(`/listings/profile/${player._id}`);
  } catch (error) {
    console.error('Error updating player:', error);
    req.flash('error', 'خطأ في تحديث بيانات اللاعب: ' + error.message);
    res.redirect(`/listings/${req.params.id}/edit`);
  }
});

// Delete player
router.delete('/:id', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id)
    await Attendance.deleteMany({ player: req.params.id })

    req.flash('success', 'تم حذف اللاعب بنجاح')
    res.redirect(`/listings/${player.category}`)
  } catch (error) {
    console.error('Error deleting player:', error)
    req.flash('error', 'خطأ في حذف اللاعب')
    res.redirect(`/listings`)
  }
})

// Admin dashboard
router.get('/admin/dashboard', isAdmin, (req, res) => {
  res.render('admin/dashboard')
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