/**
 */

/**
 * Creates an info log event
 */
export function info(message: string, metadata: Record<string, any> = {}): Record<string, any> {
  return {
    type: "log",
    level: "info",
    message,
    timestamp: Date.now(),
    ...metadata,
  };
}

/**
 * Creates a warning log event
 */
export function warning(message: string, metadata: Record<string, any> = {}): Record<string, any> {
  return {
    type: "log",
    level: "warning",
    message,
    timestamp: Date.now(),
    ...metadata,
  };
}

/**
 * Creates an error log event
 */
export function error(
  message: string,
  error?: Error | unknown,
  metadata: Record<string, any> = {}
): Record<string, any> {
  const event: Record<string, any> = {
    type: "log",
    level: "error",
    message,
    timestamp: Date.now(),
    ...metadata,
  };

  if (error instanceof Error) {
    event.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error !== undefined) {
    // If error is provided but not an Error instance, treat it as additional metadata
    event.errorData = error;
  }

  return event;
}

/**
 * Creates a fatal error event
 */
export function fatal(
  message: string,
  error?: Error | unknown,
  metadata: Record<string, any> = {}
): Record<string, any> {
  const event: Record<string, any> = {
    type: "log",
    level: "fatal",
    message,
    timestamp: Date.now(),
    ...metadata,
  };

  if (error instanceof Error) {
    event.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else if (error !== undefined) {
    // If error is provided but not an Error instance, treat it as additional metadata
    event.errorData = error;
  }

  return event;
}

/**
 * Creates a performance log event
 */
export function performance(
  operation: string,
  duration: number,
  metadata: Record<string, any> = {}
): Record<string, any> {
  return {
    type: "performance",
    level: "info",
    message: `Performance: ${operation} took ${duration}ms`,
    operation,
    duration,
    timestamp: Date.now(),
    ...metadata,
  };
}

/**
 * Performance statistics object
 */
export interface PerformanceStats {
  count: number;
  total: number;
  average: number;
  minimum: number;
  maximum: number;
}

/**
 * Performance timer class for measuring operation durations
 */
export class PerformanceTimer {
  /**
   * Name of the operation being timed
   */
  name: string;

  /**
   * Array of duration measurements
   */
  measurements: number[];

  /**
   * Start time in milliseconds
   */
  startTime: number | null;

  /**
   * Whether the timer is currently running
   */
  isRunning: boolean;

  /**
   */
  constructor(name: string) {
    this.name = name;
    this.measurements = [];
    this.startTime = null;
    this.isRunning = false;
  }

  /**
   * Starts the timer
   */
  start(): PerformanceTimer {
    this.startTime = Date.now();
    this.isRunning = true;
    return this;
  }

  /**
   * Captures a measurement (for loop timing)
   */
  capture(): number {
    if (!this.isRunning) {
      throw new Error("Timer must be started before capturing measurements");
    }

    const now = Date.now();
    if (this.startTime === null) {
      throw new Error("Timer startTime is null");
    }

    const duration = now - this.startTime;
    this.measurements.push(duration);
    this.startTime = now; // Reset for next measurement
    return duration;
  }

  /**
   * Stops the timer and captures final measurement
   */
  stop(): number {
    if (!this.isRunning) {
      throw new Error("Timer is not running");
    }

    const duration = this.capture();
    this.isRunning = false;
    return duration;
  }

  /**
   * Gets performance statistics
   */
  getStats(): PerformanceStats {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        minimum: 0,
        maximum: 0,
      };
    }

    const total = this.measurements.reduce(
      (sum, duration) => sum + duration,
      0,
    );
    const average = total / this.measurements.length;
    const minimum = Math.min(...this.measurements);
    const maximum = Math.max(...this.measurements);

    return {
      count: this.measurements.length,
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      minimum: Math.round(minimum * 100) / 100,
      maximum: Math.round(maximum * 100) / 100,
    };
  }

  /**
   * Creates a performance event with statistics
   */
  performanceStats(metadata: Record<string, any> = {}): Record<string, any> {
    const stats = this.getStats();

    return {
      type: "performance",
      level: "info",
      message: `Performance: ${this.name} - ${stats.count} operations, avg: ${stats.average}ms, min: ${stats.minimum}ms, max: ${stats.maximum}ms, total: ${stats.total}ms`,
      operation: this.name,
      statistics: stats,
      timestamp: Date.now(),
      ...metadata,
    };
  }

  /**
   * Resets the timer, clearing all measurements
   */
  reset(): PerformanceTimer {
    this.measurements = [];
    this.startTime = null;
    this.isRunning = false;
    return this;
  }
}

/**
 * Creates a new performance timer
 */
export function createPerformanceTimer(name: string): PerformanceTimer {
  return new PerformanceTimer(name);
}

/**
 * Result of a measurement operation
 */
export interface MeasureResult<T> {
  result: T;
  event: Record<string, any>;
}

/**
 * Measures the execution time of a function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<MeasureResult<T>> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    return {
      result,
      event: performance(name, Math.round(duration * 100) / 100),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(
      `${name} failed after ${Math.round(duration * 100) / 100}ms: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Measures the execution time of a synchronous function
 */
export function measure<T>(
  name: string,
  fn: () => T
): MeasureResult<T> {
  const startTime = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    return {
      result,
      event: performance(name, Math.round(duration * 100) / 100),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(
      `${name} failed after ${Math.round(duration * 100) / 100}ms: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}