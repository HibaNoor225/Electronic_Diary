const mongoose = require('mongoose');
const { Mood } = require('./CategoryMood'); // your mood model

const mediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' },
  caption: { type: String, default: '' },
  url: {
    type: mongoose.Schema.Types.Mixed, // allow object for images, string for video/audio
    required: true
  }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  media: [mediaSchema],
  category: { type: String, required: true },  // admin-defined
  mood: { type: String, required: true },      // admin-defined
  moodEmoji: { type: String, default: '😐' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook dynamically sets moodEmoji from admin-defined collection
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
  isPublic: { type: Boolean, default: false },
   sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],

  events: [eventSchema]
}, { timestamps: true });

module.exports = mongoose.model('Diary', diarySchema);
