import { Runnable, RunnableOptions } from "./runnable.js";
import { RunnableGraph, RunnableGraphOptions } from "./graph.js";
import { LogEvent, BaseYieldType } from "./events.js";

/**
 * Runnable orchestrator that executes a RunnableGraph and can
 * dynamically add nodes after each run based on persisted results.
 * Completed nodes are not rerun thanks to the graph's persistence layer.
 */
export class GraphOrchestrator extends Runnable<any, any, any, any> {
    /**
     * The graph being orchestrated
     */
    graph: RunnableGraph<any, any, any, any>;
    
    /**
     * Persistence state to track completed nodes
     */
    persistence: Record<string, any>;

    /**
     * @param graph - The graph to orchestrate
     * @param options - Options for the runnable
     */
    constructor(
        graph: RunnableGraph<any, any, any, any> = new RunnableGraph(), 
        options: RunnableOptions = {}
    ) {
        super(options);
        this.graph = graph;
        this.persistence = {};
    }

    /**
     * Hook that allows subclasses to modify the graph between runs.
     * Return `true` if the graph was changed and should be executed again.
     *
     * @param params - Parameters for updating the graph
     * @returns Whether the graph was changed and should be run again
     */
    async updateGraph({
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
    }): Promise<boolean> {
        return false;
    }

    /**
     * Runs the orchestrator until `updateGraph` returns false.
     * @param input - Input for the orchestrator
     * @param context - Context for execution
     * @returns Generator yielding events during execution
     */
    async *invoke(
        input: any,
        context: any = {}
    ): AsyncGenerator<BaseYieldType, any, void> {
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
     * @param options - Graph options
     * @returns A builder instance
     */
    static builder(options?: RunnableGraphOptions): GraphOrchestratorBuilder {
        return new GraphOrchestratorBuilder(options);
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
    #graph: RunnableGraph<any, any, any, any>;

    /**
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
    node(
        id: string,
        runnable: Runnable<any, any, any, any>,
        config?: Record<string, any>
    ): GraphOrchestratorBuilder {
        this.#graph.addNode(id, runnable, config);
        return this;
    }

    /**
     * Connects two nodes in the graph.
     * @param from - Source node ID
     * @param to - Target node ID
     * @param config - Connection configuration
     * @returns This builder for chaining
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
     * @param nodeIds - Entry node IDs
     * @returns This builder for chaining
     */
    entry(...nodeIds: string[]): GraphOrchestratorBuilder {
        this.#graph.setEntryNodes(...nodeIds);
        return this;
    }

    /**
     * Sets exit nodes.
     * @param nodeIds - Exit node IDs
     * @returns This builder for chaining
     */
    exit(...nodeIds: string[]): GraphOrchestratorBuilder {
        this.#graph.setExitNodes(...nodeIds);
        return this;
    }

    /**
     * Finalizes the builder and returns a GraphOrchestrator.
     * @returns The constructed orchestrator
     */
    build(): GraphOrchestrator {
        return new GraphOrchestrator(this.#graph);
    }
}