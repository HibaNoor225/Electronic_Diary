const User = require('../Models/User');
const Post = require('../Models/Post');

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
            .limit(limit);

        // Format posts for frontend
        const formattedPosts = posts.map(post => ({
            _id: post._id,
            content: post.content,
            createdAt: post.createdAt,
          diaryEvents: post.diaryEvents.map(ev => ({
        eventId: ev.eventId,
        title: ev.title,
        description: ev.description,
        date: ev.date,
        category: ev.category,
        mood: ev.mood,
        photo: ev.photo
    })),
            likes: post.likes,
            comments: post.comments
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
