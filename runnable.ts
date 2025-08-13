/**
 * @file core/runnable/runnable.ts
 * @description Defines the core Runnable class/interface.
 */

import { z } from "zod";
import { LogEvent } from "./events.js";

/**
 * Configuration options for a Runnable instance.
 */
export type RunnableOptions = {
    /**
     * An optional name for this runnable instance, used for logging and identification.
     */
    name?: string;
    /**
     * An optional description of what this runnable does.
     */
    description?: string;
    /**
     * An optional Zod schema for validating input data.
     */
    inputSchema?: z.ZodSchema;
    /**
     * An optional Zod schema for validating output data.
     */
    outputSchema?: z.ZodSchema;
    /**
     * Whether to validate input using the input schema.
     */
    validateInput?: boolean;
    /**
     * Whether to validate output using the output schema.
     */
    validateOutput?: boolean;
    /**
     * An optional AbortController to allow external cancellation.
     */
    abortController?: AbortController;
};

/**
 * Represents an operation that can be executed, yielding intermediate events/chunks
 * and ultimately returning a final output. This is the foundational building block for tasks.
 *
 * @template InputType - The type of the input data for the `invoke` method.
 * @template OutputType - The type of the final result returned by the `invoke` generator.
 * @template YieldType - The type of events or data chunks yielded by the `invoke` generator during execution.
 *                       This would typically be a union of event types like those defined in `events.js`.
 * @template ContextType - The type of the optional context object passed to `invoke`.
 */
export class Runnable<InputType = any, OutputType = any, YieldType = any, ContextType = any> {
    /**
     * Optional name for this runnable instance, useful for logging and identification.
     */
    name?: string;

    /**
     * Optional description of what this runnable does.
     */
    description?: string;

    /**
     * Optional Zod schema for validating input data.
     */
    inputSchema?: z.ZodSchema;

    /**
     * Optional Zod schema for validating output data.
     */
    outputSchema?: z.ZodSchema;

    /**
     * Whether to validate the input using the input schema.
     */
    validateInput: boolean;

    /**
     * Whether to validate the output using the output schema.
     */
    validateOutput: boolean;

    /**
     * AbortController for managing cancellation of the runnable's operation.
     * Consumers can listen to `this.abortSignal` and external systems can call `this.abortController.abort()`.
     */
    abortController: AbortController;

    /**
     * Creates an instance of a Runnable.
     * @param options - Configuration options for the Runnable.
     */
    constructor(options: RunnableOptions = {}) {
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
     */
    get abortSignal(): AbortSignal {
        return this.abortController.signal;
    }

    /**
     * Returns a formatted help message showing the runnable's configuration.
     * @returns A pretty-formatted help message with name, description, and schema information.
     */
    help(): string {
        const lines = [];

        // Header
        lines.push("═".repeat(60));
        lines.push(`  ${this.name || "Unnamed Runnable"}`);
        lines.push("═".repeat(60));

        // Description
        if (this.description) {
            lines.push("");
            lines.push("Description:");
            lines.push(`  ${this.description}`);
        }

        // Input Schema
        lines.push("");
        lines.push("Input Schema:");
        if (this.inputSchema) {
            try {
                const schemaDescription = this._formatZodSchema(this.inputSchema);
                lines.push(`  ${schemaDescription}`);
            } catch (error) {
                lines.push(
                    `  ${this.inputSchema.constructor.name} (details unavailable)`,
                );
            }
        } else {
            lines.push("  No input schema defined (accepts any input)");
        }

        // Output Schema
        lines.push("");
        lines.push("Output Schema:");
        if (this.outputSchema) {
            try {
                const schemaDescription = this._formatZodSchema(this.outputSchema);
                lines.push(`  ${schemaDescription}`);
            } catch (error) {
                lines.push(
                    `  ${this.outputSchema.constructor.name} (details unavailable)`,
                );
            }
        } else {
            lines.push("  No output schema defined (returns any output)");
        }

        lines.push("");
        lines.push("═".repeat(60));

        return lines.join("\n");
    }

    /**
     * Helper method to format Zod schema information for display.
     * @private
     * @param schema - The Zod schema to format.
     * @returns A formatted description of the schema.
     */
    private _formatZodSchema(schema: z.ZodSchema): string {
        if (!schema) return "undefined";

        // Handle different Zod schema types
        if (schema instanceof z.ZodString) {
            return "string";
        } else if (schema instanceof z.ZodNumber) {
            return "number";
        } else if (schema instanceof z.ZodBoolean) {
            return "boolean";
        } else if (schema instanceof z.ZodArray) {
            const elementType = this._formatZodSchema(schema.element);
            return `array of ${elementType}`;
        } else if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            const properties = Object.keys(shape).map((key) => {
                const propSchema = shape[key];
                const isOptional = propSchema instanceof z.ZodOptional;
                const actualSchema = isOptional ? propSchema.unwrap() : propSchema;
                const propType = this._formatZodSchema(actualSchema);
                return `${key}${isOptional ? "?" : ""}: ${propType}`;
            });
            return `{\n    ${properties.join(",\n    ")}\n  }`;
        } else if (schema instanceof z.ZodOptional) {
            return `${this._formatZodSchema(schema.unwrap())} (optional)`;
        } else if (schema instanceof z.ZodUnion) {
            const options = schema.options.map((opt) => this._formatZodSchema(opt));
            return options.join(" | ");
        } else if (schema instanceof z.ZodLiteral) {
            return `"${schema.value}"`;
        } else if (schema instanceof z.ZodEnum) {
            return schema.options.map((opt) => `"${opt}"`).join(" | ");
        } else {
            // Fallback for other schema types
            return schema.constructor.name.replace("Zod", "").toLowerCase();
        }
    }

    /**
     * Executes the runnable's logic. This method MUST be implemented by concrete subclasses.
     * It is an asynchronous generator that yields `YieldType` events/chunks during its
     * execution and finally returns an `OutputType`.
     *
     * @param input - The input data for the runnable.
     * @param context - Optional context providing additional data or services for execution.
     * @returns An async generator.
     *          - `YieldType`: The type of values `yield`ed during execution (e.g., log events, data chunks).
     *          - `OutputType`: The type of the value `return`ed by the generator upon completion.
     *          - `void`: The type of value passed into `next(value)` by the consumer (typically not used, so `void`).
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
    async *invoke(input: InputType, context?: ContextType): AsyncGenerator<YieldType, OutputType, void> {
        // Optionally validate input using Zod
        if (this.validateInput && this.inputSchema) {
            input = this.inputSchema.parse(input) as InputType;
        }

        // This base implementation should be overridden by subclasses.
        // It serves as a placeholder and example of the expected signature and behavior.
        if (this.name) {
            console.warn(
                `Runnable '${this.name}': invoke() method not implemented. Defaulting to no-op pass-through.`,
            );
        } else {
            console.warn(
                `Runnable: invoke() method not implemented. Defaulting to no-op pass-through.`,
            );
        }
        // To make it a valid async generator, it must yield or return.
        // We can yield a log message indicating it's the base implementation.
        const logEvent = new LogEvent(
            "warn",
            `Base invoke for ${this.name || "Unnamed Runnable"}. Input will be returned as output.`,
            { runnableName: this.name },
        ) as unknown as YieldType;
        yield logEvent;

        let output = input as unknown as OutputType; // Pass through input as output

        if (this.validateOutput && this.outputSchema) {
            output = this.outputSchema.parse(output) as OutputType;
        }

        return output;
    }

    /**
     * Convenience helper that executes {@link invoke} and returns only the final
     * result. Any yielded events are consumed and discarded.
     *
     * @param input - The input data for the runnable.
     * @param context - Optional context providing additional data or services for execution.
     * @returns The final output value
     */
    async run(input: InputType, context?: ContextType): Promise<OutputType> {
        const iterator = this.invoke(input, context)[Symbol.asyncIterator]();
        let result = await iterator.next();
        while (!result.done) {
            result = await iterator.next();
        }
        return result.value;
    }
}