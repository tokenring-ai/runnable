# @token-ring/runnable

This package provides the core `Runnable` interface and `RunnableGraph` orchestration system, fundamental building blocks for creating executable and streamable operations within the Token Ring ecosystem.

## Overview

A `Runnable` represents a unit of work that:
- Takes an `input` and an optional `context`.
- Executes asynchronously.
- Yields a stream of `YieldType` events or data chunks during its execution.
- Returns a final `OutputType` upon completion.
- Can be named for identification and logging.
- Can be associated with an `AbortController` for cancellation.

The primary contract is the `async *invoke(input, context)` method, which must be implemented by concrete runnable classes.
For simpler cases, you can call `run(input, context)` to automatically consume
the events and return the final result.

## Key Concepts

### Core Runnable
- **`Runnable` Class:** An interface (or base class with an abstract `invoke`) defining the structure for all runnable operations. It uses JSDoc templates for `InputType`, `OutputType`, `YieldType`, and `ContextType`.
- **`invoke` Method:** An `async function*` (async generator) that performs the runnable's logic, yielding intermediate events/data and returning a final result.
- **Events (`YieldType`):** Objects yielded by `invoke` during execution (e.g., log messages, data chunks). Base event types like `LogEvent`, `ChunkEvent` will be defined.
- **Output (`OutputType`):** The final result returned by the `invoke` generator's `return` statement.

### Graph Orchestration
- **`RunnableGraph` Class:** Orchestrates multiple interconnected runnables in complex topologies with support for parallel execution, multi-input/output nodes, and comprehensive error handling.
- **Schema Validation:** Zod-based type checking that validates data compatibility between connected nodes during graph construction, catching type mismatches early.
- **Builder Pattern:** Fluent API for constructing graphs with intuitive method chaining.
- **Event Propagation:** Full event streaming from all nodes with enhanced context information.

## Purpose

The `@token-ring/runnable` package aims to provide a simple, decoupled, and highly reusable primitive for defining tasks. More complex workflow orchestration (sequences, parallels, retries, etc.) will be built on top of this basic `Runnable` interface, typically in a separate orchestration package (e.g., `@token-ring/workflow`).

This decoupling allows:
- `Runnable`s to be focused solely on their specific task logic.
- Orchestration logic to be generic and reusable across different types of `Runnable`s.
- Easier testing of individual `Runnable` units.

## Quick Start

### Basic Runnable Usage

```javascript
import { Runnable } from '@token-ring/runnable';
import { z } from 'zod';

class DataProcessor extends Runnable {
    constructor() {
        super({
            name: 'DataProcessor',
            inputSchema: z.object({ data: z.string() }),
            outputSchema: z.object({ processed: z.string(), timestamp: z.number() })
        });
    }
    
    async *invoke(input, context) {
        yield { type: 'log', level: 'info', message: 'Processing data', timestamp: Date.now() };
        
        const result = {
            processed: input.data.toUpperCase(),
            timestamp: Date.now()
        };
        
        return result;
    }
}

// Use the runnable
const processor = new DataProcessor();
const generator = processor.invoke({ data: 'hello world' });

for await (const event of generator) {
    console.log('Event:', event);
}

const result = await generator.next();
console.log('Result:', result.value);

// Using the convenience method
const quick = await processor.run({ data: 'hello world' });
console.log('Quick result:', quick);
```

### Graph Orchestration Usage

```javascript
import { RunnableGraph, Runnable } from '@token-ring/runnable';
import { z } from 'zod';

// Create runnables with schemas for validation
class Validator extends Runnable {
    constructor() {
        super({
            name: 'Validator',
            inputSchema: z.object({ email: z.string() }),
            outputSchema: z.object({ email: z.string(), valid: z.boolean() })
        });
    }
    
    async *invoke(input) {
        const valid = input.email.includes('@');
        return { email: input.email, valid };
    }
}

class Transformer extends Runnable {
    constructor() {
        super({
            name: 'Transformer',
            inputSchema: z.object({ email: z.string(), valid: z.boolean() }),
            outputSchema: z.object({ email: z.string(), processed: z.boolean() })
        });
    }
    
    async *invoke(input) {
        if (!input.valid) throw new Error('Invalid email');
        return { email: input.email.toLowerCase(), processed: true };
    }
}

// Build and execute graph with schema validation
const pipeline = RunnableGraph.builder({ name: 'EmailPipeline' })
    .node('validator', new Validator())
    .node('transformer', new Transformer())
    .connect('validator', 'transformer') // Schema validation happens here
    .entry('validator')
    .exit('transformer')
    .build();

// Execute the pipeline
const result = await pipeline.invoke({ email: 'USER@EXAMPLE.COM' });
console.log('Pipeline result:', result);
```

Graphs can persist their progress across runs. Pass a `persistence` object to
`invoke` or `run` and reuse it on subsequent invocations to resume from the last
successful node:

```javascript
const state = {};
try {
  // First attempt may fail partway through
  await pipeline.run({ email: 'USER@EXAMPLE.COM' }, { persistence: state });
} catch (err) {
  console.error('Pipeline failed, will resume later');
}

// Resume later using the same state object
const final = await pipeline.run({ email: 'USER@EXAMPLE.COM' }, { persistence: state });
console.log('Final result:', final);
```

### Built-in Pattern Runnables

Reusable helper runnables simplify common graph tasks:

- **`MapRunnable`** – applies a mapping function to every element of an input array.
- **`FilterRunnable`** – keeps items from an array that match a predicate.
- **`ConditionalRunnable`** – chooses between two runnables based on a predicate.
- **`ParallelJoinRunnable`** – executes multiple runnables in parallel and returns their combined outputs.


## Documentation

- **[GRAPH.md](./GRAPH.md)** - Comprehensive guide to RunnableGraph orchestration, including schema validation, multi-input/output nodes, parallel execution, and best practices
- **[API Reference](./GRAPH.md#api-reference)** - Complete API documentation for all classes and methods

## Examples

The `examples/` directory contains working examples:

- **`graph-examples.js`** - Basic graph orchestration patterns
- **`graph-schema-validation.js`** - Schema validation examples and error handling
- **`schema-example.js`** - Individual runnable schema usage

Run examples:
```bash
cd core/runnable
node examples/graph-examples.js
node examples/graph-schema-validation.js
```

## Key Features

### Schema Validation
- **Build-time validation**: Schema errors are caught during graph construction, not execution
- **Zod integration**: Full support for Zod schemas with detailed error messages
- **Type safety**: Comprehensive type checking for inputs, outputs, and connections
- **Flexible warnings**: Distinguishes between hard errors and soft warnings

### Graph Orchestration
- **Complex topologies**: Support for linear, fan-out/fan-in, and arbitrary graph structures
- **Parallel execution**: Independent nodes execute concurrently with configurable limits
- **Multi-input/output**: Nodes can have multiple named inputs and outputs
- **Error handling**: Robust error propagation with optional node support
- **Event streaming**: Full event propagation from all nodes with enhanced context
- **Persistence/resume**: Save graph state and continue unfinished executions

### GraphOrchestrator
The `GraphOrchestrator` class extends `Runnable` and wraps a `RunnableGraph`.
After each run it can modify the graph based on persisted results and re-run it
without repeating completed nodes. Subclass the orchestrator and override
`updateGraph({ graph, persistence })` to add or connect nodes dynamically.

## Base Event Types

The package exposes event classes for creating common events. These add a
timestamp automatically and let you supply optional metadata like the runnable
name or tracing information. Factory helpers remain for backward compatibility.

- `new LogEvent(level, message, metadata)`: produces a `LogEvent`.
- `new ChunkEvent(data, metadata)`: produces a `ChunkEvent`.
- `new ErrorEvent(error, metadata)`: produces an `ErrorEvent`.

```javascript
import { LogEvent, ChunkEvent } from '@token-ring/runnable';

yield new LogEvent('info', 'starting', { runnableName: this.name });
yield new ChunkEvent(partialData, { runnableName: this.name });
```
