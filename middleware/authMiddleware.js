const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/responseFormatter'); 
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateUser = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.info = decoded; // attaches user info to request
    next(); 
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

//

module.exports = authenticateUser;
