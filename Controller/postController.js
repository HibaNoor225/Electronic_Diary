const Post = require('../Models/Post');
const Diary = require('../Models/Diary');
const Record = require('../Models/Record'); // Activity log model

// Helper to log user activity
async function logActivity(userId, detail) {
    try {
        if (!userId) return; // skip if no user
        await Record.create({ user: userId, detail, date: new Date() });
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

    // Sort comments newest first (for all posts)
    posts.forEach(post => {
      post.comments.sort((a, b) => b.createdAt - a.createdAt);
    });

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

// GET /api/posts/:postId
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('userId', 'username profilePhoto')
      .populate('comments.userId', 'username profilePhoto');

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    // Sort comments newest first
    post.comments.sort((a, b) => b.createdAt - a.createdAt);

    await logActivity(req.info.id, `Viewed post ${req.params.postId}`);

    res.json({ success: true, post });
  } catch (err) {
    console.error(err);
    await logActivity(req.info.id, `Failed to fetch post ${req.params.postId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

// LIKE/UNLIKE POST (unchanged)
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

// COMMENT (updated to support replies)
exports.addComment = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId } = req.params;
    const { text, parentId } = req.body; // parentId optional for replies

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text required' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const newComment = {
      userId,
      text: text.trim(),
      parentComment: parentId || null // Set parent if provided
    };

    post.comments.push(newComment);
    await post.save();
    await post.populate('comments.userId', 'username profilePhoto');

    await logActivity(userId, `Commented on post ${postId}${parentId ? ` (reply to ${parentId})` : ''}: "${text.trim()}"`);

    res.json({ success: true, post });
  } catch (err) {
    console.error('addComment error:', err);
    await logActivity(req.info.id, `Failed to add comment on post ${req.params.postId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

// NEW: LIKE/UNLIKE COMMENT
exports.toggleCommentLike = async (req, res) => {
  try {
    const userId = req.info.id;
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const idx = comment.likes.findIndex(id => String(id) === String(userId));
    if (idx >= 0) {
      comment.likes.splice(idx, 1);
      await logActivity(userId, `Unliked comment ${commentId} on post ${postId}`);
    } else {
      comment.likes.push(userId);
      await logActivity(userId, `Liked comment ${commentId} on post ${postId}`);
    }

    await post.save();

    res.json({ success: true, likesCount: comment.likes.length });
  } catch (err) {
    console.error('toggleCommentLike error:', err);
    await logActivity(req.info.id, `Failed to toggle like on comment ${req.params.commentId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to toggle comment like' });
  }
};