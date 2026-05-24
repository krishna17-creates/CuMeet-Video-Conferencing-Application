/**
 * Validation Utilities
 * Schema validation and data sanitization
 */

const { VALIDATION_RULES, ERROR_CODES, ERROR_MESSAGES } = require('../config/constants');

class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ValidationError';
  }
}

/**
 * Validate email format
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Email must be a string');
  }

  const trimmed = email.trim().toLowerCase();
  if (!VALIDATION_RULES.EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError(ERROR_CODES.INVALID_EMAIL, ERROR_MESSAGES.VALIDATION_003);
  }

  return trimmed;
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Password must be a string');
  }

  if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
    throw new ValidationError(ERROR_CODES.PASSWORD_TOO_WEAK, ERROR_MESSAGES.VALIDATION_004);
  }

  if (!VALIDATION_RULES.PASSWORD_REGEX.test(password)) {
    throw new ValidationError(ERROR_CODES.PASSWORD_TOO_WEAK, ERROR_MESSAGES.VALIDATION_004);
  }

  return password;
};

/**
 * Validate name
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Name must be a string');
  }

  const trimmed = name.trim();
  if (trimmed.length < VALIDATION_RULES.NAME_MIN_LENGTH || trimmed.length > VALIDATION_RULES.NAME_MAX_LENGTH) {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, `Name must be between ${VALIDATION_RULES.NAME_MIN_LENGTH} and ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`);
  }

  return trimmed;
};

/**
 * Validate meeting title
 */
const validateMeetingTitle = (title) => {
  if (!title || typeof title !== 'string') {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Meeting title must be a string');
  }

  const trimmed = title.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Meeting title must be between 2 and 100 characters');
  }

  return trimmed;
};

/**
 * Validate meeting duration
 */
const validateDuration = (duration) => {
  if (typeof duration !== 'number') {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Duration must be a number');
  }

  if (duration < 15 || duration > 480) {
    throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Duration must be between 15 and 480 minutes');
  }

  return duration;
};

/**
 * Validate signup request
 */
const validateSignup = ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw new ValidationError(ERROR_CODES.MISSING_FIELDS, ERROR_MESSAGES.VALIDATION_001);
  }

  return {
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
  };
};

/**
 * Validate login request
 */
const validateLogin = ({ email, password }) => {
  if (!email || !password) {
    throw new ValidationError(ERROR_CODES.MISSING_FIELDS, ERROR_MESSAGES.VALIDATION_001);
  }

  return {
    email: validateEmail(email),
    password,
  };
};

/**
 * Validate create meeting request
 */
const validateCreateMeeting = ({ title, description, scheduledAt, duration, participants }) => {
  if (!title) {
    throw new ValidationError(ERROR_CODES.MISSING_FIELDS, 'Meeting title is required');
  }

  const validatedData = {
    title: validateMeetingTitle(title),
  };

  if (description && typeof description === 'string') {
    validatedData.description = description.trim();
  }

  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) {
      throw new ValidationError(ERROR_CODES.INVALID_FORMAT, 'Invalid scheduledAt format');
    }
    validatedData.scheduledAt = date;
  }

  if (duration) {
    validatedData.duration = validateDuration(duration);
  }

  if (participants && Array.isArray(participants)) {
    validatedData.participants = participants.map((p) => validateEmail(p));
  }

  return validatedData;
};

/**
 * Sanitize user input
 */
const sanitize = (data) => {
  if (typeof data === 'string') {
    return data.trim().replace(/[<>]/g, '');
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    Object.keys(data).forEach((key) => {
      sanitized[key] = sanitize(data[key]);
    });
    return sanitized;
  }

  return data;
};

module.exports = {
  ValidationError,
  validateEmail,
  validatePassword,
  validateName,
  validateMeetingTitle,
  validateDuration,
  validateSignup,
  validateLogin,
  validateCreateMeeting,
  sanitize,
};
