const User = require('../Models/User');
const Post = require('../Models/Post');
const mongoose = require('mongoose');

// Get user profile with paginated posts
exports.getUserProfile = async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        // Get user info
        const user = await User.findById(userId).select('username email profilePhoto age sex');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Count total posts
        const totalPosts = await Post.countDocuments({ userId });

        // Get paginated posts
        const posts = await Post.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
             .populate('userId', '_id username profilePhoto');

        // Format posts for frontend
    const formattedPosts = posts.map(post => ({
    _id: post._id,
    userId: post.userId ? post.userId._id : null, 
    content: post.content || '',
    diaryEvents: (post.diaryEvents || []).map(ev => ({
        eventId: ev.eventId,
        title: ev.title || '',
        description: ev.description || '',
        date: ev.date || '',
        category: ev.category || '',
        mood: ev.mood || '',
        photo: ev.photo || '',
        media: (ev.media || []).map(m => ({
            url: m.url,
            type: m.type,
            caption: m.caption || ''
        }))
    })),
    likes: post.likes || [],
    comments: post.comments || [],
    createdAt: post.createdAt
}));



        // Total likes & comments across all posts (optional)
        const allPosts = await Post.find({ userId });
        const totalLikes = allPosts.reduce((sum, post) => sum + post.likes.length, 0);
        const totalComments = allPosts.reduce((sum, post) => sum + post.comments.length, 0);

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
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


exports.deletePost = async (req, res) => {
    const userId = req.info.id;

    const { postId } = req.params;

    try {
        console.log('Received postId:', postId);
        console.log('Valid ObjectId?', mongoose.Types.ObjectId.isValid(postId));
        console.log('req.info.id:', req.info.id);

        const post = await Post.findById(postId);
        if (!post) {
            console.log('Post not found');
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        console.log('post.userId:', post.userId.toString());

        // Ownership check
        if (post.userId.toString() !== req.info.id) {
            console.log('Unauthorized access');
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Delete post
        const deleted = await post.deleteOne();  // safer than findByIdAndDelete here
        console.log('Deleted result:', deleted);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (err) {
        console.error('Delete post error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
