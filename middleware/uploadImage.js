const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/profilePhotos');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
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

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
}).single('profilePhoto');

// Process 3 versions
const processProfilePhoto = async (req, res, next) => {
    if (!req.file) return next();

    const uploadDir = path.dirname(req.file.path);
    const filename = path.basename(req.file.path, path.extname(req.file.path));
    const ext = path.extname(req.file.path);

    try {
        // Thumbnail 100x100
        const thumbPath = path.join(uploadDir, `${filename}-thumb${ext}`);
        await sharp(req.file.path)
            .resize(100, 100, { fit: 'cover' })
            .toFile(thumbPath);

        // Optimized 400x400
        const optimizedPath = path.join(uploadDir, `${filename}-optimized${ext}`);
        await sharp(req.file.path)
            .resize(400, 400, { fit: 'inside' })
            .toFile(optimizedPath);

        // Compressed original max 800x800
        const compressedPath = path.join(uploadDir, `${filename}-original${ext}`);
        await sharp(req.file.path)
            .resize(800, 800, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(compressedPath);

        // Remove uploaded original to avoid duplicate storage
        //fs.unlinkSync(req.file.path);

        // Pass paths to controller
        req.file.paths = {
            thumbnail: thumbPath,
            optimized: optimizedPath,
            original: compressedPath
        };

        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ result: 'failure', message: 'Error processing profile photo' });
    }
};

module.exports = { upload, processProfilePhoto };
