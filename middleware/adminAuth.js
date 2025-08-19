// middlewares/adminAuth.js
require('dotenv').config(); // load .env
module.exports = function adminAuth(req, res, next) {
  if (!req.info) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (!req.info.isAdmin) {
    return res.status(403).json({ message: 'Admin access only' });
  }

  next();
};
