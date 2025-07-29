const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const User = require('../models/user.js')

router.get('/', (req, res) => {
    res.send('does the auth route work?')
})

// SIGN UP VIEW
router.get('/sign-up', (req, res) => {
    res.render('auth/sign-up.ejs')
})

// POST A NEW USER TO THE DATABASE when the form is submitted
router.post('/sign-in', async (req, res) => {
  console.log('SIGN IN FORM:', req.body)

  const userInDatabase = await User.findOne({ username: req.body.username })
  console.log('USER IN DB:', userInDatabase)

  if (!userInDatabase) {
    return res.send('Login failed. User not found.')
  }

  const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.password)
  console.log('PASSWORD VALID:', validPassword)

  if (!validPassword) {
    return res.send('Login failed. Incorrect password.')
  }

  req.session.user = {
    username: userInDatabase.username,
    _id: userInDatabase._id,
  }

  console.log('SESSION AFTER LOGIN:', req.session)

  req.session.save(() => {
    res.redirect('/')
  })
})


// SIGN IN VIEW
router.get('/sign-in', (req, res) => {
    res.render('auth/sign-in.ejs')
})

// POST TO SIGN THE USER IN (CREATE SESSION)
router.post('/sign-in', async (req, res) => {
    // check if user already exists in database
    const userInDatabase = await User.findOne({ username: req.body.username })
    console.log(userInDatabase)
    // if userInDatabase is NOT NULL (that means the user does exist) then send this message
    if (!userInDatabase) {
        return res.send('Login failed. Please try again.')
    }
    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.password)
    if(!validPassword) {
        return res.send('Login failed. Please try again.')
    }
    req.session.user = {
        username: userInDatabase.username,
        _id: userInDatabase._id,
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