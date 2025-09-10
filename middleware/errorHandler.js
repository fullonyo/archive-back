const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000 || err.errno === 1062) {
    let message = 'Duplicate field value entered';
    
    if (err.sqlMessage) {
      if (err.sqlMessage.includes('email')) {
        message = 'Email already exists';
      } else if (err.sqlMessage.includes('username')) {
        message = 'Username already taken';
      }
    }
    
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // MySQL errors
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        error = { message: 'Duplicate entry', statusCode: 400 };
        break;
      case 'ER_NO_SUCH_TABLE':
        error = { message: 'Database table not found', statusCode: 500 };
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        error = { message: 'Database access denied', statusCode: 500 };
        break;
      case 'ECONNREFUSED':
        error = { message: 'Database connection refused', statusCode: 500 };
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          error = { message: err.message, statusCode: 500 };
        } else {
          error = { message: 'Server error', statusCode: 500 };
        }
    }
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = { message: 'File too large', statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = { message: 'Too many files', statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = { message: 'Unexpected file field', statusCode: 400 };
  }

  // Google Drive API errors
  if (err.message && err.message.includes('Google Drive')) {
    error = { message: 'File storage error', statusCode: 500 };
  }

  // Rate limiting errors
  if (err.message && err.message.includes('Too many requests')) {
    error = { message: err.message, statusCode: 429 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
};

module.exports = errorHandler; 