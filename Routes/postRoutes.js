const router = require('express').Router();
const auth = require('../middleware/authMiddleware'); // whatever sets req.info.id
const postController = require('../Controller/postController');

// create post from diary events
router.post('/', auth, postController.createFromDiary);

// list posts (public feed)
router.get('/', postController.getAllPosts);

// like/unlike
router.post('/:postId/like', auth, postController.toggleLike);

// comment
router.post('/:postId/comment', auth, postController.addComment);

module.exports = router;
