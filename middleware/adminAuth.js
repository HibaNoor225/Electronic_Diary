// middlewares/adminAuth.js
module.exports = function adminAuth(req, res, next) {
  // Assuming you have req.user populated from your auth middleware (JWT/session)
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }

  // User is admin, continue
  next();
};
