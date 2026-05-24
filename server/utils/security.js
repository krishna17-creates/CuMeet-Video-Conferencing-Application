/**
 * Security Utilities
 * Rate limiting, JWT helpers, and security best practices
 */

const jwt = require('jsonwebtoken');
const { createLogger } = require('./logger');
const { ERROR_CODES, ERROR_MESSAGES } = require('../config/constants');

const logger = createLogger('Security');

const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 */
const rateLimiter = (windowMs, maxRequests) => {
  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key).filter((time) => now - time < windowMs);

    if (requests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        requests: requests.length,
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    }

    requests.push(now);
    rateLimitStore.set(key, requests);
    next();
  };
};

/**
 * Generate JWT token
 */
const generateToken = (userId, expiresIn = '7d') => {
  try {
    const token = jwt.sign(
      { userId, iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn }
    );

    return token;
  } catch (error) {
    logger.error('Failed to generate token', { userId, error: error.message });
    throw error;
  }
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    return decoded;
  } catch (error) {
    logger.warn('Token verification failed', { error: error.message });
    throw error;
  }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
};

/**
 * Hash IP address for privacy
 */
const hashIP = (ip) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 8);
};

/**
 * Sanitize error messages to prevent info leakage
 */
const sanitizeErrorMessage = (message, isDevelopment = false) => {
  if (isDevelopment) {
    return message;
  }

  const sensitivePatterns = ['database', 'query', 'connection', 'password'];
  let sanitized = message;

  sensitivePatterns.forEach((pattern) => {
    const regex = new RegExp(pattern, 'gi');
    if (regex.test(sanitized)) {
      sanitized = 'An error occurred. Please try again.';
    }
  });

  return sanitized;
};

/**
 * Validate CORS origin
 */
const isValidOrigin = (origin, allowedOrigins) => {
  if (!origin) return true; // Allow requests without origin (same-origin)

  const normalized = origin.replace(/\/+$/, '').toLowerCase();
  return allowedOrigins.some((allowed) =>
    normalized === allowed.replace(/\/+$/, '').toLowerCase()
  );
};

/**
 * CSRF token generation (simple implementation)
 */
const generateCSRFToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF token validation
 */
const validateCSRFToken = (token, storedToken) => {
  if (!token || !storedToken) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
};

module.exports = {
  rateLimiter,
  generateToken,
  verifyToken,
  extractToken,
  hashIP,
  sanitizeErrorMessage,
  isValidOrigin,
  generateCSRFToken,
  validateCSRFToken,
};
