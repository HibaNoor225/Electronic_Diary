const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const controller = require('../Controller/CategoryMoodController');
const verifyToken=require("../middleware/authMiddleware")

// ---- CATEGORY ROUTES ----
router.get('/categories', controller.getAllCategories.bind(controller));
router.post('/category', verifyToken,adminAuth, controller.addCategory.bind(controller));
router.put('/category/:id', verifyToken,adminAuth, controller.updateCategory.bind(controller));
router.delete('/category/:id', verifyToken,adminAuth, controller.deleteCategory.bind(controller));

// ---- MOOD ROUTES ----
router.get('/moods', controller.getAllMoods.bind(controller));
router.post('/mood',verifyToken, adminAuth, controller.addMood.bind(controller));
router.put('/mood/:id', verifyToken,adminAuth, controller.updateMood.bind(controller));
router.delete('/mood/:id',verifyToken, adminAuth, controller.deleteMood.bind(controller));

// ---- USER CUSTOM ----
router.get('/user/:userId/customCategories', controller.getUserCustomCategories.bind(controller));
router.get('/user/:userId/customMoods', controller.getUserCustomMoods.bind(controller));


router.get('/users', verifyToken,adminAuth, controller.getAllUsers.bind(controller));
router.put('/user/:id/deactivate',verifyToken, adminAuth, controller.deactivateUser.bind(controller));

module.exports = router;
