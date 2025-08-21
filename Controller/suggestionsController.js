const Suggestion = require("../Models/Suggestions");
const Record = require("../Models/Record"); // Activity log model

// Helper to log user activity
async function logActivity(userId, detail) {
  try {
    const record = new Record({ user: userId, detail, date: new Date() });
    await record.save();
    console.log(`[ActivityLog] User: ${userId}, Detail: ${detail}`);
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}

// Suggest a new category
exports.suggestCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });

    const suggestion = await Suggestion.create({
      type: "category",
      name,
      createdBy: req.info.email || "Anonymous"
    });

    await logActivity(req.info.id || "Anonymous", `Suggested new category: "${name}"`);

    return res.status(200).json({ message: "Category suggestion saved and admin notified", suggestion });
  } catch (err) {
    console.error('suggestCategory error:', err);
    await logActivity(req.info.id || "Anonymous", `Failed to suggest category: ${err.message}`);
    return res.status(500).json({ message: "Failed to save suggestion" });
  }
};

// Suggest a new mood
exports.suggestMood = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Mood name is required" });

    const suggestion = await Suggestion.create({
      type: "mood",
      name,
      createdBy: req.info.email || "Anonymous"
    });

    await logActivity(req.info.id || "Anonymous", `Suggested new mood: "${name}"`);

    return res.status(200).json({ message: "Mood suggestion saved and admin notified", suggestion });
  } catch (err) {
    console.error('suggestMood error:', err);
    await logActivity(req.info.id || "Anonymous", `Failed to suggest mood: ${err.message}`);
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

    await logActivity(req.info.id || "Anonymous", `Fetched latest ${limit} suggestions`);

    res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('getSuggestions error:', err);
    await logActivity(req.info.id || "Anonymous", `Failed to fetch suggestions: ${err.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
