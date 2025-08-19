const mongoose = require('mongoose');
const { Mood } = require('./CategoryMood'); // your mood model

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  media: [{
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' }
  }],
  category: { type: String, required: true },  // admin-defined
  mood: { type: String, required: true },      // admin-defined
  moodEmoji: { type: String, default: '😐' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook dynamically sets moodEmoji from admin-defined collections
eventSchema.pre('save', async function(next) {
  const moodObj = await Mood.findOne({ name: this.mood });
  if (moodObj && Array.isArray(moodObj.emojis)) {
    this.moodEmoji = moodObj.emojis[Math.floor(Math.random() * moodObj.emojis.length)];
  }
  this.updatedAt = Date.now();
  next();
});
const diarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },  // e.g., "2025-08-15"
  events: [eventSchema]
}, { timestamps: true });

module.exports = mongoose.model('Diary', diarySchema);
