import { describe, expect, it } from "vitest";
import { Runnable } from "../runnable.ts";
import { RunnableGraph } from "../graph.ts";
import { GraphOrchestrator } from "../orchestrator.ts";

// Helper to consume generator
async function consumeGenerator(gen) {
	const events = [];
	let res = await gen.next();
	while (!res.done) {
		events.push(res.value);
		res = await gen.next();
	}
	return { events, returnValue: res.value };
}

// Simple mock runnable
class MockRunnable extends Runnable {
	constructor(name, behavior = {}) {
		super({ name });
		this.behavior = { output: null, delay: 0, shouldFail: false, ...behavior };
	}

	async *invoke(input) {
		yield {
			type: "log",
			level: "info",
			message: `MockRunnable '${this.name}' invoked`,
			timestamp: Date.now(),
			runnableName: this.name,
		};
		if (this.behavior.delay) {
			await new Promise((r) => setTimeout(r, this.behavior.delay));
		}
		if (this.behavior.shouldFail) {
			throw new Error("fail");
		}
		const output = this.behavior.output !== null ? this.behavior.output : input;
		yield {
			type: "log",
			level: "info",
			message: `Completed execution of node '${this.name}'`,
			timestamp: Date.now(),
			runnableName: this.name,
		};
		return output;
	}
}

describe("GraphOrchestrator", () => {
	it("dynamically adds nodes and skips completed ones", async () => {
		const n1 = new MockRunnable("n1", { output: 1 });
		const n2 = new MockRunnable("n2", { output: 2 });
		const n3 = new MockRunnable("n3", { output: 3 });

		const graph = new RunnableGraph();
		graph.addNode("n1", n1).addNode("n2", n2).connect("n1", "n2");
		graph.setEntryNodes("n1");
		graph.setExitNodes("n2");

		class DynamicOrchestrator extends GraphOrchestrator {
			async updateGraph({ graph, persistence }) {
				// Ensure completedNodes exists and is an array
				if (!persistence.completedNodes) {
					persistence.completedNodes = [];
				}

				if (
					persistence.completedNodes.includes("n2") &&
					!graph.describe().nodes.includes("n3")
				) {
					graph.addNode("n3", n3).connect("n2", "n3");
					graph.setExitNodes("n3");
					return true;
				}
				return false;
			}
		}

		const orch = new DynamicOrchestrator(graph, { name: "orch" });
		const { events, returnValue } = await consumeGenerator(orch.invoke(0));

		expect(returnValue).toBe(3);
		const started = events
			.filter((e) => e.message?.startsWith("Starting execution"))
			.map((e) => e.nodeId);
		expect(started).toEqual(["n1", "n2", "n3"]);
	});

	it("resumes using persistence", async () => {
		const n1 = new MockRunnable("n1", { output: 1 });
		const n2 = new MockRunnable("n2", { output: 2 });
		const n3 = new MockRunnable("n3", { output: 3 });
		const graph = new RunnableGraph();
		graph.addNode("n1", n1).addNode("n2", n2).connect("n1", "n2");
		graph.setEntryNodes("n1");
		graph.setExitNodes("n2");

		class DynamicOrchestrator extends GraphOrchestrator {
			async updateGraph({ graph, persistence }) {
				// Ensure completedNodes exists and is an array
				if (!persistence.completedNodes) {
					persistence.completedNodes = [];
				}

				if (
					persistence.completedNodes.includes("n2") &&
					!graph.describe().nodes.includes("n3")
				) {
					graph.addNode("n3", n3).connect("n2", "n3");
					graph.setExitNodes("n3");
					return true;
				}
				return false;
			}
		}

		const orch = new DynamicOrchestrator(graph);
		const state = { completedNodes: [] };
		const gen = orch.invoke(0, { persistence: state });
		let r = await gen.next();
		while (!r.done) {
			if (
				r.value.message &&
				r.value.message.includes("Completed execution of node 'n2'")
			) {
				await gen.return();
				break;
			}
			r = await gen.next();
		}

		expect(state.completedNodes).toContain("n1");
		expect(state.completedNodes).toContain("n2");

		const { events: ev2, returnValue } = await consumeGenerator(
			orch.invoke(0, { persistence: state }),
		);
		expect(returnValue).toBe(3);
		const started = ev2
			.filter((e) => e.message?.startsWith("Starting execution"))
			.map((e) => e.nodeId);
		expect(started).toEqual(["n3"]);
	});
});
