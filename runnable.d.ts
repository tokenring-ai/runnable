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
export class Runnable<InputType, OutputType, YieldType, ContextType> {
	/**
	 * Creates an instance of a Runnable.
	 * @param {RunnableOptions} [options={}] - Configuration options for the Runnable.
	 */
	constructor(options?: RunnableOptions);
	/**
	 * Optional name for this runnable instance, useful for logging and identification.
	 * @type {string | undefined}
	 */
	name: string | undefined;
	/**
	 * Optional description of what this runnable does.
	 * @type {string | undefined}
	 */
	description: string | undefined;
	/**
	 * Optional Zod schema for validating input data.
	 * @type {z.ZodSchema | undefined}
	 */
	inputSchema: z.ZodSchema | undefined;
	/**
	 * Optional Zod schema for validating output data.
	 * @type {z.ZodSchema | undefined}
	 */
	outputSchema: z.ZodSchema | undefined;
	/**
	 * Whether to validate the input using the input schema.
	 * @type {boolean}
	 */
	validateInput: boolean;
	/**
	 * Whether to validate the output using the output schema.
	 * @type {boolean}
	 */
	validateOutput: boolean;
	/**
	 * AbortController for managing cancellation of the runnable's operation.
	 * Consumers can listen to `this.abortSignal` and external systems can call `this.abortController.abort()`.
	 * @type {AbortController}
	 */
	abortController: AbortController;
	/**
	 * Gets the AbortSignal associated with this Runnable's AbortController.
	 * Implementations of `invoke` should listen to this signal to handle cancellation requests.
	 * @returns {AbortSignal}
	 */
	get abortSignal(): AbortSignal;
	/**
	 * Returns a formatted help message showing the runnable's configuration.
	 * @returns {string} A pretty-formatted help message with name, description, and schema information.
	 */
	help(): string;
	/**
	 * Helper method to format Zod schema information for display.
	 * @private
	 * @param {z.ZodSchema} schema - The Zod schema to format.
	 * @returns {string} A formatted description of the schema.
	 */
	private _formatZodSchema;
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
	invoke(
		input: InputType,
		context?: ContextType,
	): AsyncGenerator<YieldType, OutputType, void>;
	/**
	 * Convenience helper that executes {@link invoke} and returns only the final
	 * result. Any yielded events are consumed and discarded.
	 *
	 * @param {InputType} input
	 * @param {ContextType} [context]
	 * @returns {Promise<OutputType>} The final output value
	 */
	run(input: InputType, context?: ContextType): Promise<OutputType>;
}
export type RunnableOptions = {
	/**
	 * - An optional name for this runnable instance, used for logging and identification.
	 */
	name?: string;
	/**
	 * - An optional description of what this runnable does.
	 */
	description?: string;
	/**
	 * - An optional Zod schema for validating input data.
	 */
	inputSchema?: z.ZodSchema;
	/**
	 * - An optional Zod schema for validating output data.
	 */
	outputSchema?: z.ZodSchema;
	/**
	 * - Whether to validate input using the input schema.
	 */
	validateInput?: boolean;
	/**
	 * - Whether to validate output using the output schema.
	 */
	validateOutput?: boolean;
	/**
	 * - An optional AbortController to allow external cancellation.
	 */
	abortController?: AbortController;
};
import { z } from "zod";
