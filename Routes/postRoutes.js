const router = require('express').Router();
const auth = require('../middleware/authMiddleware'); // whatever sets req.info.id
const postController = require('../Controller/postController');

// create post from diary events
router.post('/', auth, postController.createFromDiary);

// list posts (public feed)
router.get('/', auth, postController.getAllPosts);

// get single post
router.get('/:postId', auth, postController.getPostById);

// like/unlike post
router.post('/:postId/like', auth, postController.toggleLike);

// add comment (now supports replies via parentId in body)
router.post('/:postId/comment', auth, postController.addComment);

// like/unlike a comment
router.post('/:postId/comment/:commentId/like', auth, postController.toggleCommentLike);

module.exports = router;