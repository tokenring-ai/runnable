/**
 * Runnable orchestrator that executes a RunnableGraph and can
 * dynamically add nodes after each run based on persisted results.
 * Completed nodes are not rerun thanks to the graph's persistence layer.
 */
export class GraphOrchestrator extends Runnable<any, any, any, any> {
	/**
	 * Returns a builder for fluently creating an orchestrator with an
	 * initial graph definition.
	 * @param {import('./graph.js').RunnableGraphOptions} [options]
	 * @returns {GraphOrchestratorBuilder}
	 */
	static builder(
		options?: import("./graph.js").RunnableGraphOptions,
	): GraphOrchestratorBuilder;
	/**
	 * @param {RunnableGraph} graph
	 * @param {import('./runnable.js').RunnableOptions} [options]
	 */
	constructor(
		graph?: RunnableGraph<any, any, any, any>,
		options?: import("./runnable.js").RunnableOptions,
	);
	graph: RunnableGraph<any, any, any, any>;
	persistence: {};
	/**
	 * Hook that allows subclasses to modify the graph between runs.
	 * Return `true` if the graph was changed and should be executed again.
	 *
	 * @param {{graph: RunnableGraph, persistence: any, input: any, output: any, context: any}} params
	 * @returns {Promise<boolean>|boolean}
	 */
	updateGraph({
		graph,
		persistence,
		input,
		output,
		context,
	}: {
		graph: RunnableGraph<any, any, any, any>;
		persistence: any;
		input: any;
		output: any;
		context: any;
	}): Promise<boolean> | boolean;
	/**
	 * Runs the orchestrator until `updateGraph` returns false.
	 * @param {any} input
	 * @param {any} [context]
	 * @returns {AsyncGenerator<import('./events.js').BaseYieldType, any, void>}
	 */
	invoke(
		input: any,
		context?: any,
	): AsyncGenerator<import("./events.js").BaseYieldType, any, void>;
}
/**
 * Builder class mirroring RunnableGraphBuilder but producing a
 * GraphOrchestrator instance from `build()`.
 */
export class GraphOrchestratorBuilder {
	/**
	 * @param {import('./graph.js').RunnableGraphOptions} [options]
	 */
	constructor(options?: import("./graph.js").RunnableGraphOptions);
	/**
	 * Adds a node to the graph.
	 * @param {string} id
	 * @param {Runnable} runnable
	 * @param {Object} [config]
	 * @returns {GraphOrchestratorBuilder}
	 */
	node(
		id: string,
		runnable: Runnable<any, any, any, any>,
		config?: any,
	): GraphOrchestratorBuilder;
	/**
	 * Connects two nodes in the graph.
	 * @param {string} from
	 * @param {string} to
	 * @param {Object} [config]
	 * @returns {GraphOrchestratorBuilder}
	 */
	connect(from: string, to: string, config?: any): GraphOrchestratorBuilder;
	/**
	 * Sets entry nodes.
	 * @param {...string} nodeIds
	 * @returns {GraphOrchestratorBuilder}
	 */
	entry(...nodeIds: string[]): GraphOrchestratorBuilder;
	/**
	 * Sets exit nodes.
	 * @param {...string} nodeIds
	 * @returns {GraphOrchestratorBuilder}
	 */
	exit(...nodeIds: string[]): GraphOrchestratorBuilder;
	/**
	 * Finalizes the builder and returns a GraphOrchestrator.
	 * @returns {GraphOrchestrator}
	 */
	build(): GraphOrchestrator;
	#private;
}
import { Runnable } from "./runnable.js";
import { RunnableGraph } from "./graph.js";
