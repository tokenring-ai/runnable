import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { RunnableGraph } from "../graph.js";
import { Runnable } from "../runnable.js";
import { RunnableGraphBuilder } from "../graphBuilder.js";

// Helper to consume a generator and collect events for testing
async function consumeGenerator(generator) {
	const events = [];
	let returnValue;
	try {
		let result = await generator.next();
		while (!result.done) {
			events.push(result.value);
			result = await generator.next();
		}
		returnValue = result.value;
	} catch (e) {
		events.push({
			type: "test_framework_error_catch",
			error: { name: e.name, message: e.message },
		});
		throw e;
	}
	return { events, returnValue };
}

// Mock runnable classes for testing
class MockRunnable extends Runnable {
	constructor(name, behavior = {}, options = {}) {
		super({ name, ...options });
		this.behavior = {
			delay: 0,
			shouldFail: false,
			output: null,
			events: [],
			...behavior,
		};
	}

	async *invoke(input, context) {
		// Yield initial log
		yield {
			type: "log",
			level: "info",
			message: `MockRunnable ${this.name} starting with input: ${JSON.stringify(input)}`,
			timestamp: Date.now(),
			runnableName: this.name,
		};

		// Yield any custom events
		for (const event of this.behavior.events) {
			yield { ...event, runnableName: this.name, timestamp: Date.now() };
		}

		// Simulate delay with abort checking
		if (this.behavior.delay > 0) {
			const startTime = Date.now();
			while (Date.now() - startTime < this.behavior.delay) {
				if (this.abortSignal.aborted) {
					throw new Error("Aborted");
				}
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(10, this.behavior.delay)),
				);
			}
		}

		// Final check for abort
		if (this.abortSignal.aborted) {
			throw new Error("Aborted");
		}

		// Simulate failure
		if (this.behavior.shouldFail) {
			throw new Error(`MockRunnable ${this.name} failed as configured`);
		}

		// Return output (use input if no specific output configured)
		const output = this.behavior.output !== null ? this.behavior.output : input;

		yield {
			type: "log",
			level: "info",
			message: `MockRunnable ${this.name} completed with output: ${JSON.stringify(output)}`,
			timestamp: Date.now(),
			runnableName: this.name,
		};

		return output;
	}
}

class MultiOutputRunnable extends Runnable {
	constructor(name, outputs) {
		super({ name });
		this.outputs = outputs;
	}

	async *invoke(input, context) {
		yield {
			type: "log",
			level: "info",
			message: `MultiOutputRunnable ${this.name} processing input: ${JSON.stringify(input)}`,
			timestamp: Date.now(),
			runnableName: this.name,
		};

		return this.outputs;
	}
}

describe("RunnableGraph", () => {
	describe("Constructor and Basic Setup", () => {
		it("should create an empty graph with default options", () => {
			const graph = new RunnableGraph();
			expect(graph.name).toBeUndefined();
			expect(graph.abortController).toBeInstanceOf(AbortController);
		});

		it("should accept options in constructor", () => {
			const options = {
				name: "TestGraph",
				parallel: false,
				maxConcurrency: 5,
				continueOnError: true,
			};
			const graph = new RunnableGraph(options);
			expect(graph.name).toBe("TestGraph");
		});
	});

	describe("Node Management", () => {
		let graph;

		beforeEach(() => {
			graph = new RunnableGraph({ name: "TestGraph" });
		});

		it("should add nodes successfully", () => {
			const runnable = new MockRunnable("test");
			graph.addNode("node1", runnable);

			// Should not throw when adding valid node
			expect(() =>
				graph.addNode("node2", new MockRunnable("test2")),
			).not.toThrow();
		});

		it("should throw error when adding duplicate node IDs", () => {
			const runnable = new MockRunnable("test");
			graph.addNode("node1", runnable);

			expect(() => graph.addNode("node1", new MockRunnable("test2"))).toThrow(
				"Node with id 'node1' already exists",
			);
		});

		it("should throw error when adding non-Runnable instance", () => {
			expect(() => graph.addNode("node1", {})).toThrow(
				"Node 'node1' must be a Runnable instance",
			);
		});

		it("should accept node configuration", () => {
			const runnable = new MockRunnable("test");
			expect(() =>
				graph.addNode("node1", runnable, {
					inputs: ["input1", "input2"],
					outputs: ["output1", "output2"],
					optional: true,
				}),
			).not.toThrow();
		});
	});

	describe("Graph Connections", () => {
		let graph;

		beforeEach(() => {
			graph = new RunnableGraph({ name: "TestGraph" });
			graph.addNode("node1", new MockRunnable("test1"));
			graph.addNode("node2", new MockRunnable("test2"));
		});

		it("should connect nodes successfully", () => {
			expect(() => graph.connect("node1", "node2")).not.toThrow();
		});

		it("should throw error when connecting non-existent source node", () => {
			expect(() => graph.connect("nonexistent", "node2")).toThrow(
				"Source node 'nonexistent' does not exist",
			);
		});

		it("should throw error when connecting non-existent target node", () => {
			expect(() => graph.connect("node1", "nonexistent")).toThrow(
				"Target node 'nonexistent' does not exist",
			);
		});

		it("should accept connection configuration", () => {
			expect(() =>
				graph.connect("node1", "node2", {
					fromOutput: "customOutput",
					toInput: "customInput",
					transform: (data) => data.toUpperCase(),
				}),
			).not.toThrow();
		});
	});

	describe("Entry and Exit Nodes", () => {
		let graph;

		beforeEach(() => {
			graph = new RunnableGraph({ name: "TestGraph" });
			graph.addNode("node1", new MockRunnable("test1"));
			graph.addNode("node2", new MockRunnable("test2"));
		});

		it("should set entry nodes successfully", () => {
			expect(() => graph.setEntryNodes("node1")).not.toThrow();
			expect(() => graph.setEntryNodes("node1", "node2")).not.toThrow();
		});

		it("should set exit nodes successfully", () => {
			expect(() => graph.setExitNodes("node2")).not.toThrow();
			expect(() => graph.setExitNodes("node1", "node2")).not.toThrow();
		});

		it("should throw error when setting non-existent entry node", () => {
			expect(() => graph.setEntryNodes("nonexistent")).toThrow(
				"Entry node 'nonexistent' does not exist",
			);
		});

		it("should throw error when setting non-existent exit node", () => {
			expect(() => graph.setExitNodes("nonexistent")).toThrow(
				"Exit node 'nonexistent' does not exist",
			);
		});
	});

	describe("Graph Validation", () => {
		it("should throw error for empty graph", async () => {
			const graph = new RunnableGraph({ name: "EmptyGraph" });

			const generator = graph.invoke("test input");
			await expect(consumeGenerator(generator)).rejects.toThrow(
				"Graph must contain at least one node",
			);
		});

		it("should throw error for graph without entry nodes", async () => {
			const graph = new RunnableGraph({ name: "NoEntryGraph" });
			graph.addNode("node1", new MockRunnable("test"));
			graph.setExitNodes("node1");

			const generator = graph.invoke("test input");
			await expect(consumeGenerator(generator)).rejects.toThrow(
				"Graph must have at least one entry node",
			);
		});

		it("should throw error for graph without exit nodes", async () => {
			const graph = new RunnableGraph({ name: "NoExitGraph" });
			graph.addNode("node1", new MockRunnable("test"));
			graph.setEntryNodes("node1");

			const generator = graph.invoke("test input");
			await expect(consumeGenerator(generator)).rejects.toThrow(
				"Graph must have at least one exit node",
			);
		});
	});

	describe("Simple Graph Execution", () => {
		it("should execute single node graph", async () => {
			const graph = new RunnableGraph({ name: "SingleNodeGraph" });
			const mockRunnable = new MockRunnable("single", { output: "processed" });

			graph
				.addNode("single", mockRunnable)
				.setEntryNodes("single")
				.setExitNodes("single");

			const { events, returnValue } = await consumeGenerator(
				graph.invoke("test input"),
			);

			expect(returnValue).toBe("processed");

			// Check for graph start/end events
			const graphStartEvent = events.find((e) =>
				e.message?.includes("Starting graph execution"),
			);
			const graphEndEvent = events.find((e) =>
				e.message?.includes("Graph execution completed"),
			);
			expect(graphStartEvent).toBeDefined();
			expect(graphEndEvent).toBeDefined();
		});

		it("should execute linear chain of nodes", async () => {
			const graph = new RunnableGraph({ name: "LinearGraph" });

			const node1 = new MockRunnable("node1", { output: "step1" });
			const node2 = new MockRunnable("node2", { output: "step2" });
			const node3 = new MockRunnable("node3", { output: "final" });

			graph
				.addNode("node1", node1)
				.addNode("node2", node2)
				.addNode("node3", node3)
				.connect("node1", "node2")
				.connect("node2", "node3")
				.setEntryNodes("node1")
				.setExitNodes("node3");

			const { events, returnValue } = await consumeGenerator(
				graph.invoke("initial"),
			);

			expect(returnValue).toBe("final");

			// Verify execution order through events
			const nodeStartEvents = events.filter((e) =>
				e.message?.includes("Starting execution of node"),
			);
			expect(nodeStartEvents).toHaveLength(3);
			expect(nodeStartEvents[0].nodeId).toBe("node1");
			expect(nodeStartEvents[1].nodeId).toBe("node2");
			expect(nodeStartEvents[2].nodeId).toBe("node3");
		});
	});

	describe("Multi-Input/Output Scenarios", () => {
		it("should handle multi-input nodes", async () => {
			const graph = new RunnableGraph({ name: "MultiInputGraph" });

			const source1 = new MockRunnable("source1", { output: "data1" });
			const source2 = new MockRunnable("source2", { output: "data2" });
			const combiner = new MockRunnable("combiner", {
				output: (input) => `combined: ${input.input1} + ${input.input2}`,
			});

			graph
				.addNode("source1", source1)
				.addNode("source2", source2)
				.addNode("combiner", combiner, { inputs: ["input1", "input2"] })
				.connect("source1", "combiner", { toInput: "input1" })
				.connect("source2", "combiner", { toInput: "input2" })
				.setEntryNodes("source1", "source2")
				.setExitNodes("combiner");

			const { returnValue } = await consumeGenerator(graph.invoke("initial"));

			expect(typeof returnValue).toBe("function");
			// The combiner receives an object with input1 and input2
			const result = returnValue({ input1: "data1", input2: "data2" });
			expect(result).toBe("combined: data1 + data2");
		});

		it("should handle multi-output nodes", async () => {
			const graph = new RunnableGraph({ name: "MultiOutputGraph" });

			const splitter = new MultiOutputRunnable("splitter", {
				output1: "first",
				output2: "second",
			});
			const consumer1 = new MockRunnable("consumer1");
			const consumer2 = new MockRunnable("consumer2");

			graph
				.addNode("splitter", splitter, { outputs: ["output1", "output2"] })
				.addNode("consumer1", consumer1, { inputs: ["input"] })
				.addNode("consumer2", consumer2, { inputs: ["input"] })
				.connect("splitter", "consumer1", {
					fromOutput: "output1",
					toInput: "input",
				})
				.connect("splitter", "consumer2", {
					fromOutput: "output2",
					toInput: "input",
				})
				.setEntryNodes("splitter")
				.setExitNodes("consumer1", "consumer2");

			const { returnValue } = await consumeGenerator(graph.invoke("initial"));

			expect(returnValue).toEqual({
				consumer1: "first",
				consumer2: "second",
			});
		});
	});

	describe("Parallel Execution", () => {
		it("should execute independent nodes in parallel when enabled", async () => {
			const graph = new RunnableGraph({
				name: "ParallelGraph",
				parallel: true,
				maxConcurrency: 2,
			});

			const node1 = new MockRunnable("node1", { delay: 50, output: "result1" });
			const node2 = new MockRunnable("node2", { delay: 50, output: "result2" });
			const combiner = new MockRunnable("combiner", {
				output: (input) => `${input.input1}-${input.input2}`,
			});

			graph
				.addNode("node1", node1)
				.addNode("node2", node2)
				.addNode("combiner", combiner, { inputs: ["input1", "input2"] })
				.connect("node1", "combiner", { toInput: "input1" })
				.connect("node2", "combiner", { toInput: "input2" })
				.setEntryNodes("node1", "node2")
				.setExitNodes("combiner");

			const startTime = Date.now();
			const { returnValue } = await consumeGenerator(graph.invoke("initial"));
			const endTime = Date.now();

			// Should complete faster than sequential execution (less than 100ms for parallel vs 100ms+ for sequential)
			expect(endTime - startTime).toBeLessThan(100);
			expect(typeof returnValue).toBe("function");
		});

		it("should execute nodes sequentially when parallel is disabled", async () => {
			const graph = new RunnableGraph({
				name: "SequentialGraph",
				parallel: false,
			});

			const node1 = new MockRunnable("node1", { delay: 30, output: "result1" });
			const node2 = new MockRunnable("node2", { delay: 30, output: "result2" });

			graph
				.addNode("node1", node1)
				.addNode("node2", node2)
				.setEntryNodes("node1", "node2")
				.setExitNodes("node1", "node2");

			const startTime = Date.now();
			await consumeGenerator(graph.invoke("initial"));
			const endTime = Date.now();

			// Should take longer for sequential execution
			expect(endTime - startTime).toBeGreaterThan(50);
		});
	});

	describe("Error Handling", () => {
		it("should propagate errors from failed nodes", async () => {
			const graph = new RunnableGraph({ name: "ErrorGraph" });
			const failingNode = new MockRunnable("failing", { shouldFail: true });

			graph
				.addNode("failing", failingNode)
				.setEntryNodes("failing")
				.setExitNodes("failing");

			const generator = graph.invoke("test input");
			await expect(consumeGenerator(generator)).rejects.toThrow(
				"MockRunnable failing failed as configured",
			);
		});

		it("should continue execution when optional nodes fail", async () => {
			const graph = new RunnableGraph({
				name: "OptionalErrorGraph",
				continueOnError: true,
			});

			const successNode = new MockRunnable("success", { output: "success" });
			const failingNode = new MockRunnable("failing", { shouldFail: true });

			graph
				.addNode("success", successNode)
				.addNode("failing", failingNode, { optional: true })
				.setEntryNodes("success", "failing")
				.setExitNodes("success");

			const { events, returnValue } = await consumeGenerator(
				graph.invoke("initial"),
			);

			expect(returnValue).toBe("success");

			// Should have error events but not fail
			const errorEvents = events.filter((e) => e.type === "error_event");
			expect(errorEvents.length).toBeGreaterThan(0);
		});

		it("should handle abort signals", async () => {
			const abortController = new AbortController();
			const graph = new RunnableGraph({
				name: "AbortGraph",
				abortController,
			});

			// Use the same abort controller for the node
			const slowNode = new MockRunnable(
				"slow",
				{ delay: 1000 },
				{ abortController },
			);
			graph
				.addNode("slow", slowNode)
				.setEntryNodes("slow")
				.setExitNodes("slow");

			// Abort after a short delay
			setTimeout(() => abortController.abort(), 50);

			const generator = graph.invoke("test input");
			await expect(consumeGenerator(generator)).rejects.toThrow("Aborted");
		});

		it("should report dependency details when execution gets stuck", async () => {
			const graph = new RunnableGraph({ name: "StuckGraph" });
			const start = new MockRunnable("start");
			const orphan = new MockRunnable("orphan");

			graph
				.addNode("start", start)
				.addNode("orphan", orphan, { inputs: ["need"] })
				.setEntryNodes("start")
				.setExitNodes("orphan");

			const generator = graph.invoke("input");
			await expect(consumeGenerator(generator)).rejects.toThrow(
				/Remaining nodes: orphan waiting for need/,
			);
		});
	});

	describe("Event Propagation", () => {
		it("should enhance events with node and graph context", async () => {
			const graph = new RunnableGraph({ name: "EventGraph" });
			const eventNode = new MockRunnable("eventNode", {
				events: [
					{ type: "chunk", data: "test chunk" },
					{ type: "log", level: "debug", message: "debug message" },
				],
			});

			graph
				.addNode("eventNode", eventNode)
				.setEntryNodes("eventNode")
				.setExitNodes("eventNode");

			const { events } = await consumeGenerator(graph.invoke("test"));

			// Find the enhanced events
			const chunkEvent = events.find((e) => e.type === "chunk");
			const debugEvent = events.find(
				(e) => e.type === "log" && e.level === "debug",
			);

			expect(chunkEvent).toMatchObject({
				type: "chunk",
				data: "test chunk",
				nodeId: "eventNode",
				graphName: "EventGraph",
			});

			expect(debugEvent).toMatchObject({
				type: "log",
				level: "debug",
				message: "debug message",
				nodeId: "eventNode",
				graphName: "EventGraph",
			});
		});
	});

	describe("describe()", () => {
		it("should return a summary of the graph", () => {
			const graph = new RunnableGraph({ name: "DescGraph" });
			graph
				.addNode("node1", new MockRunnable("node1"))
				.addNode("node2", new MockRunnable("node2"))
				.connect("node1", "node2")
				.setEntryNodes("node1")
				.setExitNodes("node2");

			const summary = graph.describe();
			expect(summary).toEqual({
				nodes: ["node1", "node2"],
				connections: [
					{
						from: "node1",
						to: "node2",
						fromOutput: "output",
						toInput: "input",
					},
				],
				entryNodes: ["node1"],
				exitNodes: ["node2"],
				options: {
					parallel: true,
					maxConcurrency: 10,
					continueOnError: false,
					name: "DescGraph",
				},
			});
		});
	});
});

describe("RunnableGraphBuilder", () => {
	it("should build graphs using fluent API", () => {
		const node1 = new MockRunnable("node1");
		const node2 = new MockRunnable("node2");

		const graph = RunnableGraph.builder({ name: "FluentGraph" })
			.node("node1", node1)
			.node("node2", node2)
			.connect("node1", "node2")
			.entry("node1")
			.exit("node2")
			.build();

		expect(graph).toBeInstanceOf(RunnableGraph);
		expect(graph.name).toBe("FluentGraph");
	});

	it("should support complex graph construction", () => {
		const source = new MockRunnable("source");
		const processor1 = new MockRunnable("processor1");
		const processor2 = new MockRunnable("processor2");
		const combiner = new MockRunnable("combiner");

		const graph = RunnableGraph.builder()
			.node("source", source)
			.node("proc1", processor1)
			.node("proc2", processor2)
			.node("combiner", combiner, { inputs: ["input1", "input2"] })
			.connect("source", "proc1")
			.connect("source", "proc2")
			.connect("proc1", "combiner", { toInput: "input1" })
			.connect("proc2", "combiner", { toInput: "input2" })
			.entry("source")
			.exit("combiner")
			.build();

		expect(graph).toBeInstanceOf(RunnableGraph);
	});
});

describe("Graph Persistence", () => {
	it("should resume execution with saved state", async () => {
		const graph = new RunnableGraph({ name: "PersistGraph" });
		const n1 = new MockRunnable("n1", { output: 1 });
		const n2 = new MockRunnable("n2", { output: 2 });
		const n3 = new MockRunnable("n3", { output: 3 });

		graph
			.addNode("n1", n1)
			.addNode("n2", n2)
			.addNode("n3", n3)
			.connect("n1", "n2")
			.connect("n2", "n3")
			.setEntryNodes("n1")
			.setExitNodes("n3");

		const state = {};
		const gen1 = graph.invoke(0, { persistence: state });
		let r = await gen1.next();
		while (!r.done) {
			if (
				r.value.message &&
				r.value.message.includes("Completed execution of node 'n2'")
			) {
				await gen1.return();
				break;
			}
			r = await gen1.next();
		}

		expect(state.completedNodes).toContain("n1");
		expect(state.completedNodes).toContain("n2");

		const { events, returnValue } = await consumeGenerator(
			graph.invoke(0, { persistence: state }),
		);
		expect(returnValue).toBe(3);
		const startEvents = events.filter((e) =>
			e.message?.startsWith("Starting execution of node"),
		);
		const startedNodes = startEvents.map((e) => e.nodeId);
		expect(startedNodes).not.toContain("n1");
		expect(startedNodes).not.toContain("n2");
	});
});

describe("Integration Tests", () => {
	it("should handle complex real-world-like scenario", async () => {
		// Simulate a data processing pipeline:
		// Input -> [Validate, Transform] -> Combine -> [Save, Notify] -> Output

		const validator = new MockRunnable("validator", {
			output: (input) => ({ ...input, validated: true }),
		});

		const transformer = new MockRunnable("transformer", {
			output: (input) => ({ ...input, transformed: true }),
		});

		const combiner = new MockRunnable("combiner", {
			output: (input) => ({
				...input.validation,
				...input.transformation,
				combined: true,
			}),
		});

		const saver = new MockRunnable("saver", {
			output: (input) => ({ ...input, saved: true }),
		});

		const notifier = new MockRunnable("notifier", {
			output: (input) => ({ ...input, notified: true }),
		});

		const finalizer = new MockRunnable("finalizer", {
			output: (input) => ({
				saveResult: input.saveResult,
				notifyResult: input.notifyResult,
				completed: true,
			}),
		});

		const graph = RunnableGraph.builder({
			name: "DataPipeline",
			parallel: true,
		})
			.node("validator", validator)
			.node("transformer", transformer)
			.node("combiner", combiner, { inputs: ["validation", "transformation"] })
			.node("saver", saver)
			.node("notifier", notifier)
			.node("finalizer", finalizer, { inputs: ["saveResult", "notifyResult"] })
			.connect("validator", "combiner", { toInput: "validation" })
			.connect("transformer", "combiner", { toInput: "transformation" })
			.connect("combiner", "saver")
			.connect("combiner", "notifier")
			.connect("saver", "finalizer", { toInput: "saveResult" })
			.connect("notifier", "finalizer", { toInput: "notifyResult" })
			.entry("validator", "transformer")
			.exit("finalizer")
			.build();

		const input = { data: "test data", id: 123 };
		const { events, returnValue } = await consumeGenerator(graph.invoke(input));

		// Verify the pipeline completed successfully
		expect(typeof returnValue).toBe("function");

		// Verify all nodes executed
		const nodeExecutions = events.filter((e) =>
			e.message?.includes("Starting execution of node"),
		);
		expect(nodeExecutions).toHaveLength(6);

		// Verify graph completion
		const completionEvent = events.find((e) =>
			e.message?.includes("Graph execution completed"),
		);
		expect(completionEvent).toBeDefined();
		expect(completionEvent.completedNodes).toHaveLength(6);
		expect(completionEvent.failedNodes).toHaveLength(0);
	});
});

describe("RunnableGraph Schema Validation", () => {
	// Helper to create a test runnable with schemas
	function createTestRunnable(name, inputSchema, outputSchema) {
		return new (class extends Runnable {
			constructor() {
				super({ name, inputSchema, outputSchema });
			}

			async *invoke(input) {
				yield {
					type: "log",
					level: "info",
					message: `${name} processing`,
					timestamp: Date.now(),
					runnableName: name,
				};
				return input; // Simple pass-through
			}
		})();
	}

	describe("Schema Presence Validation", () => {
		it("should warn when nodes have no schemas", () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const graph = new RunnableGraph();
			const nodeA = new (class extends Runnable {
				async *invoke(input) {
					return input;
				}
			})();

			graph.addNode("A", nodeA);
			graph.setEntryNodes("A");
			graph.setExitNodes("A");

			// This should not throw but should warn
			expect(() => graph.invoke({})).not.toThrow();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Graph schema validation warnings:",
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Node 'A' input has no schema defined"),
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Node 'A' output has no schema defined"),
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe("Compatible Schema Validation", () => {
		it("should pass validation with compatible schemas", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.string() }),
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }),
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);
			graph.connect("A", "B");
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw
			expect(() => graph.invoke({ value: 42 })).not.toThrow();
		});

		it("should pass validation with type conversions", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.number() }), // number output
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }), // string input (number can convert to string)
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);
			graph.connect("A", "B");
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw
			expect(() => graph.invoke({ value: 42 })).not.toThrow();
		});
	});

	describe("Incompatible Schema Validation", () => {
		it("should throw error for incompatible basic types", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.boolean() }), // boolean output
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.number() }), // number input (boolean cannot convert to number)
				z.object({ final: z.string() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);

			// Error should be thrown during graph construction, not during invoke
			expect(() => graph.connect("A", "B")).toThrow(
				/Schema incompatibility between 'A' \(output\) and 'B' \(input\)/,
			);
		});

		it("should throw error for missing required properties", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.string() }), // Only has 'result'
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({
					result: z.string(),
					required: z.number(), // Missing required property
				}),
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);

			// Error should be thrown during graph construction, not during invoke
			expect(() => graph.connect("A", "B")).toThrow(
				/Required input property 'required' is not provided/,
			);
		});

		it("should throw error for nullable output to non-nullable input", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.string().nullable() }), // Nullable output
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }), // Non-nullable input
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);

			// Error should be thrown during graph construction, not during invoke
			expect(() => graph.connect("A", "B")).toThrow(
				/Output can be null but input does not accept null/,
			);
		});
	});

	describe("Optional Schema Validation", () => {
		it("should warn about optional output to required input", () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.string().optional() }), // Optional output
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }), // Required input
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);
			graph.connect("A", "B");
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw but should warn
			const generator = graph.invoke({ value: 42 });
			expect(generator).toBeDefined();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Graph schema validation warnings:",
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Output is optional but input is required"),
			);

			consoleWarnSpy.mockRestore();
		});

		it("should warn about missing optional properties", () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.string() }), // Only has 'result'
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({
					result: z.string(),
					optional: z.number().optional(), // Missing optional property
				}),
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);
			graph.connect("A", "B");
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw but should warn
			const generator = graph.invoke({ value: 42 });
			expect(generator).toBeDefined();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Graph schema validation warnings:",
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Optional input property 'optional' is not provided",
				),
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe("Complex Schema Validation", () => {
		it("should validate nested object schemas", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({
					user: z.object({
						name: z.string(),
						age: z.string(), // Wrong type - should be number
					}),
				}),
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({
					user: z.object({
						name: z.string(),
						age: z.number(), // Expects number
					}),
				}),
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);

			// Error should be thrown during graph construction, not during invoke
			expect(() => graph.connect("A", "B")).toThrow(/Property 'user'/);
		});

		it("should validate array element schemas", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ items: z.array(z.boolean()) }), // Array of booleans
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ items: z.array(z.number()) }), // Array of numbers
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);

			// Error should be thrown during graph construction, not during invoke
			expect(() => graph.connect("A", "B")).toThrow(/Array element/);
		});

		it("should validate union type compatibility", () => {
			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({ result: z.union([z.string(), z.number()]) }), // Union output
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }), // String input (compatible with union)
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA);
			graph.addNode("B", nodeB);
			graph.connect("A", "B");
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw
			expect(() => graph.invoke({ value: 42 })).not.toThrow();
		});
	});

	describe("Multi-output Node Validation", () => {
		it("should warn about multi-output node validation limitations", () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const nodeA = createTestRunnable(
				"A",
				z.object({ value: z.number() }),
				z.object({
					output1: z.string(),
					output2: z.number(),
				}),
			);
			const nodeB = createTestRunnable(
				"B",
				z.object({ result: z.string() }),
				z.object({ final: z.boolean() }),
			);

			const graph = new RunnableGraph();
			graph.addNode("A", nodeA, { outputs: ["output1", "output2"] });
			graph.addNode("B", nodeB);
			graph.connect("A", "B", { fromOutput: "output1", toInput: "result" });
			graph.setEntryNodes("A");
			graph.setExitNodes("B");

			// Should not throw but should warn about multi-output limitation
			const generator = graph.invoke({ value: 42 });
			expect(generator).toBeDefined();

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Graph schema validation warnings:",
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Cannot validate specific output 'output1' from multi-output node",
				),
			);

			consoleWarnSpy.mockRestore();
		});
	});
});
