import { Runnable } from "./runnable.js";
import { RunnableGraph } from "./graph.js";
import { LogEvent } from "./events.js";

/**
 * Runnable orchestrator that executes a RunnableGraph and can
 * dynamically add nodes after each run based on persisted results.
 * Completed nodes are not rerun thanks to the graph's persistence layer.
 */
export class GraphOrchestrator extends Runnable {
	/**
	 * @param {RunnableGraph} graph
	 * @param {import('./runnable.js').RunnableOptions} [options]
	 */
	constructor(graph = new RunnableGraph(), options = {}) {
		super(options);
		this.graph = graph;
		this.persistence = {};
	}

	/**
	 * Hook that allows subclasses to modify the graph between runs.
	 * Return `true` if the graph was changed and should be executed again.
	 *
	 * @param {{graph: RunnableGraph, persistence: any, input: any, output: any, context: any}} params
	 * @returns {Promise<boolean>|boolean}
	 */
	// eslint-disable-next-line no-unused-vars
	async updateGraph({ graph, persistence, input, output, context }) {
		return false;
	}

	/**
	 * Runs the orchestrator until `updateGraph` returns false.
	 * @param {any} input
	 * @param {any} [context]
	 * @returns {AsyncGenerator<import('./events.js').BaseYieldType, any, void>}
	 */
	async *invoke(input, context = {}) {
		const persistence = context.persistence || this.persistence;
		context = { ...context, persistence };
		let output;
		let changed = true;

		while (changed) {
			const gen = this.graph.invoke(input, context);
			let done = false;
			while (!done) {
				const { value, done: isDone } = await gen.next();
				done = isDone;
				if (!done) {
					yield value;
				} else {
					output = value;
				}
			}

			changed = await this.updateGraph({
				graph: this.graph,
				persistence,
				input,
				output,
				context,
			});

			if (changed) {
				yield new LogEvent("info", "Graph updated, continuing execution", {
					runnableName: this.name,
				});
			}
		}

		return output;
	}

	/**
	 * Returns a builder for fluently creating an orchestrator with an
	 * initial graph definition.
	 * @param {import('./graph.js').RunnableGraphOptions} [options]
	 * @returns {GraphOrchestratorBuilder}
	 */
	static builder(options) {
		return new GraphOrchestratorBuilder(options);
	}
}

/**
 * Builder class mirroring RunnableGraphBuilder but producing a
 * GraphOrchestrator instance from `build()`.
 */
export class GraphOrchestratorBuilder {
	/**
	 * @param {import('./graph.js').RunnableGraphOptions} [options]
	 */
	constructor(options) {
		this.#graph = new RunnableGraph(options);
	}

	/** @type {RunnableGraph} */
	#graph;

	/**
	 * Adds a node to the graph.
	 * @param {string} id
	 * @param {Runnable} runnable
	 * @param {Object} [config]
	 * @returns {GraphOrchestratorBuilder}
	 */
	node(id, runnable, config) {
		this.#graph.addNode(id, runnable, config);
		return this;
	}

	/**
	 * Connects two nodes in the graph.
	 * @param {string} from
	 * @param {string} to
	 * @param {Object} [config]
	 * @returns {GraphOrchestratorBuilder}
	 */
	connect(from, to, config) {
		this.#graph.connect(from, to, config);
		return this;
	}

	/**
	 * Sets entry nodes.
	 * @param {...string} nodeIds
	 * @returns {GraphOrchestratorBuilder}
	 */
	entry(...nodeIds) {
		this.#graph.setEntryNodes(...nodeIds);
		return this;
	}

	/**
	 * Sets exit nodes.
	 * @param {...string} nodeIds
	 * @returns {GraphOrchestratorBuilder}
	 */
	exit(...nodeIds) {
		this.#graph.setExitNodes(...nodeIds);
		return this;
	}

	/**
	 * Finalizes the builder and returns a GraphOrchestrator.
	 * @returns {GraphOrchestrator}
	 */
	build() {
		return new GraphOrchestrator(this.#graph);
	}
}
