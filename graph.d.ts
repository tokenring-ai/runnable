/**
 * @typedef {Object} GraphNode
 * @property {string} id - Unique identifier for the node
 * @property {Runnable} runnable - The runnable instance for this node
 * @property {string[]} inputs - Array of input keys this node expects
 * @property {string[]} outputs - Array of output keys this node produces
 * @property {Object.<string, string>} inputMappings - Maps input keys to source node outputs (nodeId.outputKey)
 * @property {boolean} [optional] - Whether this node is optional (won't block execution if it fails)
 */
/**
 * @typedef {Object} GraphEdge
 * @property {string} from - Source node ID
 * @property {string} to - Target node ID
 * @property {string} fromOutput - Output key from source node
 * @property {string} toInput - Input key for target node
 * @property {Function} [transform] - Optional transformation function for the data
 */
/**
 * @typedef {Object} GraphPersistence
 * @property {Object.<string, any>} [nodeResults] - Persisted results of completed nodes
 * @property {Object.<string, any>} [nodeOutputs] - Persisted named outputs from nodes
 * @property {Object.<string, {name:string,message:string,stack?:string}>} [nodeErrors] - Persisted errors for failed nodes
 * @property {string[]} [completedNodes] - IDs of completed nodes
 * @property {string[]} [failedNodes] - IDs of failed nodes
 */
/**
 * @typedef {Object} GraphExecutionContext
 * @property {Map<string, any>} nodeResults - Results from completed nodes
 * @property {Map<string, any>} nodeOutputs - Specific outputs from nodes (for multi-output nodes)
 * @property {Set<string>} completedNodes - Set of completed node IDs
 * @property {Set<string>} failedNodes - Set of failed node IDs
 * @property {Map<string, Error>} nodeErrors - Errors from failed nodes
 * @property {any} graphInput - The original input to the graph
 * @property {any} graphContext - The original context passed to the graph
 * @property {GraphPersistence} persistence - Reference to the persistence object used for resume
 */
/**
 * @typedef {Object} RunnableGraphOptions
 * @property {string} [name] - Name for the graph runnable
 * @property {AbortController} [abortController] - Abort controller for cancellation
 * @property {boolean} [parallel] - Whether to execute independent nodes in parallel
 * @property {number} [maxConcurrency] - Maximum number of nodes to execute concurrently
 * @property {boolean} [continueOnError] - Whether to continue execution when optional nodes fail
 */
/**
 * A runnable that orchestrates a graph of interconnected runnables.
 * Supports complex data flows including fan-out, fan-in, and conditional execution.
 *
 * @template InputType - The type of input data for the graph
 * @template OutputType - The type of final output from the graph
 * @template YieldType - The type of events yielded during execution
 * @template ContextType - The type of context object
 */
export class RunnableGraph<
	InputType,
	OutputType,
	YieldType,
	ContextType,
> extends Runnable<any, any, any, any> {
	/**
	 * Creates a builder for constructing graphs fluently.
	 * @param {RunnableGraphOptions} [options] - Graph options
	 * @returns {RunnableGraphBuilder} A builder instance
	 */
	static builder(options?: RunnableGraphOptions): RunnableGraphBuilder;
	/**
	 * Creates a new RunnableGraph instance.
	 * @param {RunnableGraphOptions} [options={}] - Configuration options
	 */
	constructor(options?: RunnableGraphOptions);
	/**
	 * Adds a node to the graph.
	 * @param {string} id - Unique identifier for the node
	 * @param {Runnable} runnable - The runnable instance
	 * @param {Object} [config={}] - Node configuration
	 * @param {string[]} [config.inputs=[]] - Input keys this node expects
	 * @param {string[]} [config.outputs=[]] - Output keys this node produces
	 * @param {boolean} [config.optional=false] - Whether this node is optional
	 * @returns {RunnableGraph} This instance for chaining
	 */
	addNode(
		id: string,
		runnable: Runnable<any, any, any, any>,
		config?: {
			inputs?: string[];
			outputs?: string[];
			optional?: boolean;
		},
	): RunnableGraph<any, any, any, any>;
	/**
	 * Connects two nodes in the graph.
	 * @param {string} fromNodeId - Source node ID
	 * @param {string} toNodeId - Target node ID
	 * @param {Object} [config={}] - Connection configuration
	 * @param {string} [config.fromOutput='output'] - Output key from source node
	 * @param {string} [config.toInput='input'] - Input key for target node
	 * @param {Function} [config.transform] - Optional data transformation function
	 * @returns {RunnableGraph} This instance for chaining
	 */
	connect(
		fromNodeId: string,
		toNodeId: string,
		config?: {
			fromOutput?: string;
			toInput?: string;
			transform?: Function;
		},
	): RunnableGraph<any, any, any, any>;
	/**
	 * Sets the entry nodes for the graph (nodes that receive the initial input).
	 * @param {...string} nodeIds - Node IDs that should receive the graph input
	 * @returns {RunnableGraph} This instance for chaining
	 */
	setEntryNodes(...nodeIds: string[]): RunnableGraph<any, any, any, any>;
	/**
	 * Sets the exit nodes for the graph (nodes whose outputs form the final result).
	 * @param {...string} nodeIds - Node IDs whose outputs should be included in the final result
	 * @returns {RunnableGraph} This instance for chaining
	 */
	setExitNodes(...nodeIds: string[]): RunnableGraph<any, any, any, any>;
	/**
	 * Executes the graph of runnables.
	 * @param {InputType} input - Input data for the graph
	 * @param {ContextType} [context] - Optional context object
	 * @returns {AsyncGenerator<YieldType, OutputType, void>} Async generator yielding events and returning final output
	 */
	invoke(
		input: InputType,
		context?: ContextType,
	): AsyncGenerator<YieldType, OutputType, void>;
	/**
	 * Returns a plain object describing the graph structure using only public data.
	 * @returns {{nodes: string[], connections: object[], entryNodes: string[], exitNodes: string[], options: RunnableGraphOptions}}
	 */
	describe(): {
		nodes: string[];
		connections: object[];
		entryNodes: string[];
		exitNodes: string[];
		options: RunnableGraphOptions;
	};
	#private;
}
export type GraphNode = {
	/**
	 * - Unique identifier for the node
	 */
	id: string;
	/**
	 * - The runnable instance for this node
	 */
	runnable: Runnable<any, any, any, any>;
	/**
	 * - Array of input keys this node expects
	 */
	inputs: string[];
	/**
	 * - Array of output keys this node produces
	 */
	outputs: string[];
	/**
	 * - Maps input keys to source node outputs (nodeId.outputKey)
	 */
	inputMappings: {
		[x: string]: string;
	};
	/**
	 * - Whether this node is optional (won't block execution if it fails)
	 */
	optional?: boolean;
};
export type GraphEdge = {
	/**
	 * - Source node ID
	 */
	from: string;
	/**
	 * - Target node ID
	 */
	to: string;
	/**
	 * - Output key from source node
	 */
	fromOutput: string;
	/**
	 * - Input key for target node
	 */
	toInput: string;
	/**
	 * - Optional transformation function for the data
	 */
	transform?: Function;
};
export type GraphPersistence = {
	/**
	 * - Persisted results of completed nodes
	 */
	nodeResults?: {
		[x: string]: any;
	};
	/**
	 * - Persisted named outputs from nodes
	 */
	nodeOutputs?: {
		[x: string]: any;
	};
	/**
	 * - Persisted errors for failed nodes
	 */
	nodeErrors?: {
		[x: string]: {
			name: string;
			message: string;
			stack?: string;
		};
	};
	/**
	 * - IDs of completed nodes
	 */
	completedNodes?: string[];
	/**
	 * - IDs of failed nodes
	 */
	failedNodes?: string[];
};
export type GraphExecutionContext = {
	/**
	 * - Results from completed nodes
	 */
	nodeResults: Map<string, any>;
	/**
	 * - Specific outputs from nodes (for multi-output nodes)
	 */
	nodeOutputs: Map<string, any>;
	/**
	 * - Set of completed node IDs
	 */
	completedNodes: Set<string>;
	/**
	 * - Set of failed node IDs
	 */
	failedNodes: Set<string>;
	/**
	 * - Errors from failed nodes
	 */
	nodeErrors: Map<string, Error>;
	/**
	 * - The original input to the graph
	 */
	graphInput: any;
	/**
	 * - The original context passed to the graph
	 */
	graphContext: any;
	/**
	 * - Reference to the persistence object used for resume
	 */
	persistence: GraphPersistence;
};
export type RunnableGraphOptions = {
	/**
	 * - Name for the graph runnable
	 */
	name?: string;
	/**
	 * - Abort controller for cancellation
	 */
	abortController?: AbortController;
	/**
	 * - Whether to execute independent nodes in parallel
	 */
	parallel?: boolean;
	/**
	 * - Maximum number of nodes to execute concurrently
	 */
	maxConcurrency?: number;
	/**
	 * - Whether to continue execution when optional nodes fail
	 */
	continueOnError?: boolean;
};
import { Runnable } from "./runnable.js";
import { RunnableGraphBuilder } from "./graphBuilder.js";
