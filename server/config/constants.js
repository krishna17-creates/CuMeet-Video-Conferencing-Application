/**
 * Application Constants
 * Centralized error codes, messages, and HTTP status codes
 */

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'AUTH_001',
  USER_NOT_FOUND: 'AUTH_002',
  USER_ALREADY_EXISTS: 'AUTH_003',
  INVALID_TOKEN: 'AUTH_004',
  TOKEN_EXPIRED: 'AUTH_005',
  UNAUTHORIZED_ACCESS: 'AUTH_006',

  // Validation errors
  MISSING_FIELDS: 'VALIDATION_001',
  INVALID_FORMAT: 'VALIDATION_002',
  INVALID_EMAIL: 'VALIDATION_003',
  PASSWORD_TOO_WEAK: 'VALIDATION_004',

  // Meeting errors
  MEETING_NOT_FOUND: 'MEETING_001',
  MEETING_EXPIRED: 'MEETING_002',
  MEETING_FULL: 'MEETING_003',
  INVALID_MEETING_ACCESS: 'MEETING_004',

  // Room/SFU errors
  ROOM_NOT_FOUND: 'ROOM_001',
  TRANSPORT_ERROR: 'ROOM_002',
  PRODUCER_ERROR: 'ROOM_003',
  CONSUMER_ERROR: 'ROOM_004',

  // General errors
  INTERNAL_ERROR: 'SERVER_001',
  DATABASE_ERROR: 'SERVER_002',
  EXTERNAL_SERVICE_ERROR: 'SERVER_003',
};

const ERROR_MESSAGES = {
  AUTH_001: 'Invalid email or password',
  AUTH_002: 'User not found',
  AUTH_003: 'User with this email already exists',
  AUTH_004: 'Invalid or malformed token',
  AUTH_005: 'Token has expired',
  AUTH_006: 'Unauthorized access',

  VALIDATION_001: 'Missing required fields',
  VALIDATION_002: 'Invalid data format',
  VALIDATION_003: 'Invalid email format',
  VALIDATION_004: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',

  MEETING_001: 'Meeting not found',
  MEETING_002: 'Meeting has expired',
  MEETING_003: 'Meeting is at full capacity',
  MEETING_004: 'You do not have access to this meeting',

  ROOM_001: 'Room not found',
  ROOM_002: 'Failed to create transport',
  ROOM_003: 'Failed to create producer',
  ROOM_004: 'Failed to create consumer',

  SERVER_001: 'Internal server error',
  SERVER_002: 'Database operation failed',
  SERVER_003: 'External service is unavailable',
};

const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
};

const RATE_LIMIT = {
  AUTH_REQUESTS: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 requests per 15 min
  API_REQUESTS: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per min
  SOCKET_EVENTS: { windowMs: 1000, maxEvents: 50 }, // 50 events per second
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  VALIDATION_RULES,
  RATE_LIMIT,
};
