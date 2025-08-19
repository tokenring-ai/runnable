import {RunnableGraph, RunnableGraphOptions} from "./graph.js";
import {Runnable} from "./runnable.js";

/**
 * Builder class for constructing RunnableGraph instances with a fluent API.
 */
export class RunnableGraphBuilder {
  /**
   * The graph being built
   */
  readonly #graph: RunnableGraph;

  /**
   * Creates a new builder instance.
   */
  constructor(options?: RunnableGraphOptions) {
    this.#graph = new RunnableGraph(options);
  }

  /**
   * Adds a node to the graph.
   */
  node(id: string, runnable: Runnable, config?: any): RunnableGraphBuilder {
    this.#graph.addNode(id, runnable, config);
    return this;
  }

  /**
   * Connects two nodes.
   */
  connect(from: string, to: string, config?: any): RunnableGraphBuilder {
    this.#graph.connect(from, to, config);
    return this;
  }

  /**
   * Sets entry nodes.
   */
  entry(...nodeIds: string[]): RunnableGraphBuilder {
    this.#graph.setEntryNodes(...nodeIds);
    return this;
  }

  /**
   * Sets exit nodes.
   */
  exit(...nodeIds: string[]): RunnableGraphBuilder {
    this.#graph.setExitNodes(...nodeIds);
    return this;
  }

  /**
   * Builds and returns the configured graph.
   */
  build(): RunnableGraph {
    return this.#graph;
  }
}