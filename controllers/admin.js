const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Player = require('../models/players');
const User = require('../models/user');
const isAdmin = require('../middleware/is-admin');

// Add this before your other routes
router.get('/players', isAdmin, async (req, res) => {
    try {
        const players = await Player.find({});
        const users = await User.find({ isPlayer: { $exists: true } }).populate('isPlayer');

        res.render('admin/players-list', {
            title: 'قائمة اللاعبين',
            players,
            users
        });
    } catch (err) {
        next(err);
    }
});

// GET route for player account creation form (admin only)
router.get('/create-player-account', isAdmin, async (req, res, next) => {
    try {
        const players = await Player.find({}).select('name _id');
        res.render('admin/createPlayerAccount', {
            players,
            title: 'إنشاء حساب لاعب'
        });
    } catch (err) {
        next(err);
    }
});

// POST route to handle player account creation
router.post('/create-player-account', isAdmin, async (req, res, next) => {
    console.log("Form data received:", req.body); // 👈 Debug log
    try {
        const { username, password, playerId } = req.body;

        // Input validation with Arabic messages
        if (!username || !password || !playerId) {
            return res.status(400).render('admin/createPlayerAccount', {
                players: await Player.find({}).select('name _id'),
                error: 'جميع الحقول مطلوبة',
                formData: req.body
            });
        }

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).render('admin/createPlayerAccount', {
                players: await Player.find({}).select('name _id'),
                error: 'اسم المستخدم موجود بالفعل',
                formData: req.body
            });
        }

        // Check if player exists
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(400).render('admin/createPlayerAccount', {
                players: await Player.find({}).select('name _id'),
                error: 'اللاعب المحدد غير صحيح',
                formData: req.body
            });
        }

        // Create user
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            username,
            password: hashedPassword,
            isAdmin: false,
            isPlayer: playerId,
        });

        await user.save();

        req.flash('success', 'تم إنشاء حساب اللاعب بنجاح');
        res.redirect('/admin/players');

    } catch (err) {
        console.error("Error in user creation:", err);
        next(err);
    }
});

module.exports = router;