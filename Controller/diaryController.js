const Diary = require('../Models/Diary');
const { sendSuccess, sendError } = require('../utils/responseFormatter');

class DiaryController {

    // Add event with media
    async addEvent(req, res) {
        try {
            const { title, description, date, category, mood } = req.body;
            if (!title || !date) {
                return sendError(res, "Title and date are required", 400);
            }

            // Multer files
            const mediaFiles = req.files ? req.files.map(file => `diary/${req.info.id}/${file.filename}`) : [];

            let diary = await Diary.findOne({ user: req.info.id, date });

            const newEvent = {
                title,
                description,
                media: mediaFiles,
                category: category || 'Other',
                mood: mood || 'Neutral'
                // color and moodEmoji are automatically set via pre-save hook in model
            };

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

    // Edit an event
    async editEvent(req, res) {
        try {
            const { date, eventId } = req.params;
            const { title, description, category, mood } = req.body;
            const mediaFiles = req.files ? req.files.map(file => `diary/${req.info.id}/${file.filename}`) : [];

            const removedMedia = req.body.removedMedia ? JSON.parse(req.body.removedMedia) : [];

            const diary = await Diary.findOne({ user: req.info.id, date });
            if (!diary) return sendError(res, "Diary not found", 404);

            const event = diary.events.id(eventId);
            if (!event) return sendError(res, "Event not found", 404);

            if (title) event.title = title;
            if (description) event.description = description;
            if (category) event.category = category; // triggers color update via pre-save
            if (mood) event.mood = mood; // triggers moodEmoji update via pre-save

            // Add new media
            if (mediaFiles.length) event.media.push(...mediaFiles);

            // Remove specified media safely
            if (removedMedia.length) event.media = event.media.filter(m => !removedMedia.includes(m));

            await diary.save(); // Pre-save hook updates color and moodEmoji
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

            if (!diary) {
                return sendError(res, "No events found for this date", 404);
            }

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
            if (!diary) {
                return sendError(res, "Diary not found", 404);
            }

            const event = diary.events.id(eventId);
            if (!event) {
                return sendError(res, "Event not found", 404);
            }

            // Correct Mongoose way to remove subdocument
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
        if (!diary) {
            return sendError(res, "No events found for this date", 404);
        }

        // Return only events array to match frontend expectation
        return sendSuccess(res, "Events fetched successfully", { events: diary.events });
    } catch (err) {
        console.error(err);
        return sendError(res, "Failed to fetch events", 500);
    }
}

}

module.exports = new DiaryController();