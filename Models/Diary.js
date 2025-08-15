const mongoose = require('mongoose');

// Category colors mapping
const categoryColors = {
  Work: '#9e741fff',      // Red-Orange
  Personal: '#f0dfadff',    // Green
  Family: '#d9667bff',       // Gold
  Travel: '#a8f07fff',  
  Hobby: '#93ccf0ff',   // Blue-Violet
  Other: '#CCCCCC'      // Default gray
};

// Mood emoji mapping (multiple options per mood)
const moodEmojis = {
  Happy: ['😊', '😁', '😄'],
  Sad: ['😢', '😔', '😞'],
  Excited: ['🤩', '😃', '😎'],
  Relaxed: ['😌', '😴', '🧘'],
  Stressed: ['😣', '😖', '😫'],
  Neutral: ['😐', '😶', '😑']
};

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
 media: [{
  url: { type: String, required: true },   // file path
  caption: { type: String, default: '' },  // short description
  type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' }
}],
  // Array of file paths (images, videos, audio)
  category: { 
    type: String, 
    enum: ['Work', 'Personal', 'Travel', 'Family', 'Hobby','Other'], 
    default: 'Other' 
  },
  color: { type: String, default: '#CCCCCC' },
  mood: {
    type: String,
    enum: ['Happy', 'Sad', 'Excited', 'Relaxed', 'Stressed', 'Neutral'],
    default: 'Neutral'
  },
  moodEmoji: { type: String, default: '😐' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to set color and moodEmoji dynamically
eventSchema.pre('save', function(next) {
  // Set color based on category
  this.color = categoryColors[this.category] || '#CCCCCC';

  // Set moodEmoji based on mood
  const emojis = moodEmojis[this.mood];
  this.moodEmoji = Array.isArray(emojis) ? emojis[Math.floor(Math.random() * emojis.length)] : emojis;

  this.updatedAt = Date.now();
  next();
});

const diarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },  // e.g., "2025-08-15"
  events: [eventSchema]
}, { timestamps: true });

module.exports = mongoose.model('Diary', diarySchema);
