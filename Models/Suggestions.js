const mongoose = require('mongoose');
const sendAdminNotification = require('../utils/sendAdminNotifications');

const suggestionSchema = new mongoose.Schema({
    type: { type: String, enum: ['category', 'mood'], required: true },
    name: { type: String, required: true },
    createdBy: { type: String, required: true }, // username/email
    createdAt: { type: Date, default: Date.now }
});

// Post-save hook to notify admin
suggestionSchema.post('save', async function (doc) {
    try {
        await sendAdminNotification({
            type: doc.type,
            name: doc.name,
            createdBy: doc.createdBy,
            createdAt: doc.createdAt
        });
        console.log(`✅ Admin notified about new ${doc.type}: ${doc.name}`);
    } catch (err) {
        console.error("❌ Failed to send suggestion email:", err);
    }
});

module.exports = mongoose.model('Suggestion', suggestionSchema);
