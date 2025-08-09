/**
 * @fileoverview Helper functions for creating standardized events in runnables
 */
/**
 * Creates an info log event
 * @param {string} message - The info message
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Info event object
 */
export function info(message: string, metadata?: any): any;
/**
 * Creates a warning log event
 * @param {string} message - The warning message
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Warning event object
 */
export function warning(message: string, metadata?: any): any;
/**
 * Creates an error log event
 * @param {string} message - The error message
 * @param {Error} [error] - Optional error object
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Error event object
 */
export function error(message: string, error?: Error, metadata?: any): any;
/**
 * Creates a fatal error event
 * @param {string} message - The fatal error message
 * @param {Error} [error] - Optional error object
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Fatal error event object
 */
export function fatal(message: string, error?: Error, metadata?: any): any;
/**
 * Creates a performance log event
 * @param {string} operation - The operation being measured
 * @param {number} duration - Duration in milliseconds
 * @param {Object} [metadata={}] - Additional metadata to include
 * @returns {Object} Performance event object
 */
export function performance(
	operation: string,
	duration: number,
	metadata?: any,
): any;
/**
 * Creates a new performance timer
 * @param {string} name - Name of the operation being timed
 * @returns {PerformanceTimer} New performance timer instance
 */
export function createPerformanceTimer(name: string): PerformanceTimer;
/**
 * Measures the execution time of a function
 * @param {string} name - Name of the operation
 * @param {Function} fn - Function to measure
 * @returns {Promise<{result: any, event: Object}>} Result and performance event
 */
export function measureAsync(
	name: string,
	fn: Function,
): Promise<{
	result: any;
	event: any;
}>;
/**
 * Measures the execution time of a synchronous function
 * @param {string} name - Name of the operation
 * @param {Function} fn - Function to measure
 * @returns {{result: any, event: Object}} Result and performance event
 */
export function measure(
	name: string,
	fn: Function,
): {
	result: any;
	event: any;
};
/**
 * Performance timer class for measuring operation durations
 */
export class PerformanceTimer {
	/**
	 * @param {string} name - Name of the operation being timed
	 */
	constructor(name: string);
	name: string;
	measurements: any[];
	startTime: number;
	isRunning: boolean;
	/**
	 * Starts the timer
	 * @returns {PerformanceTimer} Returns this for chaining
	 */
	start(): PerformanceTimer;
	/**
	 * Captures a measurement (for loop timing)
	 * @returns {number} The duration of this measurement
	 */
	capture(): number;
	/**
	 * Stops the timer and captures final measurement
	 * @returns {number} The duration of the final measurement
	 */
	stop(): number;
	/**
	 * Gets performance statistics
	 * @returns {Object} Statistics object with min, max, average, total, and count
	 */
	getStats(): any;
	/**
	 * Creates a performance event with statistics
	 * @param {Object} [metadata={}] - Additional metadata to include
	 * @returns {Object} Performance event object with statistics
	 */
	performanceStats(metadata?: any): any;
	/**
	 * Resets the timer, clearing all measurements
	 * @returns {PerformanceTimer} Returns this for chaining
	 */
	reset(): PerformanceTimer;
}
