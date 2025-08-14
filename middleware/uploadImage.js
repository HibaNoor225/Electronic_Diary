// middleware/uploadImage.js
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/profilePhotos');
        fs.mkdirSync(uploadPath, { recursive: true }); // create folder if not exists
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, filename);
    }
});

// File filter
function fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
}

// Max file size 2MB
const upload = multer({ 
    storage, 
    fileFilter, 
    limits: { fileSize: 2 * 1024 * 1024 } 
}).single('profilePhoto'); // accept only single file

// Validate dimensions
const validateImageDimensions = async (req, res, next) => {
    if (!req.file) return next(); // no file uploaded

    try {
        const metadata = await sharp(req.file.path).metadata();

        if (metadata.width < 100 || metadata.height < 100) {
            fs.unlinkSync(req.file.path); // delete file
            return res.status(400).json({ result: 'failure', message: 'Image must be at least 100x100 pixels' });
        }

        if (metadata.width > 2000 || metadata.height > 2000) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ result: 'failure', message: 'Image must be smaller than 2000x2000 pixels' });
        }

        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ result: 'failure', message: 'Error processing image' });
    }
};

module.exports = { upload, validateImageDimensions };
