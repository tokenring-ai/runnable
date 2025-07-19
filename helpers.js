/**
 * @fileoverview Helper functions for creating standardized events in runnables
 */

/**
 * Creates an info log event
 * @param {string} message - The info message
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Info event object
 */
export function info(message, metadata = {}) {
  return {
    type: 'log',
    level: 'info',
    message,
    timestamp: Date.now(),
    ...metadata
  };
}

/**
 * Creates a warning log event
 * @param {string} message - The warning message
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Warning event object
 */
export function warning(message, metadata = {}) {
  return {
    type: 'log',
    level: 'warning',
    message,
    timestamp: Date.now(),
    ...metadata
  };
}

/**
 * Creates an error log event
 * @param {string} message - The error message
 * @param {Error} [error] - Optional error object
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Error event object
 */
export function error(message, error, metadata = {}) {
  const event = {
    type: 'log',
    level: 'error',
    message,
    timestamp: Date.now(),
    ...metadata
  };

  if (error instanceof Error) {
    event.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  } else if (error !== undefined) {
    // If error is provided but not an Error instance, treat it as additional metadata
    event.errorData = error;
  }

  return event;
}

/**
 * Creates a fatal error event
 * @param {string} message - The fatal error message
 * @param {Error} [error] - Optional error object
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Fatal error event object
 */
export function fatal(message, error, metadata = {}) {
  const event = {
    type: 'log',
    level: 'fatal',
    message,
    timestamp: Date.now(),
    ...metadata
  };

  if (error instanceof Error) {
    event.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  } else if (error !== undefined) {
    // If error is provided but not an Error instance, treat it as additional metadata
    event.errorData = error;
  }

  return event;
}

/**
 * Creates a performance log event
 * @param {string} operation - The operation being measured
 * @param {number} duration - Duration in milliseconds
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Performance event object
 */
export function performance(operation, duration, metadata = {}) {
  return {
    type: 'performance',
    level: 'info',
    message: `Performance: ${operation} took ${duration}ms`,
    operation,
    duration,
    timestamp: Date.now(),
    ...metadata
  };
}

/**
 * Performance timer class for measuring operation durations
 */
export class PerformanceTimer {
  /**
   * @param {string} name - Name of the operation being timed
   */
  constructor(name) {
    this.name = name;
    this.measurements = [];
    this.startTime = null;
    this.isRunning = false;
  }

  /**
   * Starts the timer
   * @returns {PerformanceTimer} Returns this for chaining
   */
  start() {
    this.startTime = Date.now();
    this.isRunning = true;
    return this;
  }

  /**
   * Captures a measurement (for loop timing)
   * @returns {number} The duration of this measurement
   */
  capture() {
    if (!this.isRunning) {
      throw new Error('Timer must be started before capturing measurements');
    }
    
    const now = Date.now();
    const duration = now - this.startTime;
    this.measurements.push(duration);
    this.startTime = now; // Reset for next measurement
    return duration;
  }

  /**
   * Stops the timer and captures final measurement
   * @returns {number} The duration of the final measurement
   */
  stop() {
    if (!this.isRunning) {
      throw new Error('Timer is not running');
    }
    
    const duration = this.capture();
    this.isRunning = false;
    return duration;
  }

  /**
   * Gets performance statistics
   * @returns {Object} Statistics object with min, max, average, total, and count
   */
  getStats() {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        minimum: 0,
        maximum: 0
      };
    }

    const total = this.measurements.reduce((sum, duration) => sum + duration, 0);
    const average = total / this.measurements.length;
    const minimum = Math.min(...this.measurements);
    const maximum = Math.max(...this.measurements);

    return {
      count: this.measurements.length,
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      minimum: Math.round(minimum * 100) / 100,
      maximum: Math.round(maximum * 100) / 100
    };
  }

  /**
   * Creates a performance event with statistics
   * @param {Object} [metadata={}] - Additional metadata to include
   * @returns {Object} Performance event object with statistics
   */
  performanceStats(metadata = {}) {
    const stats = this.getStats();
    
    return {
      type: 'performance',
      level: 'info',
      message: `Performance: ${this.name} - ${stats.count} operations, avg: ${stats.average}ms, min: ${stats.minimum}ms, max: ${stats.maximum}ms, total: ${stats.total}ms`,
      operation: this.name,
      statistics: stats,
      timestamp: Date.now(),
      ...metadata
    };
  }

  /**
   * Resets the timer, clearing all measurements
   * @returns {PerformanceTimer} Returns this for chaining
   */
  reset() {
    this.measurements = [];
    this.startTime = null;
    this.isRunning = false;
    return this;
  }
}

/**
 * Creates a new performance timer
 * @param {string} name - Name of the operation being timed
 * @returns {PerformanceTimer} New performance timer instance
 */
export function createPerformanceTimer(name) {
  return new PerformanceTimer(name);
}

/**
 * Measures the execution time of a function
 * @param {string} name - Name of the operation
 * @param {Function} fn - Function to measure
 * @returns {Promise<{result: any, event: Object}>} Result and performance event
 */
export async function measureAsync(name, fn) {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    return {
      result,
      event: performance(name, Math.round(duration * 100) / 100)
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(`${name} failed after ${Math.round(duration * 100) / 100}ms: ${error.message}`);
  }
}

/**
 * Measures the execution time of a synchronous function
 * @param {string} name - Name of the operation
 * @param {Function} fn - Function to measure
 * @returns {{result: any, event: Object}} Result and performance event
 */
export function measure(name, fn) {
  const startTime = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    return {
      result,
      event: performance(name, Math.round(duration * 100) / 100)
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(`${name} failed after ${Math.round(duration * 100) / 100}ms: ${error.message}`);
  }
}