
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get all users - Admin only
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -otpHash -otpExpires')
            .sort({ createdAt: -1 });

        res.json(users);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Update user role - Admin only
router.put('/:id/role', protect, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;

        const validRoles = ['customer', 'agent', 'admin'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                message: 'Invalid user role'
            });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({
                message: 'You cannot change your own role'
            });
        }

        const targetUser = await User.findById(req.params.id);

        if (!targetUser) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        if (targetUser.role === 'admin' && role !== 'admin') {
            const adminCount = await User.countDocuments({
                role: 'admin'
            });

            if (adminCount <= 1) {
                return res.status(400).json({
                    message: 'Cannot remove the last admin'
                });
            }
        }

        targetUser.role = role;
        await targetUser.save();

        res.json({
            message: 'User role updated successfully',
            user: {
                id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;
