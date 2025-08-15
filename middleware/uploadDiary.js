const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.info || !req.info.id) {
      return cb(new Error('User info not found'), null);
    }
    const uploadPath = path.join(__dirname, '..', 'uploads', 'diary', req.info.id.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

function fileFilter(req, file, cb) {
  const allowedExts = /jpeg|jpg|png|gif|mp4|mov|webm|mp3|wav|ogg/;
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'video/mp4', 'video/mov', 'video/webm',
    'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg'
  ];

  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimes.includes(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images, videos, and audio files are allowed'));
  }
}


// Corrected: Use .array() instead of .single() to match the routes
const uploadDiary = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } 
}).array('media', 10); // Accept up to 10 files named 'media'

const resizeDiaryImage = async (req, res, next) => {
  // Logic to handle multiple files
  if (!req.files || req.files.length === 0) return next();

  // Process each file
  await Promise.all(req.files.map(async (file) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!imageTypes.includes(file.mimetype)) return; // Skip videos/audio

    const filePath = file.path;
    const outputFile = path.join(path.dirname(filePath), 'resized-' + path.basename(filePath));

    try {
      await sharp(filePath)
        .resize({ width: 1200, height: 1200, fit: 'inside' })
        .toFile(outputFile);

      fs.unlinkSync(filePath);
      file.path = outputFile;
    } catch (err) {
      console.error(err);
      throw new Error('Error processing image');
    }
  }));

  next();
};

module.exports = uploadDiary;