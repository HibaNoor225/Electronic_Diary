const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },      // Event name, e.g., "Sad Day"
    description: { type: String, default: '' },   // Optional notes
    media: [{ type: String }],                    // Array of file paths (images, videos, audio)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const diarySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },       // e.g., "2025-08-13"
    events: [eventSchema]
}, { timestamps: true });

module.exports = mongoose.model('Diary', diarySchema);
