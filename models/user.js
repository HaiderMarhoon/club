const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isPlayer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        default: null
    }

}
, { timestamps: true })

const User = mongoose.model('User', userSchema)
module.exports = User