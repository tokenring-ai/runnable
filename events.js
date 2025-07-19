/**
 * @file core/runnable/events.js
 * @description Defines base event types that can be yielded by a Runnable's `invoke` generator.
 *              These are intended to be generic and reusable.
 *              Orchestrators or more complex Runnables can define their own more specific event types
 *              that might extend or incorporate these.
 */

/**
 * Base properties for all events yielded by a Runnable.
 * @typedef {Object} BaseRunnableEvent
 * @property {string} type - The specific type of the event (e.g., 'log', 'chunk').
 * @property {string} [runnableName] - The name of the Runnable instance that yielded this event.
 * @property {number} timestamp - Unix timestamp (milliseconds) of when the event occurred.
 * @property {string} [workflowInstanceId] - If part of a larger workflow, the ID of that instance. (From context)
 * @property {string} [traceId] - Trace ID for distributed tracing. (From context)
 */

/**
 * Event for logging messages from within a Runnable.
 * @typedef {BaseRunnableEvent & {
 *   type: 'log',
 *   level: 'debug' | 'info' | 'warn' | 'error',
 *   message: string,
 *   details?: any
 * }} LogEvent
 * @property {'debug' | 'info' | 'warn' | 'error'} level - The severity level of the log.
 * @property {string} message - The log message.
 * @property {any} [details] - Optional structured data associated with the log.
 */

/**
 * Event for yielding a chunk of data, typically when an operation produces output incrementally.
 * @typedef {BaseRunnableEvent & {
 *   type: 'chunk',
 *   data: any
 * }} ChunkEvent
 * @property {any} data - The piece of partial output data.
 */

/**
 * Event for signaling an error that was caught and handled (e.g., logged) within a Runnable's
 * `invoke` method before the generator terminates or re-throws the error.
 * If an error terminates the generator, the consumer of the generator will catch it directly.
 * This event is for errors that are explicitly yielded as part of the event stream.
 * @typedef {BaseRunnableEvent & {
 *   type: 'error_event',
 *   error: { name: string, message: string, stack?: string, details?: any }
 * }} ErrorEvent
 * @property {{ name: string, message: string, stack?: string, details?: any }} error - Details of the error.
 */

/**
 * A union type representing any of the base events that can be yielded by a Runnable.
 * Concrete Runnables or Orchestrators can define more specific YieldTypes.
 * @typedef { LogEvent | ChunkEvent | ErrorEvent } BaseYieldType
 */

// Base class providing timestamp handling and metadata spread
class BaseEvent {
  /**
   * @param {string} type
   * @param {Partial<BaseRunnableEvent>} [metadata]
   */
  constructor(type, metadata = {}) {
    /** @type {string} */
    this.type = type;
    /** @type {number} */
    this.timestamp = Date.now();
    Object.assign(this, metadata);
  }
}

/**
 * LogEvent class representing a log message.
 */
export class LogEvent extends BaseEvent {
  /**
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {Partial<BaseRunnableEvent> & {details?: any}} [metadata]
   */
  constructor(level, message, metadata = {}) {
    super('log', metadata);
    this.level = level;
    this.message = message;
  }
}

/**
 * ChunkEvent for streaming partial output.
 */
export class ChunkEvent extends BaseEvent {
  /**
   * @param {any} data
   * @param {Partial<BaseRunnableEvent>} [metadata]
   */
  constructor(data, metadata = {}) {
    super('chunk', metadata);
    this.data = data;
  }
}

/**
 * ErrorEvent represents a handled error yielded from a Runnable.
 */
export class ErrorEvent extends BaseEvent {
  /**
   * @param {Error|string|{name:string,message:string,stack?:string,details?:any}} err
   * @param {Partial<BaseRunnableEvent>} [metadata]
   */
  constructor(err, metadata = {}) {
    super('error_event', metadata);
    let errorObj;
    if (err instanceof Error) {
      errorObj = { name: err.name, message: err.message, stack: err.stack };
    } else if (typeof err === 'string') {
      errorObj = { name: 'Error', message: err };
    } else {
      errorObj = err;
    }
    this.error = errorObj;
  }
}

// Factory helpers kept for backward compatibility
export function createLogEvent(level, message, metadata = {}) {
  return new LogEvent(level, message, metadata);
}

export function createChunkEvent(data, metadata = {}) {
  return new ChunkEvent(data, metadata);
}

export function createErrorEvent(err, metadata = {}) {
  return new ErrorEvent(err, metadata);
}

