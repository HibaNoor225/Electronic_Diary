// controllers/diaryController.js
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Diary = require('../Models/Diary');

// ---------- Multer Storage (for NON-chunked uploads) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.info || !req.info.id) return cb(new Error('User info not found'), null);

    const uploadPath = path.join(__dirname, '../uploads/diary', req.info.id.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadDiary = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
}).any();


// ---------- Multer Storage for CHUNKED uploads ----------
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(__dirname, '../uploads/tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.fileId}-${req.body.chunkIndex}`);
  }
});

const uploadChunk = multer({ storage: chunkStorage }).single("chunk");


// ---------- Handle Chunked Upload ----------
const handleChunkUpload = async (req, res) => {
  const { fileId, chunkIndex, totalChunks, filename } = req.body;

  if (!fileId || chunkIndex === undefined || !totalChunks || !filename) {
    return res.status(400).json({ error: "Missing chunk upload params" });
  }

  const userId = req.info.id.toString();
  const tmpDir = path.join(__dirname, '../uploads/tmp', userId, fileId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file chunk received" });
  }

  const chunkPath = path.join(tmpDir, `chunk-${chunkIndex}`);
  fs.renameSync(file.path, chunkPath);
  console.log(`Saved chunk ${chunkIndex}/${totalChunks} for ${filename}`);

  return res.json({ message: `Chunk ${chunkIndex} uploaded` });
};




function fileIsImage(filename) {
  return /\.(jpg|jpeg|png|gif)$/i.test(filename);
}

function fileIsVideo(filename) {
  return /\.(mp4|mov|webm)$/i.test(filename);
}

function fileIsAudio(filename) {
  return /\.(mp3|wav|ogg)$/i.test(filename);
}

const handleMergeChunks = async (req, res) => {
  try {
    const { fileId, totalChunks, filename, eventId } = req.body;
    if (!fileId || !totalChunks || !filename || !eventId) {
      return res.status(400).json({ error: "Missing merge params" });
    }

    const userId = req.info.id.toString();
    const tmpDir = path.join(__dirname, '../uploads/tmp', userId, fileId);
    const finalDir = path.join(__dirname, '../uploads/diary', userId);
    fs.mkdirSync(finalDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    // Sanitize filename for Windows
    const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const finalPath = path.join(finalDir, safeFilename);

    // Merge chunks safely
    const writeStream = fs.createWriteStream(finalPath);
    writeStream.on('error', err => {
      console.error('WriteStream error:', err);
      return res.status(500).json({ error: 'Failed to write file' });
    });

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tmpDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) continue; // skip missing chunks
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
      fs.unlinkSync(chunkPath);
    }

    writeStream.end();
    fs.rmdirSync(tmpDir, { recursive: true });

    // Find the diary event
    const diary = await Diary.findOne({ "events._id": eventId, user: req.info.id });
    if (!diary) return res.status(404).json({ error: "Event not found" });
    const event = diary.events.id(eventId);

    let mediaObject = {};
    if (fileIsImage(safeFilename)) {
      const ext = path.extname(safeFilename);
      const baseName = path.basename(safeFilename, ext);

      const thumbPath = path.join(finalDir, `${baseName}-thumb${ext}`);
      const optimizedPath = path.join(finalDir, `${baseName}-optimized${ext}`);
      const compressedPath = path.join(finalDir, `${baseName}-compressed${ext}`);

      await sharp(finalPath).resize(150, 150, { fit: 'cover' }).toFile(thumbPath);
      await sharp(finalPath).resize(600, 600, { fit: 'inside' }).toFile(optimizedPath);
      await sharp(finalPath).resize(1200, 1200, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(compressedPath);

      mediaObject = {
        type: 'image',
        caption: '',
        url: {
          original: `diary/${userId}/${safeFilename}`,
          thumbnail: `diary/${userId}/${baseName}-thumb${ext}`,
          optimized: `diary/${userId}/${baseName}-optimized${ext}`,
          compressed: `diary/${userId}/${baseName}-compressed${ext}`
        }
      };

    } else if (fileIsVideo(safeFilename)) {
      mediaObject = { type: 'video', caption: '', url: `diary/${userId}/${safeFilename}` };
    } else if (fileIsAudio(safeFilename)) {
      mediaObject = { type: 'audio', caption: '', url: `diary/${userId}/${safeFilename}` };
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    event.media.push(mediaObject);
    await diary.save();

    return res.json({
      message: "File merged successfully",
      media: mediaObject,
      event
    });

  } catch (err) {
    console.error("Error merging chunks:", err);
    return res.status(500).json({ error: "Error merging chunks" });
  }
};



// ---------- Process Images ----------
const processDiaryImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  await Promise.all(req.files.map(async file => {
    const imageTypes = ['image/jpeg','image/jpg','image/png','image/gif'];
    if (!imageTypes.includes(file.mimetype)) return;

    const fileDir = path.dirname(file.path);
    const baseName = path.basename(file.path, path.extname(file.path));
    const ext = path.extname(file.path);

    try {
      await sharp(file.path).resize(150, 150, { fit: 'cover' })
        .toFile(path.join(fileDir, `${baseName}-thumb${ext}`));

      await sharp(file.path).resize(600, 600, { fit: 'inside' })
        .toFile(path.join(fileDir, `${baseName}-optimized${ext}`));

      await sharp(file.path).resize(1200, 1200, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(path.join(fileDir, `${baseName}-original${ext}`));

      file.paths = {
        thumbnail: path.join(fileDir, `${baseName}-thumb${ext}`),
        optimized: path.join(fileDir, `${baseName}-optimized${ext}`),
        original: path.join(fileDir, `${baseName}-original${ext}`)
      };
    } catch (err) {
      console.error('Error processing image:', file.originalname, err);
    }
  }));

  next();
};

module.exports = { 
  uploadDiary, 
  uploadChunk, 
  handleChunkUpload, 
  handleMergeChunks, 
  processDiaryImages 
};
