/**
 * Example usage function
 */
export function runDataProcessorExample(): Promise<any>;
/**
 * Example data processing runnable that demonstrates all helper functions
 */
export class DataProcessorRunnable extends Runnable<any, any, any, any> {
	constructor(options?: {});
	batchSize: any;
	maxRetries: any;
	invoke(
		input: any,
		context: any,
	): AsyncGenerator<
		any,
		| {
				processed: any;
				skipped: number;
				errors: number;
				total: number;
		  }
		| {
				processed: any[];
				skipped: number;
				errors: number;
		  },
		unknown
	>;
	/**
	 * Process a single batch of items
	 * @param {Array} batch - Items to process
	 * @param {number} batchNumber - Batch number for logging
	 * @returns {Promise<{processed: Array, skipped: number, errors: number, events: Array}>}
	 */
	processBatch(
		batch: any[],
		batchNumber: number,
	): Promise<{
		processed: any[];
		skipped: number;
		errors: number;
		events: any[];
	}>;
	/**
	 * Process a single item
	 * @param {any} item - Item to process
	 * @returns {Promise<any>} Processed item
	 */
	processItem(item: any): Promise<any>;
	/**
	 * Validate the final results
	 * @param {Array} results - Processed results
	 * @returns {Array} Validated results
	 */
	validateResults(results: any[]): any[];
}
import { Runnable } from "../runnable.js";
