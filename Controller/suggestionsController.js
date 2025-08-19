// Suggest a new category
const sendAdminNotification = require('../utils/sendAdminNotifications');
exports.suggestCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Category name is required" });

        await sendAdminNotification({
            type: "category",
            name,
            createdBy: req.info.email || "Anonymous",
            createdAt: new Date()
        });

        return res.status(200).json({ message: "Category suggestion sent to admin" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to send suggestion" });
    }
};

// Suggest a new mood
exports.suggestMood = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Mood name is required" });

        await sendAdminNotification({
            type: "mood",
            name,
            createdBy: req.info.email || "Anonymous",
            createdAt: new Date()
        });

        return res.status(200).json({ message: "Mood suggestion sent to admin" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to send suggestion" });
    }
};
