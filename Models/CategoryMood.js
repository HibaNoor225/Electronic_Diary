const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, default: '#CCCCCC' },
  isActive: { type: Boolean, default: true } 
});

const moodSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  emojis: { type: [String], default: ['😐'] },
  isActive: { type: Boolean, default: true }
});

const Category = mongoose.model('Category', categorySchema);
const Mood = mongoose.model('Mood', moodSchema);

module.exports = { Category, Mood };
