/**
 * @fileoverview Example runnable demonstrating the use of helper functions
 */

import {Runnable} from "../runnable.js";
import {createPerformanceTimer, error, fatal, info, measure, measureAsync, warning,} from "../helpers.js";

/**
 * Example data processing runnable that demonstrates all helper functions
 */
export class DataProcessorRunnable extends Runnable {
	batchSize: number;
	maxRetries: number;

	constructor(options: Record<string, any> = {}) {
		super({ name: "DataProcessor", ...options });
		this.batchSize = options.batchSize || 100;
		this.maxRetries = options.maxRetries || 3;
	}

	async *invoke(
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
	> {
		yield info("Starting data processing", {
			inputSize: input?.length || 0,
			batchSize: this.batchSize,
		});

		try {
			// Validate input
			if (!Array.isArray(input)) {
				yield fatal("Invalid input: expected array", null, {
					inputType: typeof input,
				});
				throw new Error("Invalid input format");
			}

			if (input.length === 0) {
				yield warning("Empty input array provided");
				return { processed: [], skipped: 0, errors: 0 };
			}

			// Process data in batches
			const results: any[] = [];
			let totalSkipped = 0;
			let totalErrors = 0;

			const batchTimer = createPerformanceTimer("Batch Processing");

			for (let i = 0; i < input.length; i += this.batchSize) {
				const batch = input.slice(i, i + this.batchSize);
				const batchNumber = Math.floor(i / this.batchSize) + 1;
				const totalBatches = Math.ceil(input.length / this.batchSize);

				yield info(`Processing batch ${batchNumber}/${totalBatches}`, {
					batchSize: batch.length,
					startIndex: i,
				});

				batchTimer.start();

				try {
					const batchResult = await this.processBatch(batch, batchNumber);

					// Yield individual processing events
					for await (const event of batchResult.events) {
						yield event;
					}

					results.push(...batchResult.processed);
					totalSkipped += batchResult.skipped;
					totalErrors += batchResult.errors;

					batchTimer.capture();
				} catch (batchError) {
					yield error(`Batch ${batchNumber} failed completely`, batchError, {
						batchNumber,
						batchSize: batch.length,
					});
					totalErrors += batch.length;
					batchTimer.capture();
				}

				// Check abort signal between batches
				if (this.abortSignal.aborted) {
					yield warning("Processing aborted by user", {
						processedBatches: batchNumber,
						totalBatches,
					});
					break;
				}
			}

			// Yield batch processing statistics
			yield batchTimer.performanceStats({
				totalBatches: batchTimer.measurements.length,
				inputSize: input.length,
			});

			// Final validation and cleanup
			const { result: finalResult, event: validationEvent } =
				await measureAsync("Final Validation", () =>
					this.validateResults(results),
				);
			yield validationEvent;

			const summary = {
				processed: finalResult,
				skipped: totalSkipped,
				errors: totalErrors,
				total: input.length,
			};

			yield info("Data processing completed successfully", summary);
			return summary;
		} catch (err) {
			yield fatal("Data processing failed catastrophically", err);
			throw err;
		}
	}

	/**
	 * Process a single batch of items
	 * @param {Array} batch - Items to process
	 * @param {number} batchNumber - Batch number for logging
	 * @returns {Promise<{processed: Array, skipped: number, errors: number, events: Array}>}
	 */
	async processBatch(
		batch: any[],
		batchNumber: number,
	): Promise<{
		processed: any[];
		skipped: number;
		errors: number;
		events: any[];
	}> {
		const processed: any[] = [];
		let skipped = 0;
		let errors = 0;
		const events: any[] = [];

		const itemTimer = createPerformanceTimer("Item Processing");

		for (let i = 0; i < batch.length; i++) {
			const item = batch[i];
			itemTimer.start();

			try {
				// Simulate different processing scenarios
				if (item === null || item === undefined) {
					events.push(
						warning(
							`Skipping null/undefined item at batch ${batchNumber}, index ${i}`,
						),
					);
					skipped++;
					continue;
				}

				if (typeof item === "string" && item.startsWith("ERROR_")) {
					throw new Error(`Simulated error for item: ${item}`);
				}

				// Simulate processing time
				await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

				const processedItem = await this.processItem(item);
				processed.push(processedItem);

				itemTimer.capture();

				// Log slow items
				const lastDuration =
					itemTimer.measurements[itemTimer.measurements.length - 1];
				if (lastDuration > 8) {
					events.push(
						warning(`Slow item processing detected`, {
							item: item,
							duration: lastDuration,
							batchNumber,
							itemIndex: i,
						}),
					);
				}
			} catch (itemError) {
				events.push(
					error(
						`Failed to process item at batch ${batchNumber}, index ${i}`,
						itemError,
						{
							item: item,
							batchNumber,
							itemIndex: i,
						},
					),
				);
				errors++;
				itemTimer.capture();
			}
		}

		// Add item processing statistics
		if (itemTimer.measurements.length > 0) {
			events.push(
				itemTimer.performanceStats({
					batchNumber,
					itemsProcessed: itemTimer.measurements.length,
				}),
			);
		}

		return { processed, skipped, errors, events };
	}

	/**
	 * Process a single item
	 * @param {any} item - Item to process
	 * @returns {Promise<any>} Processed item
	 */
	async processItem(item: any): Promise<any> {
		// Simulate item processing with retries
		let attempts = 0;

		while (attempts < this.maxRetries) {
			try {
				// Simulate processing logic
				if (typeof item === "number") {
					return item * 2;
				} else if (typeof item === "string") {
					return item.toUpperCase();
				} else if (typeof item === "object") {
					return { ...item, processed: true, timestamp: Date.now() };
				}
				return item;
			} catch (err) {
				attempts++;
				if (attempts >= this.maxRetries) {
					throw new Error(
						`Failed to process item after ${this.maxRetries} attempts: ${err.message}`,
					);
				}
				// Brief delay before retry
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}
	}

	/**
	 * Validate the final results
	 * @param {Array} results - Processed results
	 * @returns {Array} Validated results
	 */
	validateResults(results: any[]): any[] {
		// Simulate validation logic
		const { result: validatedResults } = measure("Result Validation", () => {
			return results.filter((item) => item !== null && item !== undefined);
		});

		return validatedResults;
	}
}

/**
 * Example usage function
 */
export async function runDataProcessorExample(): Promise<any> {
	const processor = new DataProcessorRunnable({
		batchSize: 5,
		maxRetries: 2,
	});

	// Sample data with various scenarios
	const sampleData = [
		1,
		2,
		3,
		"hello",
		"world",
		{ id: 1, name: "Alice" },
		null, // Will be skipped
		"ERROR_SIMULATE", // Will cause an error
		{ id: 2, name: "Bob" },
		4,
		5,
		6,
		"test",
		undefined, // Will be skipped
		{ id: 3, name: "Charlie" },
	];

	console.log("Starting data processor example...\n");

	try {
		const generator = processor.invoke(sampleData);
		let result;
		let done = false;

		while (!done) {
			const { value, done: isDone } = await generator.next();
			done = isDone;

			if (!done) {
				// Log all events to console
				const event = value;
				const timestamp = new Date(event.timestamp).toISOString();

				if (event.type === "log") {
					console.log(
						`[${timestamp}] ${event.level.toUpperCase()}: ${event.message}`,
					);
					if (event.error) {
						console.log(`  Error: ${event.error.message}`);
					}
				} else if (event.type === "performance") {
					console.log(`[${timestamp}] PERF: ${event.message}`);
					if (event.statistics) {
						console.log(
							`  Stats: ${JSON.stringify(event.statistics, null, 2)}`,
						);
					}
				}
			} else {
				result = value;
			}
		}

		console.log("\nFinal Result:", JSON.stringify(result, null, 2));
		return result;
	} catch (err) {
		console.error("Example failed:", err.message);
		throw err;
	}
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runDataProcessorExample().catch(console.error);
}