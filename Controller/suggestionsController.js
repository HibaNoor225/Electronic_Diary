const Suggestion = require("../Models/Suggestions");

// Suggest a new category
exports.suggestCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Category name is required" });

        await Suggestion.create({
            type: "category",
            name,
            createdBy: req.info.email || "Anonymous"
        });

        return res.status(200).json({ message: "Category suggestion saved and admin notified" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to save suggestion" });
    }
};

// Suggest a new mood
exports.suggestMood = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Mood name is required" });

        await Suggestion.create({
            type: "mood",
            name,
            createdBy: req.info.email || "Anonymous"
        });

        return res.status(200).json({ message: "Mood suggestion saved and admin notified" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to save suggestion" });
    }
};

// Get latest suggestions
exports.getSuggestions = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    try {
        const suggestions = await Suggestion.find()
            .sort({ createdAt: -1 })
            .limit(limit);

        res.json({ success: true, data: suggestions });
    } catch (err) {
        console.error('Error fetching suggestions:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
