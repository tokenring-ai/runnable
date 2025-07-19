/**
 * @file core/runnable/graph.js
 * @description Implements a graph-based runnable that can orchestrate multiple interconnected runnables.
 */

import { Runnable } from "./runnable.js";
import {
	validateSchemaExists,
	validateZodTypeCompatibility,
} from "./schema-validator.js";
import { RunnableGraphBuilder } from "./graphBuilder.js";

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
export class RunnableGraph extends Runnable {
	/**
	 * @type {Map<string, GraphNode>}
	 */
	#nodes = new Map();

	/**
	 * @type {GraphEdge[]}
	 */
	#edges = [];

	/**
	 * @type {string[]}
	 */
	#entryNodes = [];

	/**
	 * @type {string[]}
	 */
	#exitNodes = [];

	/**
	 * @type {RunnableGraphOptions}
	 */
	#options;

	/**
	 * Creates a new RunnableGraph instance.
	 * @param {RunnableGraphOptions} [options={}] - Configuration options
	 */
	constructor(options = {}) {
		super(options);
		this.#options = {
			parallel: true,
			maxConcurrency: 10,
			continueOnError: false,
			...options,
		};
	}

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
	addNode(id, runnable, config = {}) {
		if (this.#nodes.has(id)) {
			throw new Error(`Node with id '${id}' already exists`);
		}

		if (!(runnable instanceof Runnable)) {
			throw new Error(`Node '${id}' must be a Runnable instance`);
		}

		const node = {
			id,
			runnable,
			inputs: config.inputs || [],
			outputs: config.outputs || [],
			inputMappings: {},
			optional: config.optional || false,
		};

		this.#nodes.set(id, node);
		return this;
	}

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
	connect(fromNodeId, toNodeId, config = {}) {
		if (!this.#nodes.has(fromNodeId)) {
			throw new Error(`Source node '${fromNodeId}' does not exist`);
		}
		if (!this.#nodes.has(toNodeId)) {
			throw new Error(`Target node '${toNodeId}' does not exist`);
		}

		const fromOutput = config.fromOutput || "output";
		const toInput = config.toInput || "input";

		// Add edge
		this.#edges.push({
			from: fromNodeId,
			to: toNodeId,
			fromOutput,
			toInput,
			transform: config.transform,
		});

		// Update target node's input mappings
		const targetNode = this.#nodes.get(toNodeId);
		targetNode.inputMappings[toInput] = `${fromNodeId}.${fromOutput}`;

		// Validate schema compatibility for this connection immediately
		this.#validateConnectionSchema(fromNodeId, toNodeId, fromOutput, toInput);

		return this;
	}

	/**
	 * Sets the entry nodes for the graph (nodes that receive the initial input).
	 * @param {...string} nodeIds - Node IDs that should receive the graph input
	 * @returns {RunnableGraph} This instance for chaining
	 */
	setEntryNodes(...nodeIds) {
		for (const nodeId of nodeIds) {
			if (!this.#nodes.has(nodeId)) {
				throw new Error(`Entry node '${nodeId}' does not exist`);
			}
		}
		this.#entryNodes = nodeIds;

		// Validate all existing connections when entry nodes are set
		this.#validateAllSchemas();

		return this;
	}

	/**
	 * Sets the exit nodes for the graph (nodes whose outputs form the final result).
	 * @param {...string} nodeIds - Node IDs whose outputs should be included in the final result
	 * @returns {RunnableGraph} This instance for chaining
	 */
	setExitNodes(...nodeIds) {
		for (const nodeId of nodeIds) {
			if (!this.#nodes.has(nodeId)) {
				throw new Error(`Exit node '${nodeId}' does not exist`);
			}
		}
		this.#exitNodes = nodeIds;

		// Validate all existing connections when exit nodes are set
		this.#validateAllSchemas();

		return this;
	}

	/**
	 * Validates the graph structure.
	 * @throws {Error} If the graph is invalid
	 */
	#validateGraph() {
		if (this.#nodes.size === 0) {
			throw new Error("Graph must contain at least one node");
		}

		if (this.#entryNodes.length === 0) {
			throw new Error("Graph must have at least one entry node");
		}

		if (this.#exitNodes.length === 0) {
			throw new Error("Graph must have at least one exit node");
		}

		// Check for cycles (simplified check)
		const visited = new Set();
		const recursionStack = new Set();

		const hasCycle = (nodeId) => {
			if (recursionStack.has(nodeId)) return true;
			if (visited.has(nodeId)) return false;

			visited.add(nodeId);
			recursionStack.add(nodeId);

			const outgoingEdges = this.#edges.filter((edge) => edge.from === nodeId);
			for (const edge of outgoingEdges) {
				if (hasCycle(edge.to)) return true;
			}

			recursionStack.delete(nodeId);
			return false;
		};

		for (const nodeId of this.#nodes.keys()) {
			if (hasCycle(nodeId)) {
				throw new Error("Graph contains cycles");
			}
		}

		// Schema validation is now done during graph construction (connect, setEntryNodes, setExitNodes)
		// so we don't need to validate schemas here during invoke
	}

	/**
	 * Validates schema compatibility for a specific connection.
	 * @param {string} fromNodeId - Source node ID
	 * @param {string} toNodeId - Target node ID
	 * @param {string} fromOutput - Output key from source node
	 * @param {string} toInput - Input key for target node
	 * @throws {Error} If there are schema compatibility errors
	 */
	#validateConnectionSchema(fromNodeId, toNodeId, fromOutput, toInput) {
		const fromNode = this.#nodes.get(fromNodeId);
		const toNode = this.#nodes.get(toNodeId);

		if (!fromNode || !toNode) {
			return; // Nodes don't exist, this should be caught elsewhere
		}

		const fromSchema = fromNode.runnable.outputSchema;
		const toSchema = toNode.runnable.inputSchema;

		// Skip validation if either schema is missing (warnings will be handled in #validateAllSchemas)
		if (!fromSchema || !toSchema) {
			return;
		}

		// For multi-output nodes, we need to check the specific output key
		let actualFromSchema = fromSchema;
		if (fromOutput !== "output" && fromNode.outputs.length > 1) {
			// For multi-output nodes, we would need to extract the specific output schema
			// This is a limitation - we can't easily validate specific output keys without
			// more sophisticated schema introspection
			console.warn("Graph schema validation warnings:");
			console.warn(
				`  - Cannot validate specific output '${fromOutput}' from multi-output node '${fromNodeId}' - using full output schema`,
			);
			return; // Skip validation for multi-output nodes
		}

		const compatibilityResult = validateZodTypeCompatibility(
			actualFromSchema,
			toSchema,
		);

		// Log warnings if any (but don't throw)
		if (compatibilityResult.warnings.length > 0) {
			console.warn("Graph schema validation warnings:");
			compatibilityResult.warnings.forEach((warning) =>
				console.warn(
					`  - Connection '${fromNodeId}' → '${toNodeId}': ${warning}`,
				),
			);
		}

		// Only throw for hard incompatibilities
		if (!compatibilityResult.compatible) {
			const errorMessage = `Schema incompatibility between '${fromNodeId}' (output) and '${toNodeId}' (input): ${compatibilityResult.errors.join(", ")}`;
			throw new Error(errorMessage);
		}
	}

	/**
	 * Validates all schemas in the graph.
	 * @throws {Error} If there are schema compatibility errors
	 */
	#validateAllSchemas() {
		const warnings = [];
		const errors = [];

		// Check each node for schema presence
		for (const [nodeId, node] of this.#nodes) {
			const inputResult = validateSchemaExists(
				node.runnable.inputSchema,
				`Node '${nodeId}' input`,
			);
			const outputResult = validateSchemaExists(
				node.runnable.outputSchema,
				`Node '${nodeId}' output`,
			);

			warnings.push(...inputResult.warnings);
			warnings.push(...outputResult.warnings);
			errors.push(...inputResult.errors);
			errors.push(...outputResult.errors);
		}

		// Check schema compatibility for each edge
		for (const edge of this.#edges) {
			const fromNode = this.#nodes.get(edge.from);
			const toNode = this.#nodes.get(edge.to);

			if (!fromNode || !toNode) {
				continue; // This should be caught by earlier validation
			}

			const fromSchema = fromNode.runnable.outputSchema;
			const toSchema = toNode.runnable.inputSchema;

			// Skip validation if either schema is missing (warnings already added above)
			if (!fromSchema || !toSchema) {
				continue;
			}

			// For multi-output nodes, we need to check the specific output key
			let actualFromSchema = fromSchema;
			if (edge.fromOutput !== "output" && fromNode.outputs.length > 1) {
				// For multi-output nodes, we would need to extract the specific output schema
				// This is a limitation - we can't easily validate specific output keys without
				// more sophisticated schema introspection
				warnings.push(
					`Cannot validate specific output '${edge.fromOutput}' from multi-output node '${edge.from}' - using full output schema`,
				);
				continue; // Skip validation for multi-output nodes
			}

			const compatibilityResult = validateZodTypeCompatibility(
				actualFromSchema,
				toSchema,
			);

			// Add context to warnings
			warnings.push(
				...compatibilityResult.warnings.map(
					(w) => `Connection '${edge.from}' → '${edge.to}': ${w}`,
				),
			);

			// Only add to errors if actually incompatible
			if (!compatibilityResult.compatible) {
				errors.push(
					`Schema incompatibility between '${edge.from}' (output) and '${edge.to}' (input): ${compatibilityResult.errors.join(", ")}`,
				);
			}
		}

		// Log warnings
		if (warnings.length > 0) {
			console.warn("Graph schema validation warnings:");
			warnings.forEach((warning) => console.warn(`  - ${warning}`));
		}

		// Throw error if there are compatibility issues
		if (errors.length > 0) {
			const errorMessage =
				"Graph schema validation failed:\n" +
				errors.map((error) => `  - ${error}`).join("\n");
			throw new Error(errorMessage);
		}
	}

	/**
	 * Determines which nodes are ready to execute based on their dependencies.
	 * @param {GraphExecutionContext} context - Current execution context
	 * @returns {string[]} Array of node IDs ready for execution
	 */
	#getReadyNodes(context) {
		const readyNodes = [];

		for (const [nodeId, node] of this.#nodes) {
			// Skip if already completed or failed
			if (
				context.completedNodes.has(nodeId) ||
				context.failedNodes.has(nodeId)
			) {
				continue;
			}

			// Entry nodes are ready if they haven't been executed yet
			if (this.#entryNodes.includes(nodeId)) {
				readyNodes.push(nodeId);
				continue;
			}

			// For non-entry nodes, check if all required inputs are available
			let allInputsReady = true;

			// If the node has input mappings, check if all source nodes are completed
			for (const inputKey of node.inputs) {
				const mapping = node.inputMappings[inputKey];
				if (mapping) {
					const [sourceNodeId, sourceOutputKey] = mapping.split(".");
					if (!context.completedNodes.has(sourceNodeId)) {
						allInputsReady = false;
						break;
					}
				}
			}

			// If the node has no input mappings but has inputs defined,
			// it might be waiting for connections that don't exist
			if (node.inputs.length > 0) {
				let hasAnyMappings = false;
				for (const inputKey of node.inputs) {
					if (node.inputMappings[inputKey]) {
						hasAnyMappings = true;
						break;
					}
				}
				// If no mappings exist for a node with inputs, it's not ready
				if (!hasAnyMappings) {
					allInputsReady = false;
				}
			}

			if (allInputsReady) {
				readyNodes.push(nodeId);
			}
		}

		return readyNodes;
	}

	/**
	 * Prepares input data for a node based on its input mappings.
	 * @param {GraphNode} node - The node to prepare input for
	 * @param {GraphExecutionContext} context - Current execution context
	 * @returns {any} Prepared input data
	 */
	#prepareNodeInput(node, context) {
		if (this.#entryNodes.includes(node.id)) {
			// Entry nodes receive the graph input
			return context.graphInput;
		}

		if (node.inputs.length === 0) {
			return undefined;
		}

		if (node.inputs.length === 1) {
			// Single input - return the mapped value directly
			const inputKey = node.inputs[0];
			const mapping = node.inputMappings[inputKey];
			if (mapping) {
				const [sourceNodeId, sourceOutputKey] = mapping.split(".");
				const sourceResult = context.nodeResults.get(sourceNodeId);
				return sourceOutputKey === "output"
					? sourceResult
					: context.nodeOutputs.get(`${sourceNodeId}.${sourceOutputKey}`);
			}
			return undefined;
		}

		// Multiple inputs - return an object with all mapped values
		const inputData = {};
		for (const inputKey of node.inputs) {
			const mapping = node.inputMappings[inputKey];
			if (mapping) {
				const [sourceNodeId, sourceOutputKey] = mapping.split(".");
				const sourceResult = context.nodeResults.get(sourceNodeId);
				inputData[inputKey] =
					sourceOutputKey === "output"
						? sourceResult
						: context.nodeOutputs.get(`${sourceNodeId}.${sourceOutputKey}`);
			}
		}
		return inputData;
	}

	/**
	 * Executes a single node.
	 * @param {string} nodeId - ID of the node to execute
	 * @param {GraphExecutionContext} context - Current execution context
	 * @returns {AsyncGenerator<any, any, void>} Generator yielding events and returning result
	 */
	async *#executeNode(nodeId, context) {
		const node = this.#nodes.get(nodeId);
		const input = this.#prepareNodeInput(node, context);

		yield {
			type: "log",
			level: "info",
			message: `Starting execution of node '${nodeId}'`,
			timestamp: Date.now(),
			runnableName: this.name,
			nodeId,
		};

		try {
			const nodeGenerator = node.runnable.invoke(input, context.graphContext);
			let result;

			// Forward all events from the node and collect the final result
			let done = false;
			while (!done) {
				const { value, done: isDone } = await nodeGenerator.next();
				done = isDone;

				if (!done) {
					// This is a yielded event
					const enhancedEvent = {
						...value,
						nodeId,
						graphName: this.name,
					};
					yield enhancedEvent;
				} else {
					// This is the final return value
					result = value;
				}
			}

			// Store results
			context.nodeResults.set(nodeId, result);
			context.completedNodes.add(nodeId);

			context.persistence.nodeResults[nodeId] = result;
			context.persistence.completedNodes = Array.from(context.completedNodes);

			// Handle multi-output nodes
			if (node.outputs.length > 1 && result && typeof result === "object") {
				for (const outputKey of node.outputs) {
					if (result[outputKey] !== undefined) {
						context.nodeOutputs.set(
							`${nodeId}.${outputKey}`,
							result[outputKey],
						);
						context.persistence.nodeOutputs[`${nodeId}.${outputKey}`] =
							result[outputKey];
					}
				}
			}

			yield {
				type: "log",
				level: "info",
				message: `Completed execution of node '${nodeId}'`,
				timestamp: Date.now(),
				runnableName: this.name,
				nodeId,
				result,
			};

			return result;
		} catch (error) {
			context.failedNodes.add(nodeId);
			context.nodeErrors.set(nodeId, error);
			context.persistence.failedNodes = Array.from(context.failedNodes);
			context.persistence.nodeErrors[nodeId] = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			};

			yield {
				type: "error_event",
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
				timestamp: Date.now(),
				runnableName: this.name,
				nodeId,
			};

			if (!node.optional && !this.#options.continueOnError) {
				throw error;
			}

			return null;
		}
	}

	/**
	 * Builds the final output from exit nodes.
	 * @param {GraphExecutionContext} context - Current execution context
	 * @returns {any} Final graph output
	 */
	#buildOutput(context) {
		if (this.#exitNodes.length === 1) {
			// Single exit node - return its result directly
			const exitNodeId = this.#exitNodes[0];
			return context.nodeResults.get(exitNodeId);
		}

		// Multiple exit nodes - return an object with all results
		const output = {};
		for (const exitNodeId of this.#exitNodes) {
			output[exitNodeId] = context.nodeResults.get(exitNodeId);
		}
		return output;
	}

	/**
	 * Executes the graph of runnables.
	 * @param {InputType} input - Input data for the graph
	 * @param {ContextType} [context] - Optional context object
	 * @returns {AsyncGenerator<YieldType, OutputType, void>} Async generator yielding events and returning final output
	 */
	async *invoke(input, context = {}) {
		this.#validateGraph();

		const persistence = context.persistence || {};

		persistence.nodeResults ||= {};
		persistence.nodeOutputs ||= {};
		persistence.nodeErrors ||= {};
		persistence.completedNodes ||= [];
		persistence.failedNodes ||= [];

		const executionContext = {
			nodeResults: new Map(Object.entries(persistence.nodeResults)),
			nodeOutputs: new Map(Object.entries(persistence.nodeOutputs)),
			completedNodes: new Set(persistence.completedNodes),
			failedNodes: new Set(persistence.failedNodes),
			nodeErrors: new Map(Object.entries(persistence.nodeErrors)),
			graphInput: input,
			graphContext: { ...context, persistence: undefined },
			persistence,
		};

		yield {
			type: "log",
			level: "info",
			message: `Starting graph execution: ${this.name || "Unnamed Graph"}`,
			timestamp: Date.now(),
			runnableName: this.name,
		};

		try {
			// Execute nodes until all are complete or we can't proceed
			while (
				executionContext.completedNodes.size +
					executionContext.failedNodes.size <
				this.#nodes.size
			) {
				// Check for abort signal
				if (this.abortSignal.aborted) {
					throw new Error("Graph execution aborted");
				}

				const readyNodes = this.#getReadyNodes(executionContext);

				if (readyNodes.length === 0) {
					// Check if we're stuck due to failed dependencies
					const remainingNodes = Array.from(this.#nodes.keys()).filter(
						(nodeId) =>
							!executionContext.completedNodes.has(nodeId) &&
							!executionContext.failedNodes.has(nodeId),
					);

					if (remainingNodes.length > 0) {
						const details = remainingNodes.map((nodeId) => {
							const node = this.#nodes.get(nodeId);
							const missing = [];
							for (const inputKey of node.inputs) {
								const mapping = node.inputMappings[inputKey];
								if (!mapping) {
									missing.push(`${inputKey} (unmapped)`);
								} else {
									const [sourceNodeId] = mapping.split(".");
									if (!executionContext.completedNodes.has(sourceNodeId)) {
										missing.push(`${inputKey} from ${sourceNodeId}`);
									}
								}
							}
							return missing.length > 0
								? `${nodeId} waiting for ${missing.join(", ")}`
								: nodeId;
						});
						const errorMsg = `Graph execution stuck. Remaining nodes: ${details.join("; ")}`;
						yield {
							type: "error_event",
							error: {
								name: "GraphExecutionError",
								message: errorMsg,
							},
							timestamp: Date.now(),
							runnableName: this.name,
						};
						throw new Error(errorMsg);
					}
					break;
				}

				if (this.#options.parallel && readyNodes.length > 1) {
					// Execute ready nodes in parallel
					const concurrency = Math.min(
						readyNodes.length,
						this.#options.maxConcurrency,
					);
					const nodePromises = readyNodes
						.slice(0, concurrency)
						.map(async (nodeId) => {
							const events = [];
							const nodeGenerator = this.#executeNode(nodeId, executionContext);

							try {
								let done = false;
								while (!done) {
									const { value, done: isDone } = await nodeGenerator.next();
									done = isDone;

									if (!done) {
										events.push(value);
									}
								}
								return { nodeId, events, success: true };
							} catch (error) {
								return { nodeId, events, success: false, error };
							}
						});

					// Wait for all parallel nodes to complete and yield their events
					const results = await Promise.allSettled(nodePromises);
					for (const result of results) {
						if (result.status === "fulfilled") {
							for (const event of result.value.events) {
								yield event;
							}
							if (!result.value.success && result.value.error) {
								throw result.value.error;
							}
						} else {
							yield {
								type: "error_event",
								error: {
									name: result.reason.name,
									message: result.reason.message,
									stack: result.reason.stack,
								},
								timestamp: Date.now(),
								runnableName: this.name,
							};
							throw result.reason;
						}
					}
				} else {
					// Execute nodes sequentially
					for (const nodeId of readyNodes) {
						if (this.abortSignal.aborted) {
							throw new Error("Graph execution aborted");
						}

						const nodeGenerator = this.#executeNode(nodeId, executionContext);
						let done = false;
						while (!done) {
							const { value, done: isDone } = await nodeGenerator.next();
							done = isDone;

							if (!done) {
								yield value;
							}
						}
					}
				}
			}

			const output = this.#buildOutput(executionContext);

			executionContext.persistence.completedNodes = Array.from(
				executionContext.completedNodes,
			);
			executionContext.persistence.failedNodes = Array.from(
				executionContext.failedNodes,
			);
			executionContext.persistence.nodeResults = Object.fromEntries(
				executionContext.nodeResults,
			);
			executionContext.persistence.nodeOutputs = Object.fromEntries(
				executionContext.nodeOutputs,
			);
			executionContext.persistence.nodeErrors = Object.fromEntries(
				executionContext.nodeErrors,
			);

			yield {
				type: "log",
				level: "info",
				message: `Graph execution completed: ${this.name || "Unnamed Graph"}`,
				timestamp: Date.now(),
				runnableName: this.name,
				completedNodes: Array.from(executionContext.completedNodes),
				failedNodes: Array.from(executionContext.failedNodes),
			};

			return output;
		} catch (error) {
			yield {
				type: "error_event",
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
				timestamp: Date.now(),
				runnableName: this.name,
			};
			executionContext.persistence.completedNodes = Array.from(
				executionContext.completedNodes,
			);
			executionContext.persistence.failedNodes = Array.from(
				executionContext.failedNodes,
			);
			executionContext.persistence.nodeResults = Object.fromEntries(
				executionContext.nodeResults,
			);
			executionContext.persistence.nodeOutputs = Object.fromEntries(
				executionContext.nodeOutputs,
			);
			executionContext.persistence.nodeErrors = Object.fromEntries(
				executionContext.nodeErrors,
			);
			throw error;
		}
	}

	/**
	 * Returns a plain object describing the graph structure using only public data.
	 * @returns {{nodes: string[], connections: object[], entryNodes: string[], exitNodes: string[], options: RunnableGraphOptions}}
	 */
	describe() {
		return {
			nodes: Array.from(this.#nodes.keys()),
			connections: this.#edges.map(({ from, to, fromOutput, toInput }) => ({
				from,
				to,
				fromOutput,
				toInput,
			})),
			entryNodes: [...this.#entryNodes],
			exitNodes: [...this.#exitNodes],
			options: { ...this.#options },
		};
	}

	/**
	 * Creates a builder for constructing graphs fluently.
	 * @param {RunnableGraphOptions} [options] - Graph options
	 * @returns {RunnableGraphBuilder} A builder instance
	 */
	static builder(options) {
		return new RunnableGraphBuilder(options);
	}
}
