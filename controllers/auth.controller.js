const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const User = require('../models/user.js')


app.get('/', (req, res) => {
  res.render('home.ejs', { user: req.session.user, currentPlayer: req.session.player })
})

// SIGN UP VIEW
router.get('/sign-up', (req, res) => {
  res.render('auth/sign-up.ejs')
})

// POST - CREATE NEW USER (SIGN UP)
router.post('/sign-up', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body

    // Validate matching passwords
    if (password !== confirmPassword) {
      return res.send('كلمة المرور غير متطابقة')
    }

    // Check if user exists
    const userExists = await User.findOne({ username })
    if (userExists) {
      return res.send('اسم المستخدم موجود بالفعل')
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10)

    // Create user
    const user = await User.create({
      username,
      password: hashedPassword,
    })

    // Automatically log in after sign up
    req.session.user = {
      username: user.username,
      _id: user._id,
      isAdmin: user.isAdmin,
      isPlayer: user.isPlayer,
      isView: user.isView
    }

    res.redirect('/')

  } catch (error) {
    console.error('Sign-up error:', error)
    res.send('حدث خطأ أثناء إنشاء الحساب')
  }
})

// SIGN IN VIEW
router.get('/sign-in', (req, res) => {
  res.render('auth/sign-in.ejs')
})

// POST TO SIGN THE USER IN (CREATE SESSION)
router.post('/sign-in', async (req, res) => {
  const userInDatabase = await User.findOne({ username: req.body.username })
  console.log(userInDatabase)

  if (!userInDatabase) {
    return res.send('Login failed. Please try again.')
  }

  const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.password)
  if (!validPassword) {
    return res.send('Login failed. Please try again.')
  }

  // ✅ Include isAdmin in session
  req.session.user = {
    username: userInDatabase.username,
    _id: userInDatabase._id,
    isAdmin: userInDatabase.isAdmin,
    isPlayer: userInDatabase.isPlayer,
    isView: userInDatabase.isView
  }

  req.session.save(() => {
    res.redirect('/')
  })
})


// SIGN OUT VIEW
router.get('/sign-out', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/')
  })
})


module.exports = router