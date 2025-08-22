const User = require('../Models/User');
const Post = require('../Models/Post');
const Record = require('../Models/Record'); // Activity log
const mongoose = require('mongoose');

// Helper to log user activity
async function logActivity(userId, detail) {
    try {
        if (!userId) return; // skip if no user
        await Record.create({ user: userId, detail, date: new Date() });
    } catch (err) {
        console.error('[ActivityLog] Failed to log activity:', err.message);
    }
}

// Get user profile with paginated posts
exports.getUserProfile = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(userId).select('username email profilePhoto age sex');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const totalPosts = await Post.countDocuments({ userId });

    const posts = await Post.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', '_id username profilePhoto');

    const formattedPosts = posts.map(post => ({
      _id: post._id,
      userId: post.userId?._id || null,
      content: post.content || '',
      diaryEvents: (post.diaryEvents || []).map(ev => ({
        eventId: ev.eventId,
        title: ev.title || '',
        description: ev.description || '',
        date: ev.date || '',
        category: ev.category || '',
        mood: ev.mood || '',
        photo: ev.photo ? (typeof ev.photo === 'object' ? ev.photo.thumbnail || ev.photo.original : ev.photo) : '',
        media: (ev.media || []).map(m => ({
          url: typeof m.url === 'object' ? m.url.thumbnail || m.url.original : m.url,
          type: m.type || 'image',
          caption: m.caption || ''
        }))
      })),
      likes: post.likes || [],
      comments: post.comments || [],
      createdAt: post.createdAt
    }));

    const stats = await Post.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalLikes: { $sum: { $size: "$likes" } }, totalComments: { $sum: { $size: "$comments" } } } }
    ]);
    const totalLikes = stats[0]?.totalLikes || 0;
    const totalComments = stats[0]?.totalComments || 0;

    await logActivity(req.info.id || "Anonymous", `Viewed profile of user ${userId} (page ${page})`);

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        age: user.age,
        sex: user.sex,
      },
      posts: formattedPosts,
      totalPosts,
      totalLikes,
      totalComments,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit)
    });

  } catch (err) {
    console.error('getUserProfile error:', err);
    await logActivity(req.info.id || "Anonymous", `Failed to view profile of user ${userId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  const userId = req.info.id;
  const { postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ success: false, message: 'Invalid postId' });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (post.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // TODO: delete associated media files if needed

    await post.deleteOne();
    await logActivity(userId, `Deleted post ${postId}`);

    res.json({ success: true, message: 'Post deleted successfully' });

  } catch (err) {
    console.error('deletePost error:', err);
    await logActivity(userId, `Failed to delete post ${postId}: ${err.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
  
};


// GET all users
exports.getAllUsers = async (req, res) => {
    try {
        
             const users = await User.find({}, '_id username').lean(); // select fields you want to expose
            

        res.json({ success: true, users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};

