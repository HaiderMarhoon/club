require('dotenv').config({ quiet: true })
const express = require('express')
const app = express()
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
const flash = require('express-flash')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Firestore (replaces the old mongoose.connect block).
// Throws on boot if Firebase Admin credentials aren't configured — see README.md.
const { db } = require('./config/firebase-admin')

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled Rejection:', reason && reason.message ? reason.message : reason)
})

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'football-players',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});
const upload = multer({ storage: storage });

// View engine setup
app.set('view engine', 'ejs')
console.log("Views folder:", path.join(__dirname, 'views'))
app.set('layout', 'layouts/main')
app.use(expressLayouts)
app.use(express.static(path.join(__dirname, 'public')))

// Middleware
const methodOverride = require('method-override')
const morgan = require('morgan')

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))
app.use(morgan('dev'))
app.set('trust proxy', 1)

// Needed so req.cookies.session (the Firebase session cookie) is readable —
// see middleware/attach-user.js
app.use(cookieParser())

// express-session is kept ONLY to power connect-flash/express-flash messages
// (req.flash success/error banners used throughout the app). It no longer
// stores the authenticated user — that's handled entirely by the Firebase
// session cookie + middleware/attach-user.js below. No MongoStore needed
// since flash messages only need to survive a single redirect.
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 15,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(flash())

// Firebase auth: decodes the "session" cookie set by POST /auth/session-login,
// then exposes req.user / res.locals.user / res.locals.currentPlayer to every route.
const attachUser = require('./middleware/attach-user')
const passUserToView = require('./middleware/pass-user-to-view')
const passPlayerToView = require('./middleware/pass-player-to-view')
app.use(attachUser)
app.use(passUserToView)
app.use(passPlayerToView)

// Routes
const authController = require('./controllers/auth.controller')
const listingController = require('./controllers/listing.controller')
const attendanceRoutes = require('./controllers/attendance')
const adminRoutes = require('./controllers/admin')
const eventsController = require('./controllers/eventsController')
const gameStatsRoutes = require('./routes/game-stats')
const isSignedIn = require('./middleware/is-signed-in')
const canManageTeam = require('./middleware/can-manage-team')
const statisticsController = require('./controllers/statistics-controller')

app.use('/admin', adminRoutes)
app.use('/auth', authController)
app.use('/listings', listingController)
app.use('/attendance', attendanceRoutes)
app.use('/game-stats', gameStatsRoutes) // handles /event too, so the old app.post('/game-stats/event', ...) line below is gone
app.use('/court', isSignedIn, canManageTeam, (req, res) => {
  res.render('court', { title: 'ملعب كرة اليد' })
})
app.use('/match-live', require('./routes/match-live'))
app.get('/match-reports', isSignedIn, (req, res) => res.redirect('/match-live/reports/list'))
app.get('/match-report/:id', isSignedIn, (req, res) => res.redirect('/match-live/reports/' + req.params.id))
app.get('/live-score/:id', (req, res) => res.redirect('/match-live/score/' + req.params.id))

app.get('/players', isSignedIn, async (req, res) => {
  try {
    const snap = await db.collection('players').orderBy('name').get();
    res.json(snap.docs.map(d => ({ _id: d.id, id: d.id, ...d.data() })));
  } catch (err) {
    console.error('Error loading players:', err);
    res.status(500).json([]);
  }
});

app.get('/player-categories', (req, res) => {
  // Firestore has no schema/enum (Mongoose's Player.schema.path('category').enumValues
  // no longer exists) — the fixed category list now lives here directly.
  res.json(['under14', 'under16', 'under18', 'under20', 'man']);
});

app.get('/js/dashboard.js', (req, res) => {
  res.redirect('/js/court.js');
});

app.post('/events', isSignedIn, canManageTeam, eventsController.addEvent);
app.delete('/events/:id', isSignedIn, canManageTeam, eventsController.deleteEvent);
app.delete('/events', isSignedIn, canManageTeam, eventsController.clearEvents);
app.get('/stats', isSignedIn, eventsController.getStats);

app.post('/matches', isSignedIn, canManageTeam, eventsController.saveMatch);
app.put('/matches/:id', isSignedIn, canManageTeam, eventsController.updateMatch);
app.get('/matches', isSignedIn, eventsController.getMatches);
app.get('/matches/:id', isSignedIn, eventsController.getMatch);
app.get('/public/matches/:id', eventsController.getPublicMatch);
app.delete('/matches/:id', isSignedIn, canManageTeam, eventsController.deleteMatch);
app.get('/statistics', isSignedIn, statisticsController.dashboard);

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Football Team Management',
    messages: req.flash()
  })
})

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    error: {
      message: 'Page Not Found',
      status: 404
    },
    title: 'Page Not Found'
  })
})

// Favicon handler - prevent 404 logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).render('error', {
    error: err,
    title: 'Server Error'
  })
})

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
