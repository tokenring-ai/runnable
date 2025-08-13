import {Runnable, RunnableOptions} from "./runnable.js";
import {ChunkEvent} from "./events.js";

/**
 * Runnable that applies a mapping function to each item of an input array.
 */
export class MapRunnable extends Runnable {
	/**
	 * @param mapFn Function that maps each input item
	 * @param options Optional runnable options
	 */
	constructor(
		public mapFn: (item: any, context: any) => any | Promise<any>,
		options?: RunnableOptions
	) {
		super(options);
	}

	async *invoke(input: any, context: any): AsyncGenerator<ChunkEvent, any[], unknown> {
		if (!Array.isArray(input)) {
			throw new Error("MapRunnable expects input to be an array");
		}
		const results = [];
		for (const item of input) {
			const mapped = await this.mapFn(item, context);
			results.push(mapped);
			yield new ChunkEvent(mapped, { runnableName: this.name });
		}
		return results;
	}
}

/**
 * Runnable that filters an input array using a predicate function.
 */
export class FilterRunnable extends Runnable {
	/**
	 * @param filterFn Function that determines which items to keep
	 * @param options Optional runnable options
	 */
	constructor(
		public filterFn: (item: any, context: any) => boolean | Promise<boolean>,
		options?: RunnableOptions
	) {
		super(options);
	}

	async *invoke(input: any, context: any): AsyncGenerator<ChunkEvent, any[], unknown> {
		if (!Array.isArray(input)) {
			throw new Error("FilterRunnable expects input to be an array");
		}
		const output = [];
		for (const item of input) {
			if (await this.filterFn(item, context)) {
				output.push(item);
				yield new ChunkEvent(item, { runnableName: this.name });
			}
		}
		return output;
	}
}

/**
 * Runnable that chooses between two runnables based on a predicate.
 */
export class ConditionalRunnable extends Runnable {
	/**
	 * @param predicate Function that determines which branch to take
	 * @param trueRunnable Runnable to use when predicate returns true
	 * @param falseRunnable Optional runnable to use when predicate returns false
	 * @param options Optional runnable options
	 */
	constructor(
		public predicate: (input: any, context: any) => boolean | Promise<boolean>,
		public trueRunnable: Runnable,
		public falseRunnable?: Runnable,
		options?: RunnableOptions
	) {
		super(options);
	}

	async *invoke(input: any, context: any): AsyncGenerator<any, any, unknown> {
		const condition = await this.predicate(input, context);
		const runnable = condition ? this.trueRunnable : this.falseRunnable;
		if (!runnable) {
			return input;
		}
		const iterator = runnable.invoke(input, context)[Symbol.asyncIterator]();
		let result = await iterator.next();
		while (!result.done) {
			yield result.value;
			result = await iterator.next();
		}
		return result.value;
	}
}

/**
 * Runnable that executes multiple runnables in parallel and combines their outputs.
 */
export class ParallelJoinRunnable extends Runnable {
	/**
	 * @param runnables Array of runnables to execute in parallel
	 * @param combineFn Optional function to combine the outputs
	 * @param options Optional runnable options
	 */
	constructor(
		public runnables: Runnable[],
		public combineFn?: (outputs: any[]) => any,
		options?: RunnableOptions
	) {
		super(options);
	}

	async *invoke(input: any, context: any): AsyncGenerator<any, any, unknown> {
		const promises = this.runnables.map(async (r) => {
			const events = [];
			const iterator = r.invoke(input, context)[Symbol.asyncIterator]();
			let result = await iterator.next();
			while (!result.done) {
				events.push(result.value);
				result = await iterator.next();
			}
			return { events, output: result.value };
		});

		const results = await Promise.all(promises);

		for (const { events } of results) {
			for (const event of events) {
				yield event;
			}
		}

		const outputs = results.map((r) => r.output);
		return this.combineFn ? this.combineFn(outputs) : outputs;
	}
}