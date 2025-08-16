import {RunnableGraph, RunnableGraphOptions} from "./graph.js";
import {Runnable} from "./runnable.js";

/**
 * Builder class for constructing RunnableGraph instances with a fluent API.
 */
export class RunnableGraphBuilder {
  /**
   * The graph being built
   */
  private readonly #graph: RunnableGraph;

  /**
   * Creates a new builder instance.
   * @param options - Graph options
   */
  constructor(options?: RunnableGraphOptions) {
    this.#graph = new RunnableGraph(options);
  }

  /**
   * Adds a node to the graph.
   * @param id - Node ID
   * @param runnable - Runnable instance
   * @param config - Node configuration
   * @returns This builder for chaining
   */
  node(id: string, runnable: Runnable, config?: any): RunnableGraphBuilder {
    this.#graph.addNode(id, runnable, config);
    return this;
  }

  /**
   * Connects two nodes.
   * @param from - Source node ID
   * @param to - Target node ID
   * @param config - Connection configuration
   * @returns This builder for chaining
   */
  connect(from: string, to: string, config?: any): RunnableGraphBuilder {
    this.#graph.connect(from, to, config);
    return this;
  }

  /**
   * Sets entry nodes.
   * @param nodeIds - Entry node IDs
   * @returns This builder for chaining
   */
  entry(...nodeIds: string[]): RunnableGraphBuilder {
    this.#graph.setEntryNodes(...nodeIds);
    return this;
  }

  /**
   * Sets exit nodes.
   * @param nodeIds - Exit node IDs
   * @returns This builder for chaining
   */
  exit(...nodeIds: string[]): RunnableGraphBuilder {
    this.#graph.setExitNodes(...nodeIds);
    return this;
  }

  /**
   * Builds and returns the configured graph.
   * @returns The constructed graph
   */
  build(): RunnableGraph {
    return this.#graph;
  }
}