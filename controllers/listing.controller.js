const express = require('express')
const router = express.Router()
const Player = require('../models/players')
const Attendance = require('../models/attendance')
const isSignedIn = require('../middleware/is-signed-in')
const isAdmin = require('../middleware/is-admin');

// Show listing index page with category links
router.get('/', (req, res) => {
  res.render('listings/index')
})

// View form to add a new player
router.get('/new', isSignedIn, (req, res) => {
  res.render('listings/new', {
    title: 'إضافة لاعب جديد'  // Add this title
  })
})

// Handle new player submission
router.post('/', isSignedIn, async (req, res) => {
  try {
    const player = new Player({
      name: req.body.name,
      category: req.body.category
    })
    await player.save()
    res.redirect(`/listings/${player.category}`)
  } catch (error) {
    console.error('Error saving player:', error)
    req.flash('error', 'فشل في حفظ اللاعب')
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

// Show players by category
router.get('/:category', isSignedIn, async (req, res) => {
  try {
    const category = req.params.category;
    const players = await Player.find({ category }).sort({ name: 1 });

    // Get attendance summary for each player
    const playersWithAttendance = await Promise.all(players.map(async player => {
      const attendanceRecords = await Attendance.find({ player: player._id });
      const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
      const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
      const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;

      return {
        ...player.toObject(),
        presentCount,
        lateCount,
        absentCount,
        totalRecords: attendanceRecords.length
      };
    }));

    res.render('listings/category', {
      category,
      players: playersWithAttendance,
      categoryName: getCategoryName(category) // Make sure this is included
    });
  } catch (error) {
    console.error('Error loading players by category:', error);
    req.flash('error', 'فشل في تحميل اللاعبين');
    res.redirect('/listings');
  }
});

// Add this route to your listings router
// In your routes file
router.get('/export', isSignedIn, async (req, res) => {
  try {
    const { format, range, category, startDate, endDate } = req.query;
    let columns = req.query.columns || ['name', 'category', 'present', 'late', 'absent', 'percentage'];
    
    // If columns comes as string, convert to array
    if (typeof columns === 'string') {
      columns = [columns];
    }

    // Build your query and get data
    // ... (your existing data fetching logic)

    // Handle PDF export (example using pdfkit)
    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=players.pdf');
      
      doc.pipe(res);
      
      // Add Arabic text support
      doc.registerFont('Arabic', path.join(__dirname, 'fonts/arial.ttf'));
      
      // Add content
      doc.font('Arabic')
         .fontSize(12)
         .text('قائمة اللاعبين', { align: 'right' });
      
      // Add your data table here
      // ...
      
      doc.end();
      return;
    }

    // Handle other formats...
    
  } catch (error) {
    console.error('Export error:', error);
    req.flash('error', 'فشل في تصدير البيانات');
    res.redirect('back');
  }
});

// Edit form
router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
    if (!player) {
      req.flash('error', 'اللاعب غير موجود')
      return res.redirect('/listings')
    }
    res.render('listings/edit', { player })
  } catch (error) {
    console.error('Error loading player for edit:', error)
    req.flash('error', 'خطأ في تحميل بيانات اللاعب للتعديل')
    res.redirect('/listings')
  }
})

// Update player
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, {
      name: req.body.name,
      category: req.body.category
    }, { new: true })

    req.flash('success', 'تم تحديث بيانات اللاعب بنجاح')
    res.redirect(`/listings/${player.category}`)
  } catch (error) {
    console.error('Error updating player:', error)
    req.flash('error', 'خطأ في تحديث بيانات اللاعب')
    res.redirect(`/listings/${req.params.id}/edit`)
  }
})

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

// Helper function to get category name
function getCategoryName(category) {
  const names = {
    under14: 'تجمع (Under 14)',
    under16: 'أشبال (Under 16)',
    under18: 'ناشئين (Under 18)'
  }
  return names[category] || category;
}
router.get('/admin/dashboard', isAdmin, (req, res) => {
  res.render('admin/dashboard');
});

module.exports = router