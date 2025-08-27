const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const mediaSchema = new Schema({
  url: { type: String, required: true },        // e.g. diary/<userId>/<filename>
  type: { type: String, enum: ['image', 'video', 'audio'], default: 'image' },
  caption: { type: String, default: '' }
}, { _id: false });

const diaryEventSnapshotSchema = new Schema({
  // keep original subdoc id as string for reference
  eventId: { type: String, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  date: { type: String, default: '' },          // diary.date
  category: { type: String, default: 'Other' },
  mood: { type: String, default: 'Neutral' },
  media: [mediaSchema],
  // convenience field for the first image (frontend friendly)
  photo: { type: String, default: '' }          // e.g. /uploads/diary/<userId>/<filename>
}, { _id: false });

const commentSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  parentComment: { type: Types.ObjectId, ref: 'Post.comments', default: null }, // For replies (null = top-level)
  likes: [{ type: Types.ObjectId, ref: 'User' }] // Likes on this comment
}, { timestamps: true });

const postSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  // IMPORTANT: we now store snapshots, not refs to a missing "DiaryEvent" model
  diaryEvents: [diaryEventSnapshotSchema],
  likes: [{ type: Types.ObjectId, ref: 'User' }],
  comments: [commentSchema]
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);