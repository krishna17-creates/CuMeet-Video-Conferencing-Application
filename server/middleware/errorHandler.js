/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

const { HTTP_STATUS, ERROR_CODES, ERROR_MESSAGES } = require('../config/constants');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ErrorHandler');

/**
 * Custom Application Error
 */
class AppError extends Error {
  constructor(statusCode = 500, code = ERROR_CODES.INTERNAL_ERROR, message = ERROR_MESSAGES.SERVER_001) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Format error response
 */
const formatErrorResponse = (error) => {
  const response = {
    success: false,
    error: {
      code: error.code || ERROR_CODES.INTERNAL_ERROR,
      message: error.message || ERROR_MESSAGES.SERVER_001,
      timestamp: error.timestamp || new Date().toISOString(),
    },
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.error.stack = error.stack;
  }

  return response;
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || HTTP_STATUS.SERVER_ERROR;
  let code = err.code || ERROR_CODES.INTERNAL_ERROR;
  let message = err.message || ERROR_MESSAGES.SERVER_001;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.VALIDATION_ERROR;
    code = err.code || ERROR_CODES.MISSING_FIELDS;
    message = err.message || ERROR_MESSAGES.VALIDATION_001;
  } else if (err.name === 'MongoError') {
    statusCode = HTTP_STATUS.SERVER_ERROR;
    code = ERROR_CODES.DATABASE_ERROR;
    message = 'Database operation failed';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    code = ERROR_CODES.INVALID_TOKEN;
    message = ERROR_MESSAGES.AUTH_004;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    code = ERROR_CODES.TOKEN_EXPIRED;
    message = ERROR_MESSAGES.AUTH_005;
  } else if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    code = ERROR_CODES.INVALID_FORMAT;
    message = 'Invalid ID format';
  }

  // Log error
  const logData = {
    statusCode,
    code,
    path: req.path,
    method: req.method,
    userId: req.user?.userId || 'anonymous',
  };

  if (statusCode >= HTTP_STATUS.SERVER_ERROR) {
    logger.error(message, logData);
  } else {
    logger.warn(message, logData);
  }

  // Create error object for response
  const errorObj = new AppError(statusCode, code, message);

  // Send response
  res.status(statusCode).json(formatErrorResponse(errorObj));
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  const error = new AppError(
    HTTP_STATUS.NOT_FOUND,
    'NOT_FOUND',
    `Route not found: ${req.method} ${req.path}`
  );

  logger.warn(`Route not found: ${req.method} ${req.path}`, {
    path: req.path,
    method: req.method,
  });

  res.status(HTTP_STATUS.NOT_FOUND).json(formatErrorResponse(error));
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
};
