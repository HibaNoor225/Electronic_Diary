const Diary = require('../Models/Diary');
const { sendSuccess, sendError } = require('../utils/responseFormatter');

class DiaryController {

  // Add event with media
  async addEvent(req, res) {
    try {
      const { title, description, date } = req.body;
      if (!title || !date) return sendError(res, "Title and date are required", 400);

      // Map uploaded files to paths
      const mediaFiles = req.files ? req.files.map(file => `/uploads/diary/${req.info.id}/${file.filename}`) : [];

      // Find existing diary for user and date
      let diary = await Diary.findOne({ user: req.info.id, date });

      const newEvent = { title, description, media: mediaFiles };

      if (diary) {
        diary.events.push(newEvent);
      } else {
        diary = new Diary({ user: req.info.id, date, events: [newEvent] });
      }

      await diary.save();
      sendSuccess(res, "Event added successfully", diary);
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to add event", 500);
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

  // Edit an event
  async editEvent(req, res) {
    try {
      const { date, eventId } = req.params;
      const { title, description } = req.body;
      const mediaFiles = req.files ? req.files.map(file => file.path) : [];

      const diary = await Diary.findOne({ user: req.info.id, date });
      if (!diary) return sendError(res, "Diary not found", 404);

      const event = diary.events.id(eventId);
      if (!event) return sendError(res, "Event not found", 404);

      if (title) event.title = title;
      if (description) event.description = description;
      if (mediaFiles.length) event.media.push(...mediaFiles);
      if(req.body.removedMedia){
        const removed = JSON.parse(req.body.removedMedia);
        event.media = event.media.filter(m => !removed.includes(m));
      }

      await diary.save();
      sendSuccess(res, "Event updated successfully", event);
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

      event.remove(); // remove subdocument
      await diary.save();

      sendSuccess(res, "Event deleted successfully");
    } catch (err) {
      console.error(err);
      sendError(res, "Failed to delete event", 500);
    }
  }
}

module.exports = new DiaryController();
