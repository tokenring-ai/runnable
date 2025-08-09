/**
 * Runnable that applies a mapping function to each item of an input array.
 */
export class MapRunnable extends Runnable<any, any, any, any> {
	/**
	 * @param {(item: any, context: any) => any | Promise<any>} mapFn
	 * @param {RunnableOptions} [options]
	 */
	constructor(
		mapFn: (item: any, context: any) => any | Promise<any>,
		options?: RunnableOptions,
	);
	mapFn: (item: any, context: any) => any | Promise<any>;
	invoke(input: any, context: any): AsyncGenerator<ChunkEvent, any[], unknown>;
}
/**
 * Runnable that filters an input array using a predicate function.
 */
export class FilterRunnable extends Runnable<any, any, any, any> {
	/**
	 * @param {(item: any, context: any) => boolean | Promise<boolean>} filterFn
	 * @param {RunnableOptions} [options]
	 */
	constructor(
		filterFn: (item: any, context: any) => boolean | Promise<boolean>,
		options?: RunnableOptions,
	);
	filterFn: (item: any, context: any) => boolean | Promise<boolean>;
	invoke(input: any, context: any): AsyncGenerator<ChunkEvent, any[], unknown>;
}
/**
 * Runnable that chooses between two runnables based on a predicate.
 */
export class ConditionalRunnable extends Runnable<any, any, any, any> {
	/**
	 * @param {(input: any, context: any) => boolean | Promise<boolean>} predicate
	 * @param {Runnable} trueRunnable
	 * @param {Runnable} [falseRunnable]
	 * @param {RunnableOptions} [options]
	 */
	constructor(
		predicate: (input: any, context: any) => boolean | Promise<boolean>,
		trueRunnable: Runnable<any, any, any, any>,
		falseRunnable?: Runnable<any, any, any, any>,
		options?: RunnableOptions,
	);
	predicate: (input: any, context: any) => boolean | Promise<boolean>;
	trueRunnable: Runnable<any, any, any, any>;
	falseRunnable: Runnable<any, any, any, any>;
	invoke(input: any, context: any): AsyncGenerator<any, any, unknown>;
}
/**
 * Runnable that executes multiple runnables in parallel and combines their outputs.
 */
export class ParallelJoinRunnable extends Runnable<any, any, any, any> {
	/**
	 * @param {Runnable[]} runnables
	 * @param {(outputs: any[]) => any} [combineFn]
	 * @param {RunnableOptions} [options]
	 */
	constructor(
		runnables: Runnable<any, any, any, any>[],
		combineFn?: (outputs: any[]) => any,
		options?: RunnableOptions,
	);
	runnables: Runnable<any, any, any, any>[];
	combineFn: (outputs: any[]) => any;
	invoke(input: any, context: any): AsyncGenerator<any, any, unknown>;
}
import { Runnable } from "./runnable.js";
import { ChunkEvent } from "./events.js";
