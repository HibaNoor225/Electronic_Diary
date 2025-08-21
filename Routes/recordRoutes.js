// routes/recordRoutes.js
const express = require('express');
const router = express.Router();
const Record = require('../Models/Record');

// Add a new record
router.post('/add', async (req, res) => {
    try {
        const { userId, detail } = req.body;
        const record = new Record({ userId, detail });
        await record.save();
        res.status(201).json({ message: 'Record added successfully', record });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding record', error });
    }
});

// Get all records
router.get('/', async (req, res) => {
    try {
        const records = await Record.find().populate('userId', 'username email'); // adjust fields if needed
        res.status(200).json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching records', error });
    }
});

module.exports = router;
