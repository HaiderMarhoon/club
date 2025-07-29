require('dotenv').config({ quiet: true })
const express = require('express')
const app = express()
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
const flash = require('express-flash')

// Database connection
const mongoose = require('mongoose')
mongoose.connect(process.env.MONGODB_URI)
mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name} 🙃.`)
})

// View engine setup
app.set('view engine', 'ejs')
console.log("Views folder:", path.join(__dirname, 'views'))
app.set('layout', 'layouts/main')
app.use(expressLayouts) // Enable EJS layouts
app.use(express.static(path.join(__dirname, 'public')))

// Middleware
const methodOverride = require('method-override')
const morgan = require('morgan')
const session = require('express-session')
const MongoStore = require('connect-mongo')

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))
app.use(morgan('dev'))
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}))
app.use(flash())
app.use(expressLayouts)
app.set('layout', 'layouts/main')

// Custom middleware
const isSignedIn = require('./middleware/is-signed-in')
const passUserToView = require('./middleware/pass-user-to-view')
app.use(passUserToView)
app.use((req, res, next) => {
  res.locals.user = req.session.user; // Make user available to all views
  next();
});

// Routes
const authController = require('./controllers/auth.controller')
const listingController = require("./controllers/listing.controller")
const attendanceRoutes = require('./controllers/attendance')

app.use('/auth', authController)
app.use('/listings', listingController)
app.use('/attendance', attendanceRoutes)

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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).render('error', { 
    error: err,
    title: 'Server Error'
  })
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
