import {ChunkEvent} from "./events.js";
import {Runnable, RunnableOptions} from "./runnable.js";

/**
 * Runnable that applies a mapping function to each item of an input array.
 */
export class MapRunnable<TItem = any, TOutput = any, C = any> extends Runnable<TItem[], TOutput[], ChunkEvent, C> {
  /**
   */
  constructor(
    public mapFn: (item: TItem, context: C) => TOutput | Promise<TOutput>,
    options?: RunnableOptions
  ) {
    super(options);
  }

  async* invoke(input: TItem[], context: C): AsyncGenerator<ChunkEvent, TOutput[], unknown> {
    if (!Array.isArray(input)) {
      throw new Error("MapRunnable expects input to be an array");
    }
    const results: TOutput[] = [];
    for (const item of input) {
      const mapped = await this.mapFn(item, context);
      results.push(mapped);
      yield new ChunkEvent(mapped, {runnableName: this.name});
    }
    return results;
  }
}

/**
 * Runnable that filters an input array using a predicate function.
 */
export class FilterRunnable<TItem = any, C = any> extends Runnable<TItem[], TItem[], ChunkEvent, C> {
  /**
   */
  constructor(
    public filterFn: (item: TItem, context: C) => boolean | Promise<boolean>,
    options?: RunnableOptions
  ) {
    super(options);
  }

  async* invoke(input: TItem[], context: C): AsyncGenerator<ChunkEvent, TItem[], unknown> {
    if (!Array.isArray(input)) {
      throw new Error("FilterRunnable expects input to be an array");
    }
    const output: TItem[] = [];
    for (const item of input) {
      if (await this.filterFn(item, context)) {
        output.push(item);
        yield new ChunkEvent(item, {runnableName: this.name});
      }
    }
    return output;
  }
}

/**
 * Runnable that chooses between two runnables based on a predicate.
 */
export class ConditionalRunnable<I = any, O = any, Y = any, C = any> extends Runnable<I, O, Y, C> {
  /**
   */
  constructor(
    public predicate: (input: I, context: C) => boolean | Promise<boolean>,
    public trueRunnable: Runnable<I, O, Y, C>,
    public falseRunnable?: Runnable<I, O, Y, C>,
    options?: RunnableOptions
  ) {
    super(options);
  }

  async* invoke(input: I, context: C): AsyncGenerator<Y, O, unknown> {
    const condition = await this.predicate(input, context);
    const runnable = condition ? this.trueRunnable : this.falseRunnable;
    if (!runnable) {
      return input as unknown as O;
    }
    const iterator = runnable.invoke(input, context)[Symbol.asyncIterator]();
    let result = await iterator.next();
    while (!result.done) {
      yield result.value as Y;
      result = await iterator.next();
    }
    return result.value as O;
  }
}

/**
 * Runnable that executes multiple runnables in parallel and combines their outputs.
 */
export class ParallelJoinRunnable<I = any, O = any, Y = any, C = any, R = any> extends Runnable<I, R, Y, C> {
  /**
   */
  constructor(
    public runnables: Runnable<I, O, Y, C>[],
    public combineFn?: (outputs: O[]) => R,
    options?: RunnableOptions
  ) {
    super(options);
  }

  async* invoke(input: I, context: C): AsyncGenerator<Y, R, unknown> {
    const promises = this.runnables.map(async (r) => {
      const events: Y[] = [];
      const iterator = r.invoke(input, context)[Symbol.asyncIterator]();
      let result = await iterator.next();
      while (!result.done) {
        events.push(result.value as Y);
        result = await iterator.next();
      }
      return {events, output: result.value as O};
    });

    const results = await Promise.all(promises);

    for (const {events} of results) {
      for (const event of events) {
        yield event as Y;
      }
    }

    const outputs = results.map((r) => r.output);
    return this.combineFn ? this.combineFn(outputs) : (outputs as unknown as R);
  }
}
