

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const Ticket = require('../models/Ticket');
const User = require('../models/User');

const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Check ticket access
function canAccessTicket(ticket, user) {
    return (
        user.role === 'admin' ||
        (
            user.role === 'customer' &&
            ticket.customer?.toString() === user._id.toString()
        ) ||
        (
            user.role === 'agent' &&
            ticket.assignedTo?.toString() === user._id.toString()
        )
    );
}

// Find ticket and check permission
const checkTicketAccess = async (req, res, next) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                message: 'Ticket not found'
            });
        }

        if (!canAccessTicket(ticket, req.user)) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        req.ticket = ticket;
        next();

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Handle file upload errors
const handleUpload = (req, res, next) => {
    upload.single('attachment')(req, res, (error) => {
        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        next();
    });
};

// Get tickets based on user role
router.get('/', protect, async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'customer') {
            filter.customer = req.user._id;
        } else if (req.user.role === 'agent') {
            filter.assignedTo = req.user._id;
        }

        const tickets = await Ticket.find(filter)
            .populate('customer', 'name email')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        res.json(tickets);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Create ticket - Customers only
router.post('/', protect, authorize('customer'), async (req, res) => {
    try {
        const { subject, message, priority } = req.body;

        if (!subject || !message || !subject.trim() || !message.trim()) {
            return res.status(400).json({
                message: 'Subject and message are required'
            });
        }

        const validPriorities = ['Low', 'Medium', 'High'];

        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                message: 'Invalid ticket priority'
            });
        }

        const ticket = await Ticket.create({
            customerName: req.user.name,
            email: req.user.email,
            customer: req.user._id,
            subject: subject.trim(),
            message: message.trim(),
            priority: priority || 'Medium'
        });

        res.status(201).json(ticket);

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
});

// Update ticket - Agents and Admins
router.put('/:id', protect, authorize('agent', 'admin'), async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                message: 'Ticket not found'
            });
        }

        if (
            req.user.role === 'agent' &&
            ticket.assignedTo?.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                message: 'You can update only your assigned tickets'
            });
        }

        const allowedUpdates = {};

        if (req.body.status !== undefined) {
            const validStatuses = [
                'Open',
                'In Progress',
                'Resolved',
                'Closed'
            ];

            if (!validStatuses.includes(req.body.status)) {
                return res.status(400).json({
                    message: 'Invalid ticket status'
                });
            }

            allowedUpdates.status = req.body.status;
        }

        if (req.body.priority !== undefined) {
            const validPriorities = ['Low', 'Medium', 'High'];

            if (!validPriorities.includes(req.body.priority)) {
                return res.status(400).json({
                    message: 'Invalid ticket priority'
                });
            }

            allowedUpdates.priority = req.body.priority;
        }

        if (req.body.assignedTo !== undefined) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    message: 'Only admins can assign tickets'
                });
            }

            const agent = await User.findOne({
                _id: req.body.assignedTo,
                role: 'agent'
            });

            if (!agent) {
                return res.status(400).json({
                    message: 'Please select a valid agent'
                });
            }

            allowedUpdates.assignedTo = agent._id;
        }

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({
                message: 'No valid updates provided'
            });
        }

        Object.assign(ticket, allowedUpdates);
        await ticket.save();

        await ticket.populate('assignedTo', 'name email');

        res.json({
            message: 'Ticket updated successfully',
            ticket
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
});

// Delete ticket - Admin only
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                message: 'Ticket not found'
            });
        }

        res.json({
            message: 'Ticket deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Add reply to ticket
router.post('/:id/replies', protect, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                message: 'Reply message is required'
            });
        }

        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                message: 'Ticket not found'
            });
        }

        if (!canAccessTicket(ticket, req.user)) {
            return res.status(403).json({
                message: 'You cannot reply to this ticket'
            });
        }

        if (ticket.status === 'Closed') {
            return res.status(400).json({
                message: 'This ticket is closed'
            });
        }

        ticket.replies.push({
            sender: req.user._id,
            message: message.trim()
        });

        await ticket.save();

        res.status(201).json({
            message: 'Reply added successfully',
            ticket
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Dashboard statistics
router.get('/dashboard/stats', protect, async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'customer') {
            filter.customer = req.user._id;
        } else if (req.user.role === 'agent') {
            filter.assignedTo = req.user._id;
        }

        const total = await Ticket.countDocuments(filter);

        const open = await Ticket.countDocuments({
            ...filter,
            status: 'Open'
        });

        const inProgress = await Ticket.countDocuments({
            ...filter,
            status: 'In Progress'
        });

        const resolved = await Ticket.countDocuments({
            ...filter,
            status: 'Resolved'
        });

        const closed = await Ticket.countDocuments({
            ...filter,
            status: 'Closed'
        });

        res.json({
            total,
            open,
            inProgress,
            resolved,
            closed
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Search and filter tickets
router.get('/search', protect, async (req, res) => {
    try {
        const filter = {};

        if (req.user.role === 'customer') {
            filter.customer = req.user._id;
        } else if (req.user.role === 'agent') {
            filter.assignedTo = req.user._id;
        }

        const validStatuses = [
            'Open',
            'In Progress',
            'Resolved',
            'Closed'
        ];

        const validPriorities = ['Low', 'Medium', 'High'];

        if (req.query.status) {
            if (!validStatuses.includes(req.query.status)) {
                return res.status(400).json({
                    message: 'Invalid ticket status'
                });
            }

            filter.status = req.query.status;
        }

        if (req.query.priority) {
            if (!validPriorities.includes(req.query.priority)) {
                return res.status(400).json({
                    message: 'Invalid ticket priority'
                });
            }

            filter.priority = req.query.priority;
        }

        if (req.query.search) {
            const safeSearch = req.query.search.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );

            filter.$or = [
                {
                    subject: {
                        $regex: safeSearch,
                        $options: 'i'
                    }
                },
                {
                    message: {
                        $regex: safeSearch,
                        $options: 'i'
                    }
                },
                {
                    customerName: {
                        $regex: safeSearch,
                        $options: 'i'
                    }
                }
            ];
        }

        const tickets = await Ticket.find(filter)
            .populate('customer', 'name email')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });

        res.json(tickets);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Upload attachment - check permission before saving file
router.post(
    '/:id/attachments',
    protect,
    checkTicketAccess,
    handleUpload,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message: 'Please select a valid file'
                });
            }

            req.ticket.attachments.push({
                filename: req.file.originalname,
                path: req.file.filename
            });

            await req.ticket.save();

            res.status(201).json({
                message: 'File uploaded successfully',
                attachments: req.ticket.attachments
            });

        } catch (error) {
            if (req.file) {
                fs.unlink(
                    path.join(__dirname, '..', 'uploads', req.file.filename),
                    () => {}
                );
            }

            res.status(500).json({
                message: error.message
            });
        }
    }
);

// Download attachment
router.get(
    '/:id/attachments/:filename',
    protect,
    checkTicketAccess,
    async (req, res) => {
        try {
            const attachment = req.ticket.attachments.find(
                file => file.path === req.params.filename
            );

            if (!attachment) {
                return res.status(404).json({
                    message: 'File not found'
                });
            }

            const uploadDirectory = path.resolve(
                __dirname,
                '..',
                'uploads'
            );

            const filePath = path.resolve(
                uploadDirectory,
                attachment.path
            );

            if (!filePath.startsWith(uploadDirectory + path.sep)) {
                return res.status(400).json({
                    message: 'Invalid file path'
                });
            }

            res.download(filePath, attachment.filename, (error) => {
                if (error && !res.headersSent) {
                    res.status(404).json({
                        message: 'Unable to download file'
                    });
                }
            });

        } catch (error) {
            res.status(500).json({
                message: error.message
            });
        }
    }
);

// Get one ticket with replies and attachments
router.get('/:id', protect, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate('customer', 'name email')
            .populate('assignedTo', 'name email')
            .populate('replies.sender', 'name role');

        if (!ticket) {
            return res.status(404).json({
                message: 'Ticket not found'
            });
        }

        if (!canAccessTicket(ticket, req.user)) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        res.json(ticket);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;
