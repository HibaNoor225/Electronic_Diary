const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const Diary = require('../Models/Diary');
const Invitation = require('../Models/Invitations');
const mongoose=require("mongoose")

const adminAuth = require('../middleware/adminAuth');
const controller = require('../Controller/CategoryMoodController');
const verifyToken=require("../middleware/authMiddleware")

// ---- CATEGORY ROUTES ----
router.get('/categories', controller.getAllCategories.bind(controller));
router.get('/all/categories', controller.getAllC.bind(controller));
router.post('/category', verifyToken,adminAuth, controller.addCategory.bind(controller));
router.put('/category/:id', verifyToken,adminAuth, controller.updateCategory.bind(controller));
router.delete('/category/:id', verifyToken,adminAuth, controller.deleteCategory.bind(controller));

// ---- MOOD ROUTES ----
router.get('/moods', controller.getAllMoods.bind(controller));
router.get('/all/moods', controller.getAllM.bind(controller));

router.post('/mood',verifyToken, adminAuth, controller.addMood.bind(controller));
router.put('/mood/:id', verifyToken,adminAuth, controller.updateMood.bind(controller));
router.delete('/mood/:id',verifyToken, adminAuth, controller.deleteMood.bind(controller));

// ---- USER CUSTOM ----
router.get('/user/:userId/customCategories', controller.getUserCustomCategories.bind(controller));
router.get('/user/:userId/customMoods', controller.getUserCustomMoods.bind(controller));


router.get('/users', verifyToken,adminAuth, controller.getAllUsers.bind(controller));
router.put('/user/:id/deactivate',verifyToken, adminAuth, controller.deactivateUser.bind(controller));


//// ------------------ Send invitations ------------------
router.post('/invitations', verifyToken, async (req, res) => {
    const { recipientIds, diaryDate } = req.body;

    if (!recipientIds || !Array.isArray(recipientIds) || !diaryDate) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    try {
        const userId = req.info.id; // from token

        // Find diary for the logged-in user
        const diary = await Diary.findOne({ user: userId, date: diaryDate });
        if (!diary) {
            return res.status(404).json({ success: false, message: 'Diary not found' });
        }

        // Filter out invalid recipient IDs (optional, but safer)
        const validRecipients = recipientIds.filter(id => mongoose.Types.ObjectId.isValid(id));

        // Update diary's sharedWith field in **one step**
        diary.sharedWith = Array.from(new Set([...diary.sharedWith.map(String), ...validRecipients]));
        await diary.save();

        // Prepare invitations with plain JSON diary content
        const diaryJSON = diary.toObject(); // converts Mongoose doc to plain JS object
        // Create invitations with full diary content
const invitations = recipientIds.map(recipientId => ({
    senderId: userId,
    recipientId,
    diaryDate,
    diaryContent: {
        events: diary.events.map(e => ({
            title: e.title,
            description: e.description,
            mood: e.mood,
            category: e.category,
            moodEmoji: e.moodEmoji,
            media: e.media.map(m => ({
                type: m.type,
                url: m.url,  // now Mixed, works for objects
                caption: m.caption || ''
            })),
            createdAt: e.createdAt,
            updatedAt: e.updatedAt
        })),
        isPublic: diary.isPublic,
        sharedWith: diary.sharedWith, // ObjectIds now
        createdAt: diary.createdAt,
        updatedAt: diary.updatedAt
    }
}));


        // Insert invitations
        await Invitation.insertMany(invitations);

        res.json({ success: true, message: 'Invitations sent successfully' });
    } catch (err) {
        console.error('Error sending invitations:', err);
        res.status(500).json({ success: false, message: 'Error sending invitations' });
    }
});


// ------------------ Get sent or received invitations ------------------
router.get('/invitations/:type', verifyToken, async (req, res) => {
    const { type } = req.params;

    if (!['sent', 'received'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    try {
        const userId = req.info.id; // decoded user ID from token
        const query = type === 'sent' ? { senderId: userId } : { recipientId: userId };

        const invitations = await Invitation.find(query)
            .populate('senderId', 'username')
            .populate('recipientId', 'username')
            .lean();

        res.json({ success: true, invitations });
    } catch (err) {
        console.error(`Error fetching ${type} invitations:`, err);
        res.status(500).json({ success: false, message: `Error fetching ${type} invitations` });
    }
});

// ------------------ Get diary from invitation ------------------
router.get('/invitation-diary/:date', verifyToken, async (req, res) => {
    const { date } = req.params;
    const { senderId } = req.query; // the user who sent the invitation
    const userId = req.info.id;

    try {
        if (!senderId) {
            return res.status(400).json({ success: false, message: 'Sender ID is required' });
        }

        // Find the invitation
        const invitation = await Invitation.findOne({
            recipientId: userId,
            senderId: senderId,
            diaryDate: date
        }).lean();

        if (!invitation) {
            return res.status(404).json({ success: false, message: 'No invitation found for this diary' });
        }

        res.json({ success: true, data: invitation.diaryContent });
    } catch (err) {
        console.error('Error fetching diary from invitation:', err);
        res.status(500).json({ success: false, message: 'Error fetching diary from invitation' });
    }
});



module.exports = router;
