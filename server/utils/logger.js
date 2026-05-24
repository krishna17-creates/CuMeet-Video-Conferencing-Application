/**
 * Logging Service
 * Centralized logging with different levels
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
};

const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m', // Yellow
  INFO: '\x1b[36m', // Cyan
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m',
};

class Logger {
  constructor(moduleName = 'APP') {
    this.moduleName = moduleName;
    this.level = process.env.LOG_LEVEL || LOG_LEVELS.INFO;
    this.logsDir = path.join(__dirname, '../logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Format log message
   */
  format(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const dataStr = Object.keys(data).length > 0 ? JSON.stringify(data) : '';

    return {
      timestamp,
      level: levelName,
      module: this.moduleName,
      message,
      data: dataStr,
      formatted: `[${timestamp}] [${levelName}] [${this.moduleName}] ${message}${dataStr ? ' ' + dataStr : ''}`,
    };
  }

  /**
   * Write log to file
   */
  writeToFile(log) {
    try {
      const logFile = path.join(this.logsDir, `${log.level}.log`);
      const line = log.formatted + '\n';
      fs.appendFileSync(logFile, line);
    } catch (error) {
      console.error('Failed to write log to file:', error.message);
    }
  }

  /**
   * Log error
   */
  error(message, data = {}) {
    if (this.level >= LOG_LEVELS.ERROR) {
      const log = this.format(LOG_LEVELS.ERROR, message, data);
      console.log(`${COLORS.ERROR}${log.formatted}${COLORS.RESET}`);
      this.writeToFile(log);
    }
  }

  /**
   * Log warning
   */
  warn(message, data = {}) {
    if (this.level >= LOG_LEVELS.WARN) {
      const log = this.format(LOG_LEVELS.WARN, message, data);
      console.log(`${COLORS.WARN}${log.formatted}${COLORS.RESET}`);
      this.writeToFile(log);
    }
  }

  /**
   * Log info
   */
  info(message, data = {}) {
    if (this.level >= LOG_LEVELS.INFO) {
      const log = this.format(LOG_LEVELS.INFO, message, data);
      console.log(`${COLORS.INFO}${log.formatted}${COLORS.RESET}`);
      this.writeToFile(log);
    }
  }

  /**
   * Log debug
   */
  debug(message, data = {}) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      const log = this.format(LOG_LEVELS.DEBUG, message, data);
      console.log(`${COLORS.DEBUG}${log.formatted}${COLORS.RESET}`);
      this.writeToFile(log);
    }
  }
}

// Export factory function
const createLogger = (moduleName) => new Logger(moduleName);

module.exports = { Logger, createLogger, LOG_LEVELS };
