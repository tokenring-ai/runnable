/**
 * @file core/runnable/events.ts
 * @description Defines base event types that can be yielded by a Runnable's `invoke` generator.
 *              These are intended to be generic and reusable.
 *              Orchestrators or more complex Runnables can define their own more specific event types
 *              that might extend or incorporate these.
 */

/**
 * Base properties for all events yielded by a Runnable.
 */
export type BaseRunnableEvent = {
    /**
     * The specific type of the event (e.g., 'log', 'chunk').
     */
    type: string;
    /**
     * The name of the Runnable instance that yielded this event.
     */
    runnableName?: string;
    /**
     * Unix timestamp (milliseconds) of when the event occurred.
     */
    timestamp: number;
    /**
     * If part of a larger workflow, the ID of that instance. (From context)
     */
    workflowInstanceId?: string;
    /**
     * Trace ID for distributed tracing. (From context)
     */
    traceId?: string;
};

/**
 * A union type representing any of the base events that can be yielded by a Runnable.
 * Concrete Runnables or Orchestrators can define more specific YieldTypes.
 */
export type BaseYieldType = LogEvent | ChunkEvent | ErrorEvent;

// Base class providing timestamp handling and metadata spread
class BaseEvent {
    /** The specific type of the event */
    type: string;
    /** Unix timestamp (milliseconds) of when the event occurred */
    timestamp: number;

    /**
     * @param type The event type
     * @param metadata Additional metadata for the event
     */
    constructor(type: string, metadata: Partial<BaseRunnableEvent> = {}) {
        this.type = type;
        this.timestamp = Date.now();
        Object.assign(this, metadata);
    }
}

/**
 * LogEvent class representing a log message.
 */
export class LogEvent extends BaseEvent {
    /** The severity level of the log */
    level: "debug" | "info" | "warn" | "error";
    /** The log message */
    message: string;

    /**
     * @param level The severity level of the log
     * @param message The log message
     * @param metadata Additional metadata including optional details
     */
    constructor(
        level: "debug" | "info" | "warn" | "error",
        message: string,
        metadata: Partial<BaseRunnableEvent> & {
            details?: any;
        } = {}
    ) {
        super("log", metadata);
        this.level = level;
        this.message = message;
    }
}

/**
 * ChunkEvent for streaming partial output.
 */
export class ChunkEvent extends BaseEvent {
    /** The piece of partial output data */
    data: any;

    /**
     * @param data The piece of partial output data
     * @param metadata Additional metadata for the event
     */
    constructor(data: any, metadata: Partial<BaseRunnableEvent> = {}) {
        super("chunk", metadata);
        this.data = data;
    }
}

/**
 * ErrorEvent represents a handled error yielded from a Runnable.
 */
export class ErrorEvent extends BaseEvent {
    /** Details of the error */
    error: {
        name: string;
        message: string;
        stack?: string;
        details?: any;
    };

    /**
     * @param err The error object, string, or error details
     * @param metadata Additional metadata for the event
     */
    constructor(
        err:
            | Error
            | string
            | {
                  name: string;
                  message: string;
                  stack?: string;
                  details?: any;
              },
        metadata: Partial<BaseRunnableEvent> = {}
    ) {
        super("error_event", metadata);
        let errorObj;
        if (err instanceof Error) {
            errorObj = { name: err.name, message: err.message, stack: err.stack };
        } else if (typeof err === "string") {
            errorObj = { name: "Error", message: err };
        } else {
            errorObj = err;
        }
        this.error = errorObj;
    }
}

// Factory helpers kept for backward compatibility
export function createLogEvent(level: "debug" | "info" | "warn" | "error", message: string, metadata: Partial<BaseRunnableEvent> & { details?: any } = {}) {
    return new LogEvent(level, message, metadata);
}

export function createChunkEvent(data: any, metadata: Partial<BaseRunnableEvent> = {}) {
    return new ChunkEvent(data, metadata);
}

export function createErrorEvent(
    err:
        | Error
        | string
        | {
              name: string;
              message: string;
              stack?: string;
              details?: any;
          },
    metadata: Partial<BaseRunnableEvent> = {}
) {
    return new ErrorEvent(err, metadata);
}