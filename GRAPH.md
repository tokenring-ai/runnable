# RunnableGraph - Graph-Based Runnable Orchestration

The `RunnableGraph` class extends the core `Runnable` interface to support complex orchestration of multiple interconnected runnables. It enables the creation of sophisticated data processing pipelines with support for parallel execution, conditional flows, and error handling.

## Key Features

- **Graph-based orchestration**: Connect runnables in complex topologies
- **Multi-input/output support**: Handle runnables with multiple inputs and outputs
- **Schema validation**: Comprehensive Zod-based type checking during graph construction
- **Parallel execution**: Execute independent nodes concurrently
- **Error handling**: Robust error propagation with optional node support
- **Event streaming**: Full event propagation from all nodes
- **Abort support**: Proper cancellation throughout the graph
- **Type safety**: Comprehensive TypeScript/JSDoc type definitions
- **Fluent API**: Intuitive builder pattern for graph construction

## Basic Usage

### Simple Linear Pipeline

```javascript
import { RunnableGraph, Runnable } from '@token-ring/runnable';

// Create individual runnables
class ValidatorRunnable extends Runnable {
    async *invoke(input, context) {
        yield { type: 'log', level: 'info', message: 'Validating input', timestamp: Date.now(), runnableName: this.name };
        
        if (!input.email) {
            throw new Error('Email is required');
        }
        
        return { ...input, validated: true };
    }
}

class TransformerRunnable extends Runnable {
    async *invoke(input, context) {
        yield { type: 'log', level: 'info', message: 'Transforming data', timestamp: Date.now(), runnableName: this.name };
        
        return {
            ...input,
            email: input.email.toLowerCase(),
            processedAt: new Date().toISOString()
        };
    }
}

// Build the graph
const pipeline = RunnableGraph.builder({ name: 'UserPipeline' })
    .node('validator', new ValidatorRunnable({ name: 'Validator' }))
    .node('transformer', new TransformerRunnable({ name: 'Transformer' }))
    .connect('validator', 'transformer')
    .entry('validator')
    .exit('transformer')
    .build();

// Execute the pipeline
const input = { name: 'John', email: 'JOHN@EXAMPLE.COM' };
const generator = pipeline.invoke(input);

for await (const event of generator) {
    console.log(event);
}

const result = await generator.next();
console.log('Final result:', result.value);
```

### Fan-out/Fan-in Pattern

```javascript
// Create a graph that splits processing and then combines results
const pipeline = RunnableGraph.builder({ name: 'FanOutFanIn', parallel: true })
    .node('splitter', new SplitterRunnable(), { outputs: ['branch1', 'branch2'] })
    .node('processor1', new ProcessorRunnable({ name: 'Processor1' }))
    .node('processor2', new ProcessorRunnable({ name: 'Processor2' }))
    .node('combiner', new CombinerRunnable(), { inputs: ['input1', 'input2'] })
    .connect('splitter', 'processor1', { fromOutput: 'branch1' })
    .connect('splitter', 'processor2', { fromOutput: 'branch2' })
    .connect('processor1', 'combiner', { toInput: 'input1' })
    .connect('processor2', 'combiner', { toInput: 'input2' })
    .entry('splitter')
    .exit('combiner')
    .build();
```

## Advanced Features

### Multi-Input Nodes

Nodes can accept multiple inputs from different sources:

```javascript
class AggregatorRunnable extends Runnable {
    async *invoke(input, context) {
        // input will be an object with keys matching the configured inputs
        // e.g., { userInfo: {...}, orderInfo: {...}, paymentInfo: {...} }
        
        const aggregated = {
            userId: input.userInfo.id,
            orderId: input.orderInfo.id,
            paymentStatus: input.paymentInfo.status,
            aggregatedAt: new Date().toISOString()
        };
        
        return aggregated;
    }
}

const graph = RunnableGraph.builder()
    .node('userService', new UserServiceRunnable())
    .node('orderService', new OrderServiceRunnable())
    .node('paymentService', new PaymentServiceRunnable())
    .node('aggregator', new AggregatorRunnable(), { 
        inputs: ['userInfo', 'orderInfo', 'paymentInfo'] 
    })
    .connect('userService', 'aggregator', { toInput: 'userInfo' })
    .connect('orderService', 'aggregator', { toInput: 'orderInfo' })
    .connect('paymentService', 'aggregator', { toInput: 'paymentInfo' })
    .entry('userService', 'orderService', 'paymentService')
    .exit('aggregator')
    .build();
```

### Multi-Output Nodes

Nodes can produce multiple outputs for different downstream consumers:

```javascript
class SplitterRunnable extends Runnable {
    async *invoke(input, context) {
        return {
            personalData: { name: input.name, age: input.age },
            contactData: { email: input.email, phone: input.phone },
            metadata: { processedAt: Date.now(), version: '1.0' }
        };
    }
}

const graph = RunnableGraph.builder()
    .node('splitter', new SplitterRunnable(), { 
        outputs: ['personalData', 'contactData', 'metadata'] 
    })
    .node('personalProcessor', new PersonalProcessorRunnable())
    .node('contactProcessor', new ContactProcessorRunnable())
    .node('metadataProcessor', new MetadataProcessorRunnable())
    .connect('splitter', 'personalProcessor', { fromOutput: 'personalData' })
    .connect('splitter', 'contactProcessor', { fromOutput: 'contactData' })
    .connect('splitter', 'metadataProcessor', { fromOutput: 'metadata' })
    .entry('splitter')
    .exit('personalProcessor', 'contactProcessor', 'metadataProcessor')
    .build();
```

### Error Handling and Optional Nodes

```javascript
const pipeline = RunnableGraph.builder({ 
    name: 'RobustPipeline',
    continueOnError: true 
})
    .node('validator', new ValidatorRunnable())
    .node('mainProcessor', new MainProcessorRunnable())
    .node('optionalEnricher', new EnricherRunnable(), { optional: true })
    .node('finalizer', new FinalizerRunnable())
    .connect('validator', 'mainProcessor')
    .connect('mainProcessor', 'optionalEnricher')
    .connect('mainProcessor', 'finalizer')  // Direct connection bypasses optional node
    .connect('optionalEnricher', 'finalizer')
    .entry('validator')
    .exit('finalizer')
    .build();

// The pipeline will continue even if optionalEnricher fails
```

### Parallel Execution Control

```javascript
const pipeline = RunnableGraph.builder({ 
    name: 'ParallelPipeline',
    parallel: true,           // Enable parallel execution
    maxConcurrency: 3,        // Limit concurrent nodes
    continueOnError: false    // Stop on first error
})
    // ... node definitions
    .build();
```

## Schema Validation

RunnableGraph provides comprehensive schema validation using Zod schemas to ensure type safety and data compatibility between connected nodes. **Schema validation occurs during graph construction**, not during execution, allowing you to catch compatibility issues early.

### Validation Timing

Schema validation happens when you:
- **Connect nodes** (`graph.connect()`) - Validates output→input compatibility
- **Set entry nodes** (`graph.setEntryNodes()`) - Validates all connections
- **Set exit nodes** (`graph.setExitNodes()`) - Validates all connections

```javascript
import { z } from 'zod';
import { Runnable, RunnableGraph } from '@token-ring/runnable';

// Define runnables with schemas
class DataProcessor extends Runnable {
    constructor() {
        super({
            name: 'DataProcessor',
            inputSchema: z.object({
                userId: z.string(),
                email: z.string().email()
            }),
            outputSchema: z.object({
                userId: z.string(),
                email: z.string(),
                processed: z.boolean()
            })
        });
    }
    
    async *invoke(input) {
        return {
            ...input,
            processed: true
        };
    }
}

class EmailValidator extends Runnable {
    constructor() {
        super({
            name: 'EmailValidator',
            inputSchema: z.object({
                email: z.string(),
                processed: z.boolean()
            }),
            outputSchema: z.object({
                email: z.string(),
                valid: z.boolean()
            })
        });
    }
    
    async *invoke(input) {
        return {
            email: input.email,
            valid: input.email.includes('@')
        };
    }
}

// Schema validation happens during graph construction
const graph = new RunnableGraph();
graph.addNode('processor', new DataProcessor());
graph.addNode('validator', new EmailValidator());

// This will throw an error immediately if schemas are incompatible
try {
    graph.connect('processor', 'validator'); // ✅ Compatible - both have email field
} catch (error) {
    console.error('Schema validation failed:', error.message);
}
```

### Validation Types

#### Hard Errors (Throw Exceptions)

These schema incompatibilities will **throw errors** during graph construction:

1. **Incompatible basic types**
```javascript
// Output: { result: boolean }, Input: { result: number }
// Error: "Incompatible types: boolean cannot be used as number"
```

2. **Missing required properties**
```javascript
// Output: { name: string }, Input: { name: string, age: number }
// Error: "Required input property 'age' is not provided by output schema"
```

3. **Nullable to non-nullable mismatch**
```javascript
// Output: { result: string | null }, Input: { result: string }
// Error: "Output can be null but input does not accept null values"
```

4. **Nested object incompatibilities**
```javascript
// Output: { user: { age: string } }, Input: { user: { age: number } }
// Error: "Property 'user': Property 'age': Incompatible types: string cannot be used as number"
```

5. **Array element type mismatches**
```javascript
// Output: { items: boolean[] }, Input: { items: number[] }
// Error: "Property 'items': Array element: Incompatible types: boolean cannot be used as number"
```

#### Soft Warnings (Logged Only)

These potential issues will **log warnings** but won't prevent graph construction:

1. **Optional property mismatches**
```javascript
// Output: { name: string, age?: number }, Input: { name: string, age: string }
// Warning: "Property 'age': Optional output type may not match required input type"
```

2. **Multi-output node limitations**
```javascript
// Node with multiple outputs using specific output keys
// Warning: "Cannot validate specific output 'branch1' from multi-output node - using full output schema"
```

3. **Union type compatibility**
```javascript
// Output: { result: string | number }, Input: { result: string }
// Warning: "Union output type has compatible option for input"
```

### Multi-Output Node Handling

When a node has multiple outputs (configured with `{ outputs: ['out1', 'out2'] }`), schema validation has limitations:

```javascript
class SplitterRunnable extends Runnable {
    constructor() {
        super({
            name: 'Splitter',
            inputSchema: z.object({ data: z.string() }),
            outputSchema: z.object({
                branch1: z.string(),
                branch2: z.number()
            })
        });
    }
    
    async *invoke(input) {
        return {
            branch1: input.data,
            branch2: input.data.length
        };
    }
}

const graph = new RunnableGraph();
graph.addNode('splitter', new SplitterRunnable(), { 
    outputs: ['branch1', 'branch2'] 
});
graph.addNode('processor', new StringProcessor());

// This will only generate a warning, not an error
graph.connect('splitter', 'processor', { fromOutput: 'branch1' });
// Warning: "Cannot validate specific output 'branch1' from multi-output node"
```

### Schema-less Nodes

Nodes without schemas will generate warnings but won't block validation:

```javascript
class LegacyRunnable extends Runnable {
    // No inputSchema or outputSchema defined
    async *invoke(input) {
        return { processed: input };
    }
}

const graph = new RunnableGraph();
graph.addNode('legacy', new LegacyRunnable());
// Warning: "Node 'legacy' input has no schema defined - type checking skipped"
// Warning: "Node 'legacy' output has no schema defined - type checking skipped"
```

### Best Practices for Schema Validation

1. **Define schemas for all runnables** to get full validation benefits
2. **Use specific types** rather than `z.any()` for better validation
3. **Handle validation errors** during graph construction, not execution
4. **Test schema compatibility** in your unit tests
5. **Use optional properties** judiciously to maintain type safety

```javascript
// ✅ Good: Specific, well-defined schemas
const inputSchema = z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    age: z.number().min(0).max(150)
});

// ❌ Avoid: Overly permissive schemas
const inputSchema = z.object({
    data: z.any()
});
```

## Configuration Options

### RunnableGraphOptions

```javascript
const options = {
    name: 'MyGraph',              // Graph name for logging
    abortController: controller,   // Custom abort controller
    parallel: true,               // Enable parallel execution (default: true)
    maxConcurrency: 5,           // Max concurrent nodes (default: 10)
    continueOnError: false       // Continue on optional node failures (default: false)
};
```

### Node Configuration

```javascript
graph.addNode('nodeId', runnable, {
    inputs: ['input1', 'input2'],    // Expected input keys
    outputs: ['output1', 'output2'], // Produced output keys
    optional: true                   // Node is optional (won't block execution if it fails)
});
```

### Connection Configuration

```javascript
graph.connect('sourceNode', 'targetNode', {
    fromOutput: 'customOutput',      // Source output key (default: 'output')
    toInput: 'customInput',          // Target input key (default: 'input')
    transform: (data) => transform(data)  // Optional data transformation
});
```

## Event System

The graph enhances all events from child runnables with additional context:

```javascript
// Original event from a node
{
    type: 'log',
    level: 'info',
    message: 'Processing data',
    timestamp: 1234567890,
    runnableName: 'DataProcessor'
}

// Enhanced event from the graph
{
    type: 'log',
    level: 'info',
    message: 'Processing data',
    timestamp: 1234567890,
    runnableName: 'DataProcessor',
    nodeId: 'processor1',        // Added by graph
    graphName: 'MyPipeline'      // Added by graph
}
```

### Graph-specific Events

The graph also emits its own events:

```javascript
// Graph execution start
{
    type: 'log',
    level: 'info',
    message: 'Starting graph execution: MyPipeline',
    timestamp: 1234567890,
    runnableName: 'MyPipeline'
}

// Node execution start
{
    type: 'log',
    level: 'info',
    message: "Starting execution of node 'processor1'",
    timestamp: 1234567890,
    runnableName: 'MyPipeline',
    nodeId: 'processor1'
}

// Graph execution completion
{
    type: 'log',
    level: 'info',
    message: 'Graph execution completed: MyPipeline',
    timestamp: 1234567890,
    runnableName: 'MyPipeline',
    completedNodes: ['node1', 'node2', 'node3'],
    failedNodes: []
}
```

## Best Practices

### 1. Design for Testability

```javascript
// Create testable runnables with clear interfaces
class TestableRunnable extends Runnable {
    constructor(name, dependencies = {}) {
        super({ name });
        this.dependencies = dependencies;
    }
    
    async *invoke(input, context) {
        // Use injected dependencies for external calls
        const result = await this.dependencies.externalService.process(input);
        return result;
    }
}

// In tests, inject mocks
const mockService = { process: vi.fn().mockResolvedValue('mocked') };
const runnable = new TestableRunnable('test', { externalService: mockService });
```

### 2. Handle Errors Gracefully

```javascript
// Use optional nodes for non-critical operations
.node('criticalProcessor', new CriticalRunnable())
.node('optionalEnricher', new EnricherRunnable(), { optional: true })
.node('logger', new LoggerRunnable(), { optional: true })

// Implement proper error handling in runnables
class RobustRunnable extends Runnable {
    async *invoke(input, context) {
        try {
            const result = await this.process(input);
            return result;
        } catch (error) {
            yield {
                type: 'error_event',
                error: { name: error.name, message: error.message },
                timestamp: Date.now(),
                runnableName: this.name
            };
            
            // Return a safe fallback or re-throw based on criticality
            return this.getFallbackResult(input);
        }
    }
}
```

### 3. Optimize for Performance

```javascript
// Use parallel execution for independent operations
const pipeline = RunnableGraph.builder({ 
    parallel: true,
    maxConcurrency: 4  // Tune based on your system
})

// Group related operations to minimize data transfer
.node('dataFetcher', new DataFetcherRunnable())
.node('processor', new ProcessorRunnable())  // Processes fetched data
.connect('dataFetcher', 'processor')

// Rather than:
// .node('userFetcher', new UserFetcherRunnable())
// .node('orderFetcher', new OrderFetcherRunnable())
// .node('userProcessor', new UserProcessorRunnable())
// .node('orderProcessor', new OrderProcessorRunnable())
```

### 4. Monitor and Debug

```javascript
// Add comprehensive logging
const pipeline = RunnableGraph.builder({ name: 'MonitoredPipeline' })
    // ... nodes
    .build();

const generator = pipeline.invoke(input);
const events = [];

for await (const event of generator) {
    events.push(event);
    
    // Log important events
    if (event.type === 'log' && event.level === 'error') {
        console.error(`[${event.nodeId}] ${event.message}`);
    }
    
    // Track performance
    if (event.message?.includes('Starting execution')) {
        console.time(`node-${event.nodeId}`);
    } else if (event.message?.includes('Completed execution')) {
        console.timeEnd(`node-${event.nodeId}`);
    }
}
```

## Testing

The graph implementation includes comprehensive test coverage. Run tests with:

```bash
cd core/runnable
pnpm test
```

Key testing patterns:

1. **Unit tests** for individual graph operations
2. **Integration tests** for complex graph scenarios
3. **Error handling tests** for failure scenarios
4. **Performance tests** for parallel execution
5. **Event propagation tests** for proper event handling

## Examples

See the examples directory for complete working examples:

### Graph Examples (`examples/graph-examples.js`)
- Simple linear pipeline
- Fan-out/fan-in pattern
- Conditional processing with error handling
- Real-world data processing pipeline

### Schema Validation Examples (`examples/graph-schema-validation.js`)
- Schema-based type checking
- Error handling during graph construction
- Multi-output node validation
- Best practices for schema design

Run the examples:

```bash
cd core/runnable
node examples/graph-examples.js
node examples/graph-schema-validation.js
```

## API Reference

### RunnableGraph

#### Constructor
- `new RunnableGraph(options?: RunnableGraphOptions)`

#### Methods
- `addNode(id: string, runnable: Runnable, config?: NodeConfig): RunnableGraph`
- `connect(fromNodeId: string, toNodeId: string, config?: ConnectionConfig): RunnableGraph`
- `setEntryNodes(...nodeIds: string[]): RunnableGraph`
- `setExitNodes(...nodeIds: string[]): RunnableGraph`
- `invoke(input: any, context?: any): AsyncGenerator`

#### Static Methods
- `RunnableGraph.builder(options?: RunnableGraphOptions): RunnableGraphBuilder`

### RunnableGraphBuilder

#### Methods
- `node(id: string, runnable: Runnable, config?: NodeConfig): RunnableGraphBuilder`
- `connect(from: string, to: string, config?: ConnectionConfig): RunnableGraphBuilder`
- `entry(...nodeIds: string[]): RunnableGraphBuilder`
- `exit(...nodeIds: string[]): RunnableGraphBuilder`
- `build(): RunnableGraph`

## Migration from Simple Runnables

Converting existing runnables to use graphs is straightforward:

```javascript
// Before: Simple runnable chain
const result1 = await runnable1.invoke(input);
const result2 = await runnable2.invoke(result1);
const result3 = await runnable3.invoke(result2);

// After: Graph-based chain
const pipeline = RunnableGraph.builder()
    .node('step1', runnable1)
    .node('step2', runnable2)
    .node('step3', runnable3)
    .connect('step1', 'step2')
    .connect('step2', 'step3')
    .entry('step1')
    .exit('step3')
    .build();

const generator = pipeline.invoke(input);
for await (const event of generator) {
    // Handle events
}
const result = await generator.next();
```

The graph approach provides better error handling, event visibility, and the ability to easily modify the pipeline structure.