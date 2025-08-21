// Controller/postController.js
const Post = require('../Models/Post');
const Diary = require('../Models/Diary');
const Record = require('../Models/Record'); // Activity log model

// Helper to log user activity
async function logActivity(userId, detail) {
  try {
    const record = new Record({ user: userId, detail, date: new Date() });
    await record.save();
    console.log(`[ActivityLog] User: ${userId}, Detail: ${detail}`);
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}

// CREATE: from diary events (called by "Make Public" on diary-view.html)
exports.createFromDiary = async (req, res) => {
  try {
    const userId = req.info.id;
    const { date, diaryEventIds, content = '' } = req.body;

    if (!date || !Array.isArray(diaryEventIds) || diaryEventIds.length === 0) {
      return res.status(400).json({ success: false, message: 'date and diaryEventIds[] are required' });
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
      userId: userId,
      content: content,
      diaryEvents: selected.map(ev => {
        const mediaArray = (ev.media || []).map(m => {
          if (m.type === 'image' && typeof m.url === 'object') {
            return {
              type: m.type,
              caption: m.caption || '',
              url: {
                original: `/uploads/${m.url.original}`,
                compressed: `/uploads/${m.url.compressed}`,
                optimized: `/uploads/${m.url.optimized}`,
                thumbnail: `/uploads/${m.url.thumbnail}`
              }
            };
          } else {
            return {
              type: m.type,
              caption: m.caption || '',
              url: `/uploads/${m.filename || m.url}`
            };
          }
        });

        const firstImage = ev.media.find(m => m.type === 'image');

        return {
          eventId: String(ev._id),
          title: ev.title || '',
          description: ev.description || '',
          date: date,
          category: ev.category || 'Other',
          mood: ev.mood || 'Neutral',
          media: mediaArray,
          photo: firstImage
            ? (typeof firstImage.url === 'object' ? `/uploads/${firstImage.url.thumbnail}` : `/uploads/${firstImage.url}`)
            : ''
        };
      })
    });

    await post.save();
    await logActivity(userId, `Published diary as a post on ${date}`);

    return res.status(201).json({ success: true, message: 'Diary published as a post', post });
  } catch (err) {
    console.error('createFromDiary error:', err);
    await logActivity(req.info.id, `Failed to publish diary as post: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to publish post' });
  }
};

// GET: paginated posts with user + comment users populated
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
        .populate('comments.userId', 'username profilePhoto'),
      Post.countDocuments()
    ]);

    await logActivity(req.info.id, `Fetched posts page ${page}, limit ${limit}`);

    return res.json({
      success: true,
      posts,
      totalPosts,
      page,
      limit
    });
  } catch (err) {
    console.error('getAllPosts error:', err);
    await logActivity(req.info.id, `Failed to fetch posts: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
};

// LIKE/UNLIKE
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const idx = post.likes.findIndex(id => String(id) === String(userId));
    if (idx >= 0) {
      post.likes.splice(idx, 1);
      await logActivity(userId, `Unliked post ${postId}`);
    } else {
      post.likes.push(userId);
      await logActivity(userId, `Liked post ${postId}`);
    }

    await post.save();
    res.json({ success: true, likesCount: post.likes.length });
  } catch (err) {
    console.error('toggleLike error:', err);
    await logActivity(req.info.id, `Failed to toggle like on post: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
  }
};

// GET /api/posts/:postId
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('userId', 'username profilePhoto')
      .populate('comments.userId', 'username profilePhoto');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    await logActivity(req.info.id, `Viewed post ${req.params.postId}`);

    res.json({ success: true, post });
  } catch (err) {
    console.error(err);
    await logActivity(req.info.id, `Failed to fetch post ${req.params.postId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

// COMMENT
exports.addComment = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text required' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    post.comments.push({ userId, text: text.trim() });
    await post.save();
    await post.populate('comments.userId', 'username profilePhoto');

    await logActivity(userId, `Commented on post ${postId}: "${text.trim()}"`);

    res.json({ success: true, post });
  } catch (err) {
    console.error('addComment error:', err);
    await logActivity(req.info.id, `Failed to add comment on post ${req.params.postId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};
