

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateToken = (id) => {
    return jwt.sign(
        { id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password || password.length < 8) {
            return res.status(400).json({
                message: 'Enter name, valid email and password of at least 8 characters'
            });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(400).json({
                message: 'Email already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const otp = crypto.randomInt(100000, 1000000).toString();

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'customer',
            isVerified: false,
            otpHash: await bcrypt.hash(otp, 10),
            otpExpires: Date.now() + 10 * 60 * 1000
        });

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Customer Support - Email Verification',
                text: `Your verification OTP is ${otp}. It expires in 10 minutes.`
            });
        } catch (emailError) {
            await User.findByIdAndDelete(user._id);

            return res.status(500).json({
                message: 'Email could not be sent. Please try again.'
            });
        }

        res.status(201).json({
            message: 'Registration successful. OTP sent to your email.'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Registration failed'
        });
    }
};

// VERIFY OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({
            email: email?.toLowerCase()
        });

        if (!user || !user.otpHash || !user.otpExpires ||
            user.otpExpires < Date.now()) {
            return res.status(400).json({
                message: 'Invalid or expired OTP'
            });
        }

        const validOTP = await bcrypt.compare(otp, user.otpHash);

        if (!validOTP) {
            return res.status(400).json({
                message: 'Incorrect OTP'
            });
        }

        user.isVerified = true;
        user.otpHash = null;
        user.otpExpires = null;

        await user.save();

        res.json({
            message: 'Email verified successfully. You can login now.'
        });

    } catch (error) {
        res.status(500).json({
            message: 'OTP verification failed'
        });
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({
            email: email?.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: 'Please verify your email first'
            });
        }

        const token = generateToken(user._id);

        res.json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Login failed'
        });
    }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({
            email: email?.toLowerCase()
        });

        if (!user || !user.isVerified) {
            return res.status(404).json({
                message: 'Verified account not found'
            });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();

        user.otpHash = await bcrypt.hash(otp, 10);
        user.otpExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Customer Support - Password Reset',
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`
        });

        res.json({
            message: 'Password reset OTP sent to your email'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Could not send reset OTP'
        });
    }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword || newPassword.length < 8) {
            return res.status(400).json({
                message: 'Enter email, OTP and a password of at least 8 characters'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user || !user.otpHash || !user.otpExpires ||
            user.otpExpires < Date.now()) {
            return res.status(400).json({
                message: 'Invalid or expired OTP'
            });
        }

        const validOTP = await bcrypt.compare(otp, user.otpHash);

        if (!validOTP) {
            return res.status(400).json({
                message: 'Incorrect OTP'
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        user.otpHash = null;
        user.otpExpires = null;

        await user.save();

        res.json({
            message: 'Password reset successful'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Password reset failed'
        });
    }
};
