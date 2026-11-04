const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true,
        minlength: 8
    },

    role: {
        type: String,
        enum: ['customer', 'agent', 'admin'],
        default: 'customer'
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    otpHash: {
        type: String,
        default: null
    },

    otpExpires: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);