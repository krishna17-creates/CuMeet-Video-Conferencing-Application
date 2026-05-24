/**
 * Request Validator Middleware
 * Validates request body, params, and query
 */

const { ValidationError } = require('../utils/validation');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RequestValidator');

/**
 * Validate request body
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      logger.warn('Request validation failed', {
        path: req.path,
        body: req.body,
        error: error.message,
      });
      next(error);
    }
  };
};

/**
 * Validate query parameters
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      logger.warn('Query validation failed', {
        path: req.path,
        query: req.query,
        error: error.message,
      });
      next(error);
    }
  };
};

/**
 * Validate URL parameters
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema(req.params);
      req.validatedParams = validated;
      next();
    } catch (error) {
      logger.warn('Params validation failed', {
        path: req.path,
        params: req.params,
        error: error.message,
      });
      next(error);
    }
  };
};

/**
 * Middleware to sanitize user input
 */
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  next();
};

/**
 * Helper to sanitize objects
 */
const sanitizeObject = (obj) => {
  const sanitized = {};
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'string') {
      sanitized[key] = obj[key].trim().replace(/[<>]/g, '');
    } else {
      sanitized[key] = obj[key];
    }
  });
  return sanitized;
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  sanitizeInput,
};
