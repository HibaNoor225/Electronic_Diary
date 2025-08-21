const { Category, Mood } = require('../Models/CategoryMood');
const Diary = require('../Models/Diary');
const User = require('../Models/User');
const Record = require('../Models/Record'); // <-- import record model
const { sendSuccess, sendError } = require('../utils/responseFormatter');

// Helper function to log activity
async function logActivity(userId, detail) {
    try {
        if (!userId) return; // skip if no user
        await Record.create({ user: userId, detail, date: new Date() });
    } catch (err) {
        console.error('[ActivityLog] Failed to log activity:', err.message);
    }
}

class CategoryMoodController {
  // ----------------- USER CUSTOM -----------------
  async getUserCustomCategories(req, res) {
    try {
      const userId = req.params.userId;
      const diaries = await Diary.find({ userId });
      const customCategories = [...new Set(diaries.map(d => d.customCategory).filter(Boolean))];

      await logActivity(userId, "Fetched custom categories");

      res.json({ success: true, data: customCategories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getUserCustomMoods(req, res) {
    try {
      const userId = req.params.userId;
      const diaries = await Diary.find({ userId });
      const customMoods = [...new Set(diaries.map(d => d.customMood).filter(Boolean))];

      await logActivity(userId, "Fetched custom moods");

      res.json({ success: true, data: customMoods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ================== GET ALL ACTIVE MOODS ==================
  async getAllMoods(req, res) {
    try {
      const moods = await Mood.find({ isActive: true });

      await logActivity(req.info.id, "Fetched all active moods");

      res.json({ success: true, data: moods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

 

  // ================== GET ALL ACTIVE CATEGORIES ==================
  async getAllCategories(req, res) {
    try {
      const categories = await Category.find({ isActive: true });

      await logActivity(req.info.id, "Fetched all active categories");

      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
async getAllC(req, res) {
    try {
        const categories = await Category.find();

        // Safe logging: only log if req.info exists
        if (req.info && req.info.id) {
            await logActivity(req.info.id, "Fetched all categories");
        }

        res.json({ success: true, data: categories });
    } catch (err) {
        console.error('Error fetching all categories:', err); // <-- log full error
        res.status(500).json({ success: false, message: err.message });
    }
}

async getAllM(req, res) {
    try {
        const moods = await Mood.find();

        if (req.info && req.info.id) {
            await logActivity(req.info.id, "Fetched all moods");
        }

        res.json({ success: true, data: moods });
    } catch (err) {
        console.error('Error fetching all moods:', err); // <-- log full error
        res.status(500).json({ success: false, message: err.message });
    }
}


  async addCategory(req, res) {
    try {
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      const existing = await Category.findOne({ name });
      if (existing) return res.status(400).json({ success: false, message: 'Category already exists' });

      const category = new Category({ name, color });
      await category.save();

      await logActivity(req.info.id, `Added category ${name}`);

      res.json({ success: true, data: category });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      const category = await Category.findByIdAndUpdate(id, { name, color }, { new: true });
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      await logActivity(req.info.id, `Updated category ${name} (ID: ${id})`);

      res.json({ success: true, data: category });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const category = await Category.findByIdAndDelete(id);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      await logActivity(req.info.id, `Deleted category ${category.name} (ID: ${id})`);

      res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ----------------- MOOD -----------------
  async addMood(req, res) {
    try {
      const { name, icon } = req.body;
      if (!name || !icon) return res.status(400).json({ success: false, message: 'Name and icon required' });

      const existing = await Mood.findOne({ name });
      if (existing) return res.status(400).json({ success: false, message: 'Mood already exists' });

      const mood = new Mood({ name, icon });
      await mood.save();

      await logActivity(req.info.id, `Added mood ${name}`);

      res.json({ success: true, data: mood });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateMood(req, res) {
    try {
      const { id } = req.params;
      const { name, icon } = req.body;
      const mood = await Mood.findByIdAndUpdate(id, { name, icon }, { new: true });
      if (!mood) return res.status(404).json({ success: false, message: 'Mood not found' });

      await logActivity(req.info.id, `Updated mood ${name} (ID: ${id})`);

      res.json({ success: true, data: mood });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteMood(req, res) {
    try {
      const { id } = req.params;
      const mood = await Mood.findByIdAndDelete(id);
      if (!mood) return res.status(404).json({ success: false, message: 'Mood not found' });

      await logActivity(req.info.id, `Deleted mood ${mood.name} (ID: ${id})`);

      res.json({ success: true, message: 'Mood deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await User.find().select('-password');

      await logActivity(req.info.id, "Fetched all users");

      return sendSuccess(res, 'Users fetched successfully', users);
    } catch (err) {
      console.error(err);
      return sendError(res, 'Failed to fetch users', 500);
    }
  }

  // Deactivate a user (admin only)
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const user = await User.findById(id);

      if (!user) return sendError(res, 'User not found', 404);

      user.isActive = isActive;
      await user.save();

      const action = isActive ? 'activated' : 'deactivated';

      await logActivity(req.info.id, `User ${user.email} has been ${action}`);

      return sendSuccess(res, `User ${user.email} has been ${action}`);
    } catch (err) {
      console.error(err);
      return sendError(res, 'Failed to update user status', 500);
    }
  }
}

module.exports = new CategoryMoodController();
