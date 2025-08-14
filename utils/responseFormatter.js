function sendSuccess(
  res,
  message = "Success",
  data = null,
  statusCode = 200
) {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null // always consistent
  });
}

function sendError(
  res,
  message = "Something went wrong",
  statusCode = 500,
  errors = null,
  data = null
) {
  let formattedErrors = null;

  // If errors come from express-validator
  if (Array.isArray(errors)) {
    formattedErrors = {};
    errors.forEach(err => {
      if (err.path && err.msg) {
        formattedErrors[err.path] = err.msg;
      }
    });
  }
  // If errors come from Mongoose validation
  else if (errors && typeof errors === "object") {
    formattedErrors = {};
    for (let key in errors) {
      // If it's Mongoose's error object with .message
      if (errors[key]?.message) {
        formattedErrors[key] = errors[key].message;
      } else {
        formattedErrors[key] = errors[key];
      }
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: formattedErrors, // Always either null or { field: "message" }
    data
  });
}

module.exports = { sendSuccess, sendError };
