/**
 * @file core/runnable/runnable.js
 * @description Defines the core Runnable class/interface.
 */

import { z } from 'zod';
import { LogEvent } from './events.js';

/**
 * @typedef {Object} RunnableOptions
 * @property {string} [name] - An optional name for this runnable instance, used for logging and identification.
 * @property {string} [description] - An optional description of what this runnable does.
 * @property {z.ZodSchema} [inputSchema] - An optional Zod schema for validating input data.
 * @property {z.ZodSchema} [outputSchema] - An optional Zod schema for validating output data.
 * @property {boolean} [validateInput=true] - Whether to validate input using the input schema.
 * @property {boolean} [validateOutput=true] - Whether to validate output using the output schema.
 * @property {AbortController} [abortController] - An optional AbortController to allow external cancellation.
 */

/**
 * Represents an operation that can be executed, yielding intermediate events/chunks
 * and ultimately returning a final output. This is the foundational building block for tasks.
 *
 * @template InputType - The type of the input data for the `invoke` method.
 * @template OutputType - The type of the final result returned by the `invoke` generator.
 * @template YieldType - The type of events or data chunks yielded by the `invoke` generator during execution.
 *                       This would typically be a union of event types like those defined in `events.js`.
 * @template ContextType - The type of the optional context object passed to `invoke`.
 * @interface
 */
export class Runnable {
  /**
   * Optional name for this runnable instance, useful for logging and identification.
   * @type {string | undefined}
   */
  name;

  /**
   * Optional description of what this runnable does.
   * @type {string | undefined}
   */
  description;

  /**
   * Optional Zod schema for validating input data.
   * @type {z.ZodSchema | undefined}
   */
  inputSchema;

  /**
   * Optional Zod schema for validating output data.
   * @type {z.ZodSchema | undefined}
   */
  outputSchema;

  /**
   * Whether to validate the input using the input schema.
   * @type {boolean}
   */
  validateInput;

  /**
   * Whether to validate the output using the output schema.
   * @type {boolean}
   */
  validateOutput;

  /**
   * AbortController for managing cancellation of the runnable's operation.
   * Consumers can listen to `this.abortSignal` and external systems can call `this.abortController.abort()`.
   * @type {AbortController}
   */
  abortController;

  /**
   * Creates an instance of a Runnable.
   * @param {RunnableOptions} [options={}] - Configuration options for the Runnable.
   */
  constructor(options = {}) {
    this.name = options.name;
    this.description = options.description;
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.validateInput = options.validateInput !== false;
    this.validateOutput = options.validateOutput !== false;
    this.abortController = options.abortController || new AbortController();
  }

  /**
   * Gets the AbortSignal associated with this Runnable's AbortController.
   * Implementations of `invoke` should listen to this signal to handle cancellation requests.
   * @returns {AbortSignal}
   */
  get abortSignal() {
    return this.abortController.signal;
  }

  /**
   * Returns a formatted help message showing the runnable's configuration.
   * @returns {string} A pretty-formatted help message with name, description, and schema information.
   */
  help() {
    const lines = [];
    
    // Header
    lines.push('═'.repeat(60));
    lines.push(`  ${this.name || 'Unnamed Runnable'}`);
    lines.push('═'.repeat(60));
    
    // Description
    if (this.description) {
      lines.push('');
      lines.push('Description:');
      lines.push(`  ${this.description}`);
    }
    
    // Input Schema
    lines.push('');
    lines.push('Input Schema:');
    if (this.inputSchema) {
      try {
        const schemaDescription = this._formatZodSchema(this.inputSchema);
        lines.push(`  ${schemaDescription}`);
      } catch (error) {
        lines.push(`  ${this.inputSchema.constructor.name} (details unavailable)`);
      }
    } else {
      lines.push('  No input schema defined (accepts any input)');
    }
    
    // Output Schema
    lines.push('');
    lines.push('Output Schema:');
    if (this.outputSchema) {
      try {
        const schemaDescription = this._formatZodSchema(this.outputSchema);
        lines.push(`  ${schemaDescription}`);
      } catch (error) {
        lines.push(`  ${this.outputSchema.constructor.name} (details unavailable)`);
      }
    } else {
      lines.push('  No output schema defined (returns any output)');
    }
    
    lines.push('');
    lines.push('═'.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Helper method to format Zod schema information for display.
   * @private
   * @param {z.ZodSchema} schema - The Zod schema to format.
   * @returns {string} A formatted description of the schema.
   */
  _formatZodSchema(schema) {
    if (!schema) return 'undefined';
    
    // Handle different Zod schema types
    if (schema instanceof z.ZodString) {
      return 'string';
    } else if (schema instanceof z.ZodNumber) {
      return 'number';
    } else if (schema instanceof z.ZodBoolean) {
      return 'boolean';
    } else if (schema instanceof z.ZodArray) {
      const elementType = this._formatZodSchema(schema.element);
      return `array of ${elementType}`;
    } else if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties = Object.keys(shape).map(key => {
        const propSchema = shape[key];
        const isOptional = propSchema instanceof z.ZodOptional;
        const actualSchema = isOptional ? propSchema.unwrap() : propSchema;
        const propType = this._formatZodSchema(actualSchema);
        return `${key}${isOptional ? '?' : ''}: ${propType}`;
      });
      return `{\n    ${properties.join(',\n    ')}\n  }`;
    } else if (schema instanceof z.ZodOptional) {
      return `${this._formatZodSchema(schema.unwrap())} (optional)`;
    } else if (schema instanceof z.ZodUnion) {
      const options = schema.options.map(opt => this._formatZodSchema(opt));
      return options.join(' | ');
    } else if (schema instanceof z.ZodLiteral) {
      return `"${schema.value}"`;
    } else if (schema instanceof z.ZodEnum) {
      return schema.options.map(opt => `"${opt}"`).join(' | ');
    } else {
      // Fallback for other schema types
      return schema.constructor.name.replace('Zod', '').toLowerCase();
    }
  }

  /**
   * Executes the runnable's logic. This method MUST be implemented by concrete subclasses.
   * It is an asynchronous generator that yields `YieldType` events/chunks during its
   * execution and finally returns an `OutputType`.
   *
   * @param {InputType} input - The input data for the runnable.
   * @param {ContextType} [context] - Optional context providing additional data or services for execution.
   * @returns {AsyncGenerator<YieldType, OutputType, void>}
   *          An async generator.
   *          - `YieldType`: The type of values `yield`ed during execution (e.g., log events, data chunks).
   *          - `OutputType`: The type of the value `return`ed by the generator upon completion.
   *          - `void`: The type of value passed into `next(value)` by the consumer (typically not used, so `void`).
   * @abstract
   * @example
   * // class MyRunnable extends Runnable<string, string, import('./events.js').LogEvent, any> {
   * //   constructor(name = 'MyTask') {
   * //     super({ name });
   * //   }
   * //   async *invoke(input, context) {
   * //     yield { type: 'log', level: 'info', message: `Starting ${this.name} with: ${input}`, timestamp: Date.now(), runnableName: this.name };
   * //     if (this.abortSignal.aborted) {
   * //       yield { type: 'log', level: 'warn', message: 'Aborted before processing', timestamp: Date.now(), runnableName: this.name };
   * //       throw new Error('Aborted');
   * //     }
   * //     await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
   * //     const result = `Processed: ${input.toUpperCase()}`;
   * //     // No explicit 'final_output' event needed here, the return value is the output.
   * //     return result;
   * //   }
   * // }
   */
  async *invoke(input, context) {
    // Optionally validate input using Zod
    if (this.validateInput && this.inputSchema) {
      input = this.inputSchema.parse(input);
    }

    // This base implementation should be overridden by subclasses.
    // It serves as a placeholder and example of the expected signature and behavior.
    if (this.name) {
        console.warn(`Runnable '${this.name}': invoke() method not implemented. Defaulting to no-op pass-through.`);
    } else {
        console.warn(`Runnable: invoke() method not implemented. Defaulting to no-op pass-through.`);
    }
    // To make it a valid async generator, it must yield or return.
    // We can yield a log message indicating it's the base implementation.
    /** @type {YieldType} */
    const logEvent = /** @type {any} */ (
      new LogEvent(
        'warn',
        `Base invoke for ${this.name || 'Unnamed Runnable'}. Input will be returned as output.`,
        { runnableName: this.name }
      )
    );
    yield logEvent;

    /** @type {OutputType} */
    let output = /** @type {any} */ (input); // Pass through input as output

    if (this.validateOutput && this.outputSchema) {
      output = this.outputSchema.parse(output);
    }

    return output;
  }

  /**
   * Convenience helper that executes {@link invoke} and returns only the final
   * result. Any yielded events are consumed and discarded.
   *
   * @param {InputType} input
   * @param {ContextType} [context]
   * @returns {Promise<OutputType>} The final output value
   */
  async run(input, context) {
    const iterator = this.invoke(input, context)[Symbol.asyncIterator]();
    let result = await iterator.next();
    while (!result.done) {
      result = await iterator.next();
    }
    return result.value;
  }
}
