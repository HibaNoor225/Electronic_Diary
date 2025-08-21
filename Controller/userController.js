const User = require('../Models/User');
const Post = require('../Models/Post');
const mongoose = require('mongoose');

// Get user profile with paginated posts
exports.getUserProfile = async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        // Validate userId first
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        // Get user info
        const user = await User.findById(userId).select('username email profilePhoto age sex');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Count total posts
        const totalPosts = await Post.countDocuments({ userId });

        // Get paginated posts
        const posts = await Post.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', '_id username profilePhoto');

        // Format posts
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

        // Aggregate total likes and comments
        const stats = await Post.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: null, totalLikes: { $sum: { $size: "$likes" } }, totalComments: { $sum: { $size: "$comments" } } } }
        ]);
        const totalLikes = stats[0]?.totalLikes || 0;
        const totalComments = stats[0]?.totalComments || 0;

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

        // Ownership check
        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // TODO: If needed, delete associated uploaded media files here

        await post.deleteOne();
        res.json({ success: true, message: 'Post deleted successfully' });

    } catch (err) {
        console.error('deletePost error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
