const User = require('./Models/User'); 
const { Category, Mood } = require('./Models/CategoryMood');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedAdminAndData() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD || '@Hiba1122';

    if (!adminEmail) {
      console.error('ADMIN_EMAIL is not defined in the .env file. Skipping admin seeding.');
      return;
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const admin = new User({
        username: 'admin',
        email: adminEmail,
        password: adminPassword, // pre-save will hash it
        role: 'admin',
        isAdmin: true,
        isActive: true
    });
    await admin.save();
    console.log('Admin user created!');
}

     else {
      console.log('Admin already exists, skipping.');
    }

    // Seed categories if empty
    const catCount = await Category.countDocuments();
    if (catCount === 0) {
      await Category.insertMany([
        { name: 'Work', color: '#9e741fff' },
        { name: 'Personal', color: '#f0dfadff' },
        { name: 'Family', color: '#d9667bff' },
        { name: 'Travel', color: '#a8f07fff' },
        { name: 'Hobby', color: '#93ccf0ff' },
        { name: 'Other', color: '#CCCCCC' }
      ]);
      console.log('Categories seeded!');
    }

    // Seed moods if empty
    const moodCount = await Mood.countDocuments();
    if (moodCount === 0) {
      await Mood.insertMany([
        { name: 'Happy', emojis: ['😊', '😁', '😄'] },
        { name: 'Sad', emojis: ['😢', '😔', '😞'] },
        { name: 'Excited', emojis: ['🤩', '😃', '😎'] },
        { name: 'Relaxed', emojis: ['😌', '😴', '🧘'] },
        { name: 'Stressed', emojis: ['😣', '😖', '😫'] },
        { name: 'Neutral', emojis: ['😐', '😶', '😑'] }
      ]);
      console.log('Moods seeded!');
    }

  } catch (err) {
    console.error('Seeding error:', err);
  }
}

module.exports = seedAdminAndData;
