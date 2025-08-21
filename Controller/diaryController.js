const Diary = require('../Models/Diary');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
  // Add event with media
  const path = require('path');
  const mongoose = require('mongoose');
const fs = require('fs');
const sharp = require('sharp');
class DiaryController {
async uploadChunk(req, res) {
  try {
    // multer has already handled file and fields
    const { fileId, chunkIndex, totalChunks, fileName } = req.body;

    if (!fileId || !chunkIndex) {
      return res.status(400).json({ error: "Missing fileId or chunkIndex" });
    }

    // multer already saved the chunk in uploads/chunks
    res.json({
      success: true,
      message: `Chunk ${chunkIndex} of ${fileId} uploaded`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }

}
  async mergeChunks(req, res) {
    try {
      const { fileId, fileName } = req.body;
      if (!fileId || !fileName) {
        return sendError(res, "fileId and fileName are required", 400);
      }

      const chunkDir = path.join(__dirname, "../uploads/chunks", fileId);
      const files = fs.readdirSync(chunkDir).sort((a, b) => a - b);

      const finalPath = path.join(__dirname, "../uploads/diary", fileName);
      const writeStream = fs.createWriteStream(finalPath);

      for (const file of files) {
        const filePath = path.join(chunkDir, file);
        const data = fs.readFileSync(filePath);
        writeStream.write(data);
        fs.unlinkSync(filePath);
      }
      writeStream.end();

      fs.rmdirSync(chunkDir);

      sendSuccess(res, "File merged", { url: `diary/${fileName}` });
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to merge chunks", 500);
    }
  }

  

async addEvent(req, res) {
  try {
    const { title, description, date, category, mood, customCategory, customMood, captions } = req.body;
    if (!title || !date) return sendError(res, "Title and date are required", 400);

    const captionsArray = Array.isArray(captions) ? captions : (captions ? [captions] : []);

    const mediaFiles = req.files
      ? await Promise.all(
          req.files.map(async (file, index) => {
            let type = "image";
            if (file.mimetype.startsWith("video")) type = "video";
            else if (file.mimetype.startsWith("audio")) type = "audio";

            const caption = captionsArray[index] || "";
            const uploadDir = path.join(__dirname, "../uploads/diary", req.info.id.toString());
            const ext = path.extname(file.filename);
            const baseName = path.basename(file.filename, ext);

            if (type === "image") {
              const thumbPath = path.join(uploadDir, `${baseName}-thumb${ext}`);
              const optimizedPath = path.join(uploadDir, `${baseName}-optimized${ext}`);
              const compressedPath = path.join(uploadDir, `${baseName}-compressed${ext}`);

              await sharp(file.path).resize(150, 150).toFile(thumbPath);
              await sharp(file.path).resize(600, 600, { fit: "inside" }).toFile(optimizedPath);
              await sharp(file.path).resize(1200, 1200, { fit: "inside" }).jpeg({ quality: 80 }).toFile(compressedPath);

              return {
                type,
                caption,
                url: {
                  original: `diary/${req.info.id}/${file.filename}`,
                  thumbnail: `diary/${req.info.id}/${baseName}-thumb${ext}`,
                  optimized: `diary/${req.info.id}/${baseName}-optimized${ext}`,
                  compressed: `diary/${req.info.id}/${baseName}-compressed${ext}`,
                },
              };
            }
            return { type, caption, url: `diary/${req.info.id}/${file.filename}` };
          })
        )
      : [];

    const newEvent = {
      _id: new mongoose.Types.ObjectId(),  // <-- Add this line
      title,
      description,
      media: mediaFiles,
      category: customCategory || category || "Other",
      mood: customMood || mood || "Other",
      customCategory: customCategory || "",
      customMood: customMood || "",
    };

    let diary = await Diary.findOne({ user: req.info.id, date });
    if (diary) diary.events.push(newEvent);
    else diary = new Diary({ user: req.info.id, date, events: [newEvent] });

    await diary.save();
    sendSuccess(res, "Event added successfully", { diary, eventId: newEvent._id });  // return ObjectId
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to add event", 500);
  }
}
async editEvent(req, res) {
  try {
    const { date, eventId } = req.params;
    const { title, description, category, mood, customCategory, customMood, removedMedia, captions } = req.body;

    if (!eventId) return sendError(res, "Event ID is required", 400);

    const diary = await Diary.findOne({ user: req.info.id, date });
    if (!diary) return sendError(res, "Diary not found", 404);

    const event = diary.events.id(eventId);
    if (!event) return sendError(res, "Event not found", 404);

    // Update basic fields
    if (title) event.title = title;
    if (description) event.description = description;
    if (category) event.category = category;
    if (mood) event.mood = mood;
    if (customCategory) { event.category = customCategory; event.customCategory = customCategory; }
    if (customMood) { event.mood = customMood; event.customMood = customMood; }

    const captionsArray = Array.isArray(captions) ? captions : (captions ? [captions] : []);

    // ---------------------------
    // Process newly uploaded files (chunked)
    // ---------------------------
    const mediaFiles = req.files
      ? await Promise.all(
          req.files.map(async (file, index) => {
            let type = "image";
            if (file.mimetype.startsWith("video")) type = "video";
            else if (file.mimetype.startsWith("audio")) type = "audio";

            const caption = captionsArray[index] || "";
            const uploadDir = path.join(__dirname, "../uploads/diary", req.info.id.toString());
            const ext = path.extname(file.filename);
            const baseName = path.basename(file.filename, ext);

            if (type === "image") {
              const thumbPath = path.join(uploadDir, `${baseName}-thumb${ext}`);
              const optimizedPath = path.join(uploadDir, `${baseName}-optimized${ext}`);
              const compressedPath = path.join(uploadDir, `${baseName}-compressed${ext}`);

              await sharp(file.path).resize(150, 150).toFile(thumbPath);
              await sharp(file.path).resize(600, 600, { fit: "inside" }).toFile(optimizedPath);
              await sharp(file.path).resize(1200, 1200, { fit: "inside" }).jpeg({ quality: 80 }).toFile(compressedPath);

              return {
                type,
                caption,
                url: {
                  original: `diary/${req.info.id}/${file.filename}`,
                  thumbnail: `diary/${req.info.id}/${baseName}-thumb${ext}`,
                  optimized: `diary/${req.info.id}/${baseName}-optimized${ext}`,
                  compressed: `diary/${req.info.id}/${baseName}-compressed${ext}`,
                },
              };
            }
            return { type, caption, url: `diary/${req.info.id}/${file.filename}` };
          })
        )
      : [];

    if (mediaFiles.length) event.media.push(...mediaFiles);

    // ---------------------------
    // Remove unwanted media
    // ---------------------------
    const removed = removedMedia ? JSON.parse(removedMedia) : [];
    if (removed.length) {
      event.media = event.media.filter((m) => {
        if (typeof m.url === "object") {
          return !Object.values(m.url).some((u) => removed.includes(u));
        }
        return !removed.includes(m.url);
      });
    }

    await diary.save();
    sendSuccess(res, "Event updated successfully", { diary, eventId });
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to update event", 500);
  }
}

  // Delete an event
  async deleteEvent(req, res) {
    try {
      const { date, eventId } = req.params;
      const diary = await Diary.findOne({ user: req.info.id, date });
      if (!diary) return sendError(res, "Diary not found", 404);

      const event = diary.events.id(eventId);
      if (!event) return sendError(res, "Event not found", 404);

      diary.events.pull(eventId);
      await diary.save();

      sendSuccess(res, "Event deleted successfully");
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to delete event", 500);
    }
  }

  // Get all events for a specific date
  async getEventsByDate(req, res) {
    try {
      const { date } = req.params;
      const diary = await Diary.findOne({ user: req.info.id, date });
      if (!diary) return sendError(res, "No events found for this date", 404);

      return sendSuccess(res, "Events fetched successfully", { events: diary.events });
    } catch (err) {
      console.error(err);
      return sendError(res, "Failed to fetch events", 500);
    }
  }

  // Search events by name/title
  async searchByName(req, res) {
    try {
      const { userId, q } = req.query;
      if (!userId || !q) return res.status(400).json({ message: "userId and query required" });

      const diaries = await Diary.find({ user: userId });
      const matchedEvents = [];

      diaries.forEach(diary => {
        diary.events.forEach(event => {
          if (event.title.toLowerCase().includes(q.toLowerCase())) {
            matchedEvents.push({ diaryDate: diary.date, ...event.toObject() });
          }
        });
      });

      res.json({ results: matchedEvents });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }

  // Search events by mood
  async searchByMood(req, res) {
    try {
      const { userId, mood } = req.query;
      if (!userId || !mood) return res.status(400).json({ message: "userId and mood required" });

      const diaries = await Diary.find({ user: userId });
      const matchedEvents = [];

      diaries.forEach(diary => {
        diary.events.forEach(event => {
          if (event.mood === mood) {
            matchedEvents.push({ diaryDate: diary.date, ...event.toObject() });
          }
        });
      });

      res.json({ results: matchedEvents });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }

  // Search events by category
  async searchByCategory(req, res) {
    try {
      const { userId, category } = req.query;
      if (!userId || !category) return res.status(400).json({ message: "userId and category required" });

      const diaries = await Diary.find({ user: userId });
      const matchedEvents = [];

      diaries.forEach(diary => {
        diary.events.forEach(event => {
          if (event.category === category) {
            matchedEvents.push({ diaryDate: diary.date, ...event.toObject() });
          }
        });
      });

      res.json({ results: matchedEvents });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }

  // Search events with optional filters
  async searchEvents(req, res) {
    try {
      const { userId, q, mood, category } = req.query;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const eventFilter = {};
      if (q) eventFilter.title = { $regex: q, $options: "i" };
      if (mood) eventFilter.mood = mood;
      if (category) eventFilter.category = category;

      const diaries = await Diary.find({
        user: userId,
        events: { $elemMatch: eventFilter }
      });

      const matchedEvents = [];
      diaries.forEach(diary => {
        diary.events.forEach(event => {
          let match = true;
          if (q && !event.title.toLowerCase().includes(q.toLowerCase())) match = false;
          if (mood && event.mood !== mood) match = false;
          if (category && event.category !== category) match = false;
          if (match) matchedEvents.push({ diaryDate: diary.date, ...event.toObject() });
        });
      });

      res.json({ results: matchedEvents });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = new DiaryController();
