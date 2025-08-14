// validators/authValidator.js
const { body, validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../utils/responseFormatter');

class AuthValidator {
 registerValidator() {
    return [
      body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),

      body('email')
        .trim()
        .isEmail().withMessage('Invalid email format'),

      body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character'),
    ];
  }

   loginValidator() {
  return [
    body('email')
      .trim()
      .isEmail().withMessage('Valid email is required'),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ];
}



validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors = {};
    errors.array().forEach(err => {
      fieldErrors[err.path] = err.msg;
    });
    return sendError(res, 'Validation failed', 400, fieldErrors);
  }
  next();
};


}

module.exports =new  AuthValidator();
