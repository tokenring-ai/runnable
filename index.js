/**
 * @file core/runnable/index.js
 * @description Entry point for the @token-ring/runnable package.
 * Exports the core Runnable class and related types.
 */

export { Runnable } from './runnable.js';
export { RunnableGraph } from './graph.js';
export { validateZodTypeCompatibility, validateSchemaExists } from './schema-validator.js';
export { z } from 'zod';
export {
  info,
  warning,
  error,
  fatal,
  performance,
  createPerformanceTimer,
  PerformanceTimer,
  measureAsync,
  measure
} from './helpers.js';
export {
  LogEvent,
  ChunkEvent,
  ErrorEvent,
  createLogEvent,
  createChunkEvent,
  createErrorEvent
} from './events.js';
export {RunnableGraphBuilder} from "./graphBuilder.js";
export { GraphOrchestrator, GraphOrchestratorBuilder } from './orchestrator.js';
export {
  MapRunnable,
  FilterRunnable,
  ConditionalRunnable,
  ParallelJoinRunnable
} from './patterns.js';

// Re-exporting typedefs from events.js for easier access by consumers of the package.
// Since events.js uses `export {}` and relies on JSDoc for types, consumers
// would typically import them directly from events.js if they need the types.
// However, for a more complete package index, we can list them here as well for documentation purposes.
// Actual type re-export for JSDoc typedefs isn't standard via `export * from './events.js';`
// if events.js only contains typedefs and `export {}`.
// Consumers should import types like `import('../core/runnable/events.js').LogEvent`.

/**
 * @typedef {import('./runnable.js').RunnableOptions} RunnableOptions
 */

/**
 * @typedef {import('./graph.js').GraphNode} GraphNode
 * @typedef {import('./graph.js').GraphEdge} GraphEdge
 * @typedef {import('./graph.js').GraphExecutionContext} GraphExecutionContext
 * @typedef {import('./graph.js').RunnableGraphOptions} RunnableGraphOptions
 */

/**
 * @typedef {import('./events.js').BaseRunnableEvent} BaseRunnableEvent
 * @typedef {import('./events.js').LogEvent} LogEvent
 * @typedef {import('./events.js').ChunkEvent} ChunkEvent
 * @typedef {import('./events.js').ErrorEvent} ErrorEvent
 * @typedef {import('./events.js').BaseYieldType} BaseYieldType
 */

// If events.js were to export actual values (e.g., an enum of event types),
// then `export * from './events.js';` would be appropriate.
// For now, this index.js mainly serves to export the Runnable class and document available types.
