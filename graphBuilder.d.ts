/**
 * Builder class for constructing RunnableGraph instances with a fluent API.
 */
export class RunnableGraphBuilder {
	/**
	 * Creates a new builder instance.
	 * @param {RunnableGraphOptions} [options] - Graph options
	 */
	constructor(options?: RunnableGraphOptions);
	/**
	 * Adds a node to the graph.
	 * @param {string} id - Node ID
	 * @param {Runnable} runnable - Runnable instance
	 * @param {Object} [config] - Node configuration
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	node(id: string, runnable: Runnable, config?: any): RunnableGraphBuilder;
	/**
	 * Connects two nodes.
	 * @param {string} from - Source node ID
	 * @param {string} to - Target node ID
	 * @param {Object} [config] - Connection configuration
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	connect(from: string, to: string, config?: any): RunnableGraphBuilder;
	/**
	 * Sets entry nodes.
	 * @param {...string} nodeIds - Entry node IDs
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	entry(...nodeIds: string[]): RunnableGraphBuilder;
	/**
	 * Sets exit nodes.
	 * @param {...string} nodeIds - Exit node IDs
	 * @returns {RunnableGraphBuilder} This builder for chaining
	 */
	exit(...nodeIds: string[]): RunnableGraphBuilder;
	/**
	 * Builds and returns the configured graph.
	 * @returns {RunnableGraph} The constructed graph
	 */
	build(): RunnableGraph<any, any, any, any>;
	#private;
}
import { RunnableGraph } from "./graph.js";
