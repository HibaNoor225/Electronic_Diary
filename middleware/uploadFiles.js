// middleware/combinedUploader.js
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

class CombinedUploader {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Save to different folders based on field name
      if (file.fieldname === 'images') {
        cb(null, "uploads/images");
      } else if (file.fieldname === 'documents') {
        cb(null, "uploads/documents/");
      } else {
        cb(null, "uploads/");
      }
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  fileFilter = (req, file, cb) => {
    if (file.fieldname === 'images') {
      // Image validation
      const allowedTypes = /jpeg|jpg|png/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error("Only .jpeg, .jpg, .png files allowed for images"));
      }
    } 
    else if (file.fieldname === 'documents') {
      // Document validation
      const allowedTypes = /\.(doc|docx|xls|xlsx|csv|pdf)$/i;
      const allowedMimeTypes = [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "application/pdf",
      ];

      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedMimeTypes.includes(file.mimetype);

      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error("Only document files (.doc, .docx, .xls, .xlsx, .csv, .pdf) allowed"));
      }
    }
    else {
      cb(new Error("Invalid field name. Use 'images' or 'documents'"));
    }
  };

  upload = multer({
    storage: this.storage,
    fileFilter: this.fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
  });

  // Accept both images and documents
  uploadAll = this.upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
  ]);

  // Validate image dimensions (only for images)
  validateImageDimensions = async (req, res, next) => {
    try {
      if (!req.files || !req.files.images) {
        return next();
      }

      const maxWidth = 1024;
      const maxHeight = 768;

      for (const file of req.files.images) {
        const filePath = path.resolve(file.path);
        const metadata = await sharp(filePath).metadata();

        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: `Image ${file.originalname} is too large. Max dimensions allowed are ${maxWidth}x${maxHeight}px.`,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new CombinedUploader();