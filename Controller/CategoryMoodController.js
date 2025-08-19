const { Category, Mood } = require('../Models/CategoryMood');
const Diary = require('../Models/Diary');

class CategoryMoodController {
  // ----------------- USER CUSTOM -----------------
  async getUserCustomCategories(req, res) {
    try {
      const userId = req.params.userId;
      const diaries = await Diary.find({ userId });
      const customCategories = [...new Set(diaries.map(d => d.customCategory).filter(Boolean))];
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
      res.json({ success: true, data: customMoods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ----------------- CATEGORY -----------------
  async getAllCategories(req, res) {
    try {
      const categories = await Category.find();
      res.json({ success: true, data: categories });
    } catch (err) {
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
      res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ----------------- MOOD -----------------
  async getAllMoods(req, res) {
    try {
      const moods = await Mood.find();
      res.json({ success: true, data: moods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async addMood(req, res) {
    try {
      const { name, emojis } = req.body;
      if (!name || !emojis) return res.status(400).json({ success: false, message: 'Name and emojis required' });

      const existing = await Mood.findOne({ name });
      if (existing) return res.status(400).json({ success: false, message: 'Mood already exists' });

      const mood = new Mood({ name, emojis });
      await mood.save();
      res.json({ success: true, data: mood });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateMood(req, res) {
    try {
      const { id } = req.params;
      const { name, emojis } = req.body;
      const mood = await Mood.findByIdAndUpdate(id, { name, emojis }, { new: true });
      if (!mood) return res.status(404).json({ success: false, message: 'Mood not found' });
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
      res.json({ success: true, message: 'Mood deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new CategoryMoodController();
