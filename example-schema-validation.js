/**
 * Example demonstrating schema validation in RunnableGraph
 */

import { z } from "zod";
import { Runnable } from "./runnable.js";
import { RunnableGraph } from "./graph.js";

// Create a runnable with optional output
class NodeA extends Runnable {
	name = "Node A";

	inputSchema = z.object({
		value: z.number(),
	});

	outputSchema = z.object({
		result: z.string().optional(), // Optional output
	});

	async *invoke(input) {
		yield { type: "log", message: "Node A processing..." };
		return { result: `Processed: ${input.value}` };
	}
}

// Create a runnable with required input
class NodeB extends Runnable {
	name = "Node B";

	inputSchema = z.object({
		result: z.string(), // Required input
	});

	outputSchema = z.object({
		final: z.string(),
	});

	async *invoke(input) {
		yield { type: "log", message: "Node B processing..." };
		return { final: `Final: ${input.result}` };
	}
}

// Create and test the graph
console.log("Creating graph with schema validation...");

const nodeA = new NodeA();
const nodeB = new NodeB();

const graph = new RunnableGraph();
graph.addNode("A", nodeA);
graph.addNode("B", nodeB);
graph.connect("A", "B", { fromOutput: "result", toInput: "result" });
graph.setEntryNodes("A");
graph.setExitNodes("B");

console.log("Invoking graph (this will trigger schema validation)...");

try {
	const generator = graph.invoke({ value: 42 });
	const firstEvent = await generator.next();
	console.log("Graph started successfully");
	console.log("First event:", firstEvent.value);
} catch (error) {
	console.error("Error:", error.message);
}

console.log(
	"\nSchema validation completed. Check console warnings above for any compatibility issues.",
);
