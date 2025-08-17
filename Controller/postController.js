// Controller/postController.js
const Post = require('../Models/Post');
const Diary = require('../Models/Diary');

// CREATE: from diary events (called by "Make Public" on diary-view.html)
exports.createFromDiary = async (req, res) => {
  try {
    const userId = req.info.id;                       
    const { date, diaryEventIds, content = '' } = req.body;

    if (!date || !Array.isArray(diaryEventIds) || diaryEventIds.length === 0) {
      return res.status(400).json({ success: false, message: 'date and diaryEventIds[] are required' });
    }

    // find the diary
    const diary = await Diary.findOne({ user: userId, date });
    if (!diary) {
      return res.status(404).json({ success: false, message: 'Diary for this date not found' });
    }

    // only keep selected events
    const selected = diary.events.filter(ev => diaryEventIds.includes(String(ev._id)));
    if (selected.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching events found in diary' });
    }

    // build post
    const post = new Post({
      userId: userId,   // ✅ match schema & populate field
      content: content,
      diaryEvents: selected.map(ev => ({
        eventId: String(ev._id),
        title: ev.title || '',
        description: ev.description || '',
        date: date,
        category: ev.category || 'Other',
        mood: ev.mood || 'Neutral',
        media: (ev.media || []).map(m => ({
          url: `/uploads/${m.filename || m.url}`,  // ✅ fix file path
          caption: m.caption || '',
          type: m.type || 'image'
        })),
        photo: (ev.media.find(m => m.type === 'image')
          ? `/uploads/${ev.media.find(m => m.type === 'image').filename || ev.media.find(m => m.type === 'image').url}`
          : '')
      }))
    });

    // ✅ save to database
    await post.save();

    return res.status(201).json({ success: true, message: 'Diary published as a post', post });
  } catch (err) {
    console.error('createFromDiary error:', err);
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
    .populate('userId', 'username profilePhoto')        // ✅ this will now work
    .populate('comments.userId', 'username profilePhoto'),
  Post.countDocuments()
]);


    return res.json({
      success: true,
      posts,
      totalPosts,
      page,
      limit
    });
  } catch (err) {
    console.error('getAllPosts error:', err);
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
    if (idx >= 0) post.likes.splice(idx, 1);
    else post.likes.push(userId);

    await post.save();
    res.json({ success: true, likesCount: post.likes.length });
  } catch (err) {
    console.error('toggleLike error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
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

    // return the post with populated comment user
    await post.populate('comments.userId', 'username profilePhoto');

    res.json({ success: true, post });
  } catch (err) {
    console.error('addComment error:', err);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};
