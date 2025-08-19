import {BaseYieldType, LogEvent} from "./events.js";
import {RunnableGraph, RunnableGraphOptions} from "./graph.js";
import {Runnable, RunnableOptions} from "./runnable.js";

/**
 * Runnable orchestrator that executes a RunnableGraph and can
 * dynamically add nodes after each run based on persisted results.
 * Completed nodes are not rerun thanks to the graph's persistence layer.
 */
export class GraphOrchestrator extends Runnable {
  /**
   * The graph being orchestrated
   */
  graph: RunnableGraph;

  /**
   * Persistence state to track completed nodes
   */
  persistence: Record<string, any>;

  /**
   */
  constructor(
    graph: RunnableGraph = new RunnableGraph(),
    options: RunnableOptions = {}
  ) {
    super(options);
    this.graph = graph;
    this.persistence = {};
  }

  /**
   * Returns a builder for fluently creating an orchestrator with an
   * initial graph definition.
   */
  static builder(options?: RunnableGraphOptions): GraphOrchestratorBuilder {
    return new GraphOrchestratorBuilder(options);
  }

  /**
   * Hook that allows subclasses to modify the graph between runs.
   * Return `true` if the graph was changed and should be executed again.
   *
   */
  async updateGraph({
                      graph,
                      persistence,
                      input,
                      output,
                      context,
                    }: {
    graph: RunnableGraph;
    persistence: any;
    input: any;
    output: any;
    context: any;
  }): Promise<boolean> {
    return false;
  }

  /**
   * Runs the orchestrator until `updateGraph` returns false.
   */
  async* invoke(
    input: any,
    context: any = {}
  ): AsyncGenerator<BaseYieldType, any, void> {
    const persistence = context.persistence || this.persistence;
    context = {...context, persistence};
    let output;
    let changed = true;

    while (changed) {
      const gen = this.graph.invoke(input, context);
      let done = false;
      while (!done) {
        const {value, done: isDone} = await gen.next();
        done = !!isDone;
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
}

/**
 * Builder class mirroring RunnableGraphBuilder but producing a
 * GraphOrchestrator instance from `build()`.
 */
export class GraphOrchestratorBuilder {
  /**
   * The underlying graph being built
   */
  readonly #graph: RunnableGraph;

  /**
   */
  constructor(options?: RunnableGraphOptions) {
    this.#graph = new RunnableGraph(options);
  }

  /**
   * Adds a node to the graph.
   */
  node(
    id: string,
    runnable: Runnable,
    config?: Record<string, any>
  ): GraphOrchestratorBuilder {
    this.#graph.addNode(id, runnable, config);
    return this;
  }

  /**
   * Connects two nodes in the graph.
   */
  connect(
    from: string,
    to: string,
    config?: Record<string, any>
  ): GraphOrchestratorBuilder {
    this.#graph.connect(from, to, config);
    return this;
  }

  /**
   * Sets entry nodes.
   */
  entry(...nodeIds: string[]): GraphOrchestratorBuilder {
    this.#graph.setEntryNodes(...nodeIds);
    return this;
  }

  /**
   * Sets exit nodes.
   */
  exit(...nodeIds: string[]): GraphOrchestratorBuilder {
    this.#graph.setExitNodes(...nodeIds);
    return this;
  }

  /**
   * Finalizes the builder and returns a GraphOrchestrator.
   */
  build(): GraphOrchestrator {
    return new GraphOrchestrator(this.#graph);
  }
}