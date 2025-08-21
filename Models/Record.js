// models/Record.js
const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    detail: { type: String, required: true } // e.g., "Logged in", "Deleted a record", etc.
});

module.exports = mongoose.model('Record', recordSchema);
