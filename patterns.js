import { Runnable } from './runnable.js';
import { ChunkEvent } from './events.js';

/**
 * Runnable that applies a mapping function to each item of an input array.
 */
export class MapRunnable extends Runnable {
  /**
   * @param {(item: any, context: any) => any | Promise<any>} mapFn
   * @param {RunnableOptions} [options]
   */
  constructor(mapFn, options) {
    super(options);
    this.mapFn = mapFn;
  }

  async *invoke(input, context) {
    if (!Array.isArray(input)) {
      throw new Error('MapRunnable expects input to be an array');
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
   * @param {(item: any, context: any) => boolean | Promise<boolean>} filterFn
   * @param {RunnableOptions} [options]
   */
  constructor(filterFn, options) {
    super(options);
    this.filterFn = filterFn;
  }

  async *invoke(input, context) {
    if (!Array.isArray(input)) {
      throw new Error('FilterRunnable expects input to be an array');
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
   * @param {(input: any, context: any) => boolean | Promise<boolean>} predicate
   * @param {Runnable} trueRunnable
   * @param {Runnable} [falseRunnable]
   * @param {RunnableOptions} [options]
   */
  constructor(predicate, trueRunnable, falseRunnable, options) {
    super(options);
    this.predicate = predicate;
    this.trueRunnable = trueRunnable;
    this.falseRunnable = falseRunnable;
  }

  async *invoke(input, context) {
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
   * @param {Runnable[]} runnables
   * @param {(outputs: any[]) => any} [combineFn]
   * @param {RunnableOptions} [options]
   */
  constructor(runnables, combineFn, options) {
    super(options);
    this.runnables = runnables;
    this.combineFn = combineFn;
  }

  async *invoke(input, context) {
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

    const outputs = results.map(r => r.output);
    return this.combineFn ? this.combineFn(outputs) : outputs;
  }
}

