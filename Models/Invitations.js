const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'video', 'audio'], required: true },
    url: { type: mongoose.Schema.Types.Mixed, required: true },

    caption: { type: String }
});

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    mood: { type: String },
    category: { type: String },
    media: [mediaSchema]
});

const invitationSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    diaryDate: { type: String, required: true }, // ISO date string
    diaryContent: {
        events: [eventSchema],
        isPublic: { type: Boolean, default: false },
        sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Invitation', invitationSchema);