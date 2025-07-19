import { RunnableGraph } from "./graph.js";

/**
 * Builder class for constructing RunnableGraph instances with a fluent API.
 */
export class RunnableGraphBuilder {
	/**
	 * @type {RunnableGraph}
	 */
	#graph;

	/**
	 * Creates a new builder instance.
	 * @param {RunnableGraphOptions} [options] - Graph options
	 */
	constructor(options) {
		this.#graph = new RunnableGraph(options);
	}

	/**
	 * Adds a node to the graph.
	 * @param {string} id - Node ID
	 * @param {Runnable} runnable - Runnable instance
	 * @param {Object} [config] - Node configuration
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	node(id, runnable, config) {
		this.#graph.addNode(id, runnable, config);
		return this;
	}

	/**
	 * Connects two nodes.
	 * @param {string} from - Source node ID
	 * @param {string} to - Target node ID
	 * @param {Object} [config] - Connection configuration
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	connect(from, to, config) {
		this.#graph.connect(from, to, config);
		return this;
	}

	/**
	 * Sets entry nodes.
	 * @param {...string} nodeIds - Entry node IDs
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	entry(...nodeIds) {
		this.#graph.setEntryNodes(...nodeIds);
		return this;
	}

	/**
	 * Sets exit nodes.
	 * @param {...string} nodeIds - Exit node IDs
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	exit(...nodeIds) {
		this.#graph.setExitNodes(...nodeIds);
		return this;
	}

	/**
	 * Builds and returns the configured graph.
	 * @returns {RunnableGraph} The constructed graph
	 */
	build() {
		return this.#graph;
	}
}
