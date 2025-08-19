const Diary = require('../Models/Diary');
const { sendSuccess, sendError } = require('../utils/responseFormatter');

class DiaryController {
  // Add event with media
  async addEvent(req, res) {
    try {
     
console.log("REQ.INFO:", req.info);
console.log("REQ.BODY:", req.body);
console.log("REQ.FILES:", req.files);


      const { title, description, date, category, mood, customCategory, customMood } = req.body;
      if (!title || !date) return sendError(res, "Title and date are required", 400);

      // Convert uploaded files into media objects
      const mediaFiles = req.files ? req.files.map((file, index) => {
        let type = "image";
        if (file.mimetype.startsWith("video")) type = "video";
        else if (file.mimetype.startsWith("audio")) type = "audio";

        const captionsArray = Array.isArray(req.body.captions) ? req.body.captions : [];
        const caption = captionsArray[index] || "";

        return { url: `diary/${req.info.id}/${file.filename}`, caption, type };
      }) : [];

      const newEvent = {
        title,
        description,
        media: mediaFiles,
        category: category || "Other",
        mood: mood || "Other",
        customCategory: "",
        customMood: ""
      };

      // Handle "Other" category/mood
     // Handle custom category/mood
if (customCategory) {
  newEvent.category = customCategory;
  newEvent.customCategory = customCategory;
}
if (customMood) {
  newEvent.mood = customMood;
  newEvent.customMood = customMood;
}


      let diary = await Diary.findOne({ user: req.info.id, date });
      if (diary) diary.events.push(newEvent);
      else diary = new Diary({ user: req.info.id, date, events: [newEvent] });

      await diary.save();
      sendSuccess(res, "Event added successfully", diary);
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to add event", 500);
    }
  }

  // Edit event
  async editEvent(req, res) {
    try {
      const { date, eventId } = req.params;
      const { title, description, category, mood, customCategory, customMood } = req.body;

      const diary = await Diary.findOne({ user: req.info.id, date });
      if (!diary) return sendError(res, "Diary not found", 404);

      const event = diary.events.id(eventId);
      if (!event) return sendError(res, "Event not found", 404);

      // Update basic fields
      if (title) event.title = title;
      if (description) event.description = description;
      if (category) event.category = category;
      if (mood) event.mood = mood;

      // Handle "Other" category/mood
      // Handle custom category/mood
if (customCategory) {
  event.category = customCategory;
  event.customCategory = customCategory;
}
if (customMood) {
  event.mood = customMood;
  event.customMood = customMood;
}


      // Convert uploaded files into media objects
      const mediaFiles = req.files ? req.files.map((file, index) => {
        let type = "image";
        if (file.mimetype.startsWith("video")) type = "video";
        else if (file.mimetype.startsWith("audio")) type = "audio";

        const captionsArray = Array.isArray(req.body.captions) ? req.body.captions : [];
        const caption = captionsArray[index] || "";

        return { url: `diary/${req.info.id}/${file.filename}`, caption, type };
      }) : [];

      if (mediaFiles.length) event.media.push(...mediaFiles);

      // Remove unwanted media
      const removedMedia = req.body.removedMedia ? JSON.parse(req.body.removedMedia) : [];
      if (removedMedia.length) {
        event.media = event.media.filter(m => !removedMedia.includes(m.url));
      }

      await diary.save();
      sendSuccess(res, "Event updated successfully", event);
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to update event", 500);
    }
  }

  // Get all events for a date
  async getDiaryByDate(req, res) {
    try {
      const { date } = req.params;
      const diary = await Diary.findOne({ user: req.info.id, date });

      if (!diary) return sendError(res, "No events found for this date", 404);

      sendSuccess(res, "Diary fetched successfully", diary);
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to fetch diary", 500);
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
