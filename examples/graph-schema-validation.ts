/**
 * @file examples/graph-schema-validation.ts
 * @description Example demonstrating schema validation in RunnableGraph
 */

import {z} from "zod";
import {Runnable, RunnableGraph} from "../index.js";

// Create test runnables with different schemas
export class NumberProcessorRunnable extends Runnable {
  constructor() {
    super({
      name: "NumberProcessor",
      description: "Processes a number and returns a string result",
      inputSchema: z.object({
        value: z.number().min(0, "Value must be positive"),
      }),
      outputSchema: z.object({
        result: z.string(),
        processed: z.boolean(),
      }),
    });
  }

  async* invoke(input: any): AsyncGenerator<
    {
      type: string;
      level: string;
      message: string;
      timestamp: number;
      runnableName: string;
    },
    {
      result: string;
      processed: boolean;
    },
    unknown
  > {
    yield {
      type: "log",
      level: "info",
      message: `Processing number: ${input.value}`,
      timestamp: Date.now(),
      runnableName: this.name ?? "Unnamed",
    };

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      result: `Processed: ${input.value * 2}`,
      processed: true,
    };
  }
}

export class StringFormatterRunnable extends Runnable {
  constructor() {
    super({
      name: "StringFormatter",
      description: "Formats a string result into a final message",
      inputSchema: z.object({
        result: z.string(),
        processed: z.boolean(),
      }),
      outputSchema: z.object({
        message: z.string(),
        timestamp: z.number(),
      }),
    });
  }

  async* invoke(input: any): AsyncGenerator<
    {
      type: string;
      level: string;
      message: string;
      timestamp: number;
      runnableName: string;
    },
    {
      message: string;
      timestamp: number;
    },
    unknown
  > {
    yield {
      type: "log",
      level: "info",
      message: `Formatting result: ${input.result}`,
      timestamp: Date.now(),
      runnableName: this.name ?? "Unnamed",
    };

    return {
      message: `Final: ${input.result} (${input.processed ? "Success" : "Failed"})`,
      timestamp: Date.now(),
    };
  }
}

// Example of incompatible runnable
export class IncompatibleRunnable extends Runnable {
  constructor() {
    super({
      name: "IncompatibleProcessor",
      description: "Has incompatible input schema",
      inputSchema: z.object({
        data: z.number(), // Expects 'data' but previous outputs 'result'
        flag: z.string(), // Required field not provided by previous node
      }),
      outputSchema: z.object({
        output: z.string(),
      }),
    });
  }

  async* invoke(input: any): AsyncGenerator<
    never,
    {
      output: string;
    },
    unknown
  > {
    return {output: "processed"};
  }
}

export async function demonstrateCompatibleGraph(): Promise<void> {
  console.log("=== COMPATIBLE GRAPH EXAMPLE ===");

  const graph = new RunnableGraph({name: "CompatibleProcessingGraph"});

  // Add nodes with compatible schemas
  graph.addNode("processor", new NumberProcessorRunnable());
  graph.addNode("formatter", new StringFormatterRunnable());

  // Connect the nodes
  graph.connect("processor", "formatter");

  // Set entry and exit nodes
  graph.setEntryNodes("processor");
  graph.setExitNodes("formatter");

  console.log("Graph created successfully - schemas are compatible!");

  try {
    // Execute the graph
    const generator = graph.invoke({value: 42});
    const events: any[] = [];
    let result;

    for await (const event of generator) {
      events.push(event);
      console.log("Event:", event.type, event.message || event.data);
    }

    console.log("Graph executed successfully!");
    console.log("Events generated:", events.length);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Graph execution failed:", msg);
  }
}

export async function demonstrateIncompatibleGraph(): Promise<void> {
  console.log("\n=== INCOMPATIBLE GRAPH EXAMPLE ===");

  const graph = new RunnableGraph({name: "IncompatibleProcessingGraph"});

  try {
    // Add nodes with incompatible schemas
    graph.addNode("processor", new NumberProcessorRunnable());
    graph.addNode("incompatible", new IncompatibleRunnable());

    // Connect the nodes (this will fail validation)
    graph.connect("processor", "incompatible");

    // Set entry and exit nodes
    graph.setEntryNodes("processor");
    graph.setExitNodes("incompatible");

    // This should fail during validation
    const generator = graph.invoke({value: 42});
    console.log("ERROR: Graph should have failed validation!");
  } catch (error: unknown) {
    console.log("✓ Graph validation correctly failed:");
    const msg = error instanceof Error ? error.message : String(error);
    console.log("  Error:", msg);
  }
}

export async function demonstrateWarningScenarios(): Promise<void> {
  console.log("\n=== WARNING SCENARIOS ===");

  // Scenario 1: Missing schemas
  console.log("\n1. Missing Schemas:");
  const graphWithoutSchemas = new RunnableGraph({name: "NoSchemaGraph"});

  const noSchemaRunnable = new (class extends Runnable {
    async* invoke(input: any) {
      return input;
    }
  })();

  graphWithoutSchemas.addNode("node1", noSchemaRunnable);
  graphWithoutSchemas.setEntryNodes("node1");
  graphWithoutSchemas.setExitNodes("node1");

  try {
    const generator = graphWithoutSchemas.invoke({test: "data"});
    // Consume the generator to trigger validation
    for await (const event of generator) {
      // Just consume events
    }
    console.log("✓ Graph executed with warnings about missing schemas");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error:", msg);
  }

  // Scenario 2: Optional compatibility issues
  console.log("\n2. Optional Field Warnings:");
  const optionalOutputRunnable = new (class extends Runnable {
    constructor() {
      super({
        name: "OptionalOutput",
        inputSchema: z.object({value: z.number()}),
        outputSchema: z.object({
          result: z.string().optional(), // Optional output
        }),
      });
    }

    async* invoke(input: any) {
      return {result: `Value: ${input.value}`};
    }
  })();

  const requiredInputRunnable = new (class extends Runnable {
    constructor() {
      super({
        name: "RequiredInput",
        inputSchema: z.object({
          result: z.string(), // Required input
        }),
        outputSchema: z.object({final: z.string()}),
      });
    }

    async* invoke(input: any) {
      return {final: input.result};
    }
  })();

  const warningGraph = new RunnableGraph({name: "WarningGraph"});
  warningGraph.addNode("optional", optionalOutputRunnable);
  warningGraph.addNode("required", requiredInputRunnable);
  warningGraph.connect("optional", "required");
  warningGraph.setEntryNodes("optional");
  warningGraph.setExitNodes("required");

  try {
    const generator = warningGraph.invoke({value: 123});
    for await (const event of generator) {
      // Just consume events
    }
    console.log(
      "✓ Graph executed with warnings about optional/required mismatch",
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error:", msg);
  }
}

export async function demonstrateHelp(): Promise<void> {
  console.log("\n=== RUNNABLE HELP EXAMPLES ===");

  const processor = new NumberProcessorRunnable();
  const formatter = new StringFormatterRunnable();

  console.log("\nNumberProcessorRunnable Help:");
  console.log(processor.help());

  console.log("\nStringFormatterRunnable Help:");
  console.log(formatter.help());
}

// Run all demonstrations
async function main() {
  try {
    await demonstrateCompatibleGraph();
    await demonstrateIncompatibleGraph();
    await demonstrateWarningScenarios();
    await demonstrateHelp();
  } catch (error) {
    console.error("Demo failed:", error);
  }
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}