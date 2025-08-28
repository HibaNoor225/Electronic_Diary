const mongoose = require('mongoose');
const Post = require('../Models/Post');
const Diary = require('../Models/Diary');
const Record = require('../Models/Record'); // Activity log model
const User = require('../Models/User'); 
const UserNotification = require('../Models/UserNotification'); // NEW

// Helper to log user activity
async function logActivity(userId, detail) {
  try {
    if (!userId) return;
    await Record.create({ user: userId, detail, date: new Date() });
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}

async function createNotification(recipientId, senderId, type, message) {
  try {
    if (!recipientId) return;
    
    await UserNotification.create({ 
      user: recipientId,   // receiver
      sender: senderId,    // sender
      type, 
      message, 
      isRead: false,       // unread by default
      createdAt: new Date()
    });
  } catch (err) {
    console.error('[UserNotification] Failed:', err.message);
  }
}

// CREATE: from diary events
exports.createFromDiary = async (req, res) => {
  try {
    const userId = req.info.id;
    const { date, diaryEventIds, content = '', taggedUserIds = [] } = req.body;

    if (!date || !Array.isArray(diaryEventIds) || diaryEventIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Date and diaryEventIds[] are required' });
    }

    if (!Array.isArray(taggedUserIds)) {
      return res.status(400).json({ success: false, message: 'taggedUserIds must be an array' });
    }
    for (const id of taggedUserIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: `Invalid user ID in taggedUserIds: ${id}` });
      }
      const userExists = await User.findById(id);
      if (!userExists) {
        return res.status(400).json({ success: false, message: `User with ID ${id} does not exist` });
      }
    }

    const diary = await Diary.findOne({ user: userId, date });
    if (!diary) {
      return res.status(404).json({ success: false, message: 'Diary for this date not found' });
    }

    const selected = diary.events.filter(ev => diaryEventIds.includes(String(ev._id)));
    if (selected.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching events found in diary' });
    }

    const post = new Post({
      userId,
      content,
      tags: taggedUserIds,
      diaryEvents: selected.map(ev => {
        const mediaArray = (ev.media || []).map(m => {
          try {
            if (m.type === 'image' && typeof m.url === 'object' && m.url) {
              return {
                type: m.type,
                caption: m.caption || '',
                url: {
                  original: m.url.original ? `/uploads/${m.url.original}` : '',
                  compressed: m.url.compressed ? `/uploads/${m.url.compressed}` : '',
                  optimized: m.url.optimized ? `/uploads/${m.url.optimized}` : '',
                  thumbnail: m.url.thumbnail ? `/uploads/${m.url.thumbnail}` : ''
                }
              };
            } else {
              return {
                type: m.type || 'image',
                caption: m.caption || '',
                url: m.url ? `/uploads/${m.filename || m.url}` : ''
              };
            }
          } catch (error) {
            console.error(`Error processing media for event ${ev._id}:`, error.message);
            return null;
          }
        }).filter(m => m !== null);

        const firstImage = ev.media ? ev.media.find(m => m.type === 'image') : null;

        return {
          eventId: String(ev._id),
          title: ev.title || '',
          description: ev.description || '',
          date: date,
          category: ev.category || 'Other',
          mood: ev.mood || 'Neutral',
          media: mediaArray,
          photo: firstImage
            ? (typeof firstImage.url === 'object' ? `/uploads/${firstImage.url.thumbnail || firstImage.url.original}` : `/uploads/${firstImage.url}`)
            : ''
        };
      })
    });

    await post.save();
    await logActivity(userId, `Published diary as a post on ${date}`);

    // 🔔 Send notifications to tagged users
    const currentUser = await User.findById(userId).select('username');
    for (const taggedUserId of taggedUserIds) {
      await createNotification(
        taggedUserId,                    // recipient
        userId,                          // sender
        'tag',
        `${currentUser.username} tagged you in a post`,

      );
    }

    return res.status(201).json({ success: true, message: 'Diary published as a post', post });
  } catch (err) {
    console.error('createFromDiary error:', err);
    await logActivity(req.info.id, `Failed to publish diary as post: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to publish post', error: err.message });
  }
};

// GET paginated posts
exports.getAllPosts = async (req, res) => {
  try {
    let { page = 1, limit = 5 } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 5;

    const [posts, totalPosts] = await Promise.all([
      Post.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'username profilePhoto')
        .populate('comments.userId', 'username profilePhoto')
        .populate('tags', 'username profilePhoto'),
      Post.countDocuments()
    ]);

    posts.forEach(post => {
      post.comments.sort((a, b) => b.createdAt - a.createdAt);
    });

    await logActivity(req.info.id, `Fetched posts page ${page}`);

    return res.json({ success: true, posts, totalPosts, page, limit });
  } catch (err) {
    console.error('getAllPosts error:', err);
    await logActivity(req.info.id, `Failed to fetch posts: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts', error: err.message });
  }
};

// GET single post
exports.getPostById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(req.params.postId)
      .populate('userId', 'username profilePhoto')
      .populate('comments.userId', 'username profilePhoto')
      .populate('tags', 'username profilePhoto');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    post.comments.sort((a, b) => b.createdAt - a.createdAt);

    await logActivity(req.info.id, `Viewed post ${req.params.postId}`);

    res.json({ success: true, post });
  } catch (err) {
    console.error('getPostById error:', err);
    await logActivity(req.info.id, `Failed to fetch post: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch post', error: err.message });
  }
};

// LIKE/UNLIKE POST
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const idx = post.likes.findIndex(id => String(id) === String(userId));
    if (idx >= 0) {
      post.likes.splice(idx, 1);
      await logActivity(userId, `Unliked post ${postId}`);
    } else {
      post.likes.push(userId);
      await logActivity(userId, `Liked post ${postId}`);

      // 🔔 Notify post owner if someone else liked
      if (String(post.userId) !== String(userId)) {
        const currentUser = await User.findById(userId).select('username');
        await createNotification(
          post.userId,                     // recipient (post owner)
          userId,                          // sender (liker)
          'like',
          `${currentUser.username} liked your post`,
          
        );
      }
    }

    await post.save();
    res.json({ success: true, likesCount: post.likes.length });
  } catch (err) {
    console.error('toggleLike error:', err);
    await logActivity(req.info.id, `Failed to toggle like: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to toggle like', error: err.message });
  }
};

// COMMENT
exports.addComment = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId } = req.params;
    const { text, parentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text required' });
    }

    if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent comment ID' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (parentId) {
      const parentComment = post.comments.id(parentId);
      if (!parentComment) return res.status(404).json({ success: false, message: 'Parent comment not found' });
    }

    const newComment = { userId, text: text.trim(), parentComment: parentId || null };
    post.comments.push(newComment);
    await post.save();
    await post.populate('comments.userId', 'username profilePhoto');

    await logActivity(userId, `Commented on post ${postId}`);

    // 🔔 Notify post owner (if commenter is not the owner)
    if (String(post.userId) !== String(userId)) {
      const currentUser = await User.findById(userId).select('username');
      await createNotification(
        post.userId,                     // recipient (post owner)
        userId,                          // sender (commenter)
        'comment',
        `${currentUser.username} commented on your post: "${text.trim()}"`,
        
      );
    }

    res.json({ success: true, post });
  } catch (err) {
    console.error('addComment error:', err);
    await logActivity(req.info.id, `Failed to add comment: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to add comment', error: err.message });
  }
};

// LIKE/UNLIKE COMMENT
exports.toggleCommentLike = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId, commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid post or comment ID' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const idx = comment.likes.findIndex(id => String(id) === String(userId));
    if (idx >= 0) {
      comment.likes.splice(idx, 1);
      await logActivity(userId, `Unliked comment ${commentId}`);
    } else {
      comment.likes.push(userId);
      await logActivity(userId, `Liked comment ${commentId}`);

      // 🔔 Notify comment owner
      if (String(comment.userId) !== String(userId)) {
        const currentUser = await User.findById(userId).select('username');
        await createNotification(
          comment.userId,                  // recipient (comment owner)
          userId,                          // sender (liker)
          'like',
          `${currentUser.username} liked your comment`,
          
        );
      }
    }

    await post.save();
    res.json({ success: true, likesCount: comment.likes.length });
  } catch (err) {
    console.error('toggleCommentLike error:', err);
    await logActivity(req.info.id, `Failed to toggle comment like: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to toggle comment like', error: err.message });
  }
};