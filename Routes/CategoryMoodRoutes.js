const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const controller = require('../Controller/CategoryMoodController');

// ---- CATEGORY ROUTES ----
router.get('/categories', controller.getAllCategories.bind(controller));
router.post('/category', adminAuth, controller.addCategory.bind(controller));
router.put('/category/:id', adminAuth, controller.updateCategory.bind(controller));
router.delete('/category/:id', adminAuth, controller.deleteCategory.bind(controller));

// ---- MOOD ROUTES ----
router.get('/moods', controller.getAllMoods.bind(controller));
router.post('/mood', adminAuth, controller.addMood.bind(controller));
router.put('/mood/:id', adminAuth, controller.updateMood.bind(controller));
router.delete('/mood/:id', adminAuth, controller.deleteMood.bind(controller));

// ---- USER CUSTOM ----
router.get('/user/:userId/customCategories', controller.getUserCustomCategories.bind(controller));
router.get('/user/:userId/customMoods', controller.getUserCustomMoods.bind(controller));

module.exports = router;
