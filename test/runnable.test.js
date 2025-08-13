import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { Runnable } from "../runnable.ts"; // Assuming runnable.ts is in the parent directory
// No need to import event types directly for these base tests, will check yielded objects.

// Helper to consume a generator and collect events for testing
async function consumeGenerator(generator) {
	const events = [];
	let returnValue;
	try {
		// Iterate to get all yielded events
		let result = await generator.next();
		while (!result.done) {
			events.push(result.value);
			result = await generator.next();
		}
		// When done, result.value is the TReturn of the generator
		returnValue = result.value;
	} catch (e) {
		events.push({
			type: "test_framework_error_catch",
			error: { name: e.name, message: e.message },
		});
	}
	return { events, returnValue };
}

describe("Runnable (core/runnable/runnable.ts)", () => {
	describe("Constructor", () => {
		it("should create an instance with a default AbortController if none is provided", () => {
			const runnable = new Runnable();
			expect(runnable.name).toBeUndefined();
			expect(runnable.abortController).toBeInstanceOf(AbortController);
			expect(runnable.abortSignal).toBeInstanceOf(AbortSignal);
			expect(runnable.abortSignal.aborted).toBe(false);
		});

		it("should use a passed-in name", () => {
			const runnable = new Runnable({ name: "MyTestRunnable" });
			expect(runnable.name).toBe("MyTestRunnable");
		});

		it("should use a passed-in AbortController", () => {
			const customAbortController = new AbortController();
			const runnable = new Runnable({ abortController: customAbortController });
			expect(runnable.abortController).toBe(customAbortController);
			expect(runnable.abortSignal).toBe(customAbortController.signal);
		});

		it("should store description when provided", () => {
			const runnable = new Runnable({
				name: "TestRunnable",
				description: "A test runnable for demonstration",
			});
			expect(runnable.description).toBe("A test runnable for demonstration");
		});

		it("should store input and output schemas when provided", () => {
			const inputSchema = z.object({ name: z.string() });
			const outputSchema = z.object({ result: z.string() });

			const runnable = new Runnable({
				name: "SchemaRunnable",
				inputSchema,
				outputSchema,
			});

			expect(runnable.inputSchema).toBe(inputSchema);
			expect(runnable.outputSchema).toBe(outputSchema);
		});
	});

	describe("abortSignal getter", () => {
		it("should return the signal from the AbortController", () => {
			const controller = new AbortController();
			const runnable = new Runnable({ abortController: controller });
			expect(runnable.abortSignal).toBe(controller.signal);
		});

		it("should reflect the aborted state of the controller", () => {
			const controller = new AbortController();
			const runnable = new Runnable({ abortController: controller });
			expect(runnable.abortSignal.aborted).toBe(false);
			controller.abort();
			expect(runnable.abortSignal.aborted).toBe(true);
		});
	});

	describe("Base invoke() method (placeholder behavior)", () => {
		it("should yield a warning log event and return the input", async () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});
			const runnable = new Runnable({ name: "BaseInvokeTest" });
			const input = { data: "test input" };
			const context = { workflowInstanceId: "wf-1", traceId: "trace-1" };

			const { events, returnValue } = await consumeGenerator(
				runnable.invoke(input, context),
			);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Runnable 'BaseInvokeTest': invoke() method not implemented. Defaulting to no-op pass-through.",
			);

			expect(events.length).toBe(1);
			const logEvent = events[0];
			expect(logEvent).toMatchObject({
				type: "log",
				level: "warn",
				message:
					"Base invoke for BaseInvokeTest. Input will be returned as output.",
				runnableName: "BaseInvokeTest",
				timestamp: expect.any(Number),
			});

			expect(returnValue).toEqual(input);

			consoleWarnSpy.mockRestore();
		});

		it("should work with an undefined name", async () => {
			const consoleWarnSpy = vi
				.spyOn(console, "warn")
				.mockImplementation(() => {});
			const runnable = new Runnable(); // No name
			const input = "simple string";

			const { events, returnValue } = await consumeGenerator(
				runnable.invoke(input, {}),
			);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Runnable: invoke() method not implemented. Defaulting to no-op pass-through.",
			);
			expect(events[0].message).toBe(
				"Base invoke for Unnamed Runnable. Input will be returned as output.",
			);
			expect(returnValue).toBe("simple string");

			consoleWarnSpy.mockRestore();
		});
	});

	describe("help() method", () => {
		it("should generate help for a basic runnable without schemas", () => {
			const runnable = new Runnable({
				name: "BasicRunnable",
				description: "A simple runnable for testing",
			});

			const help = runnable.help();

			expect(help).toContain("BasicRunnable");
			expect(help).toContain("A simple runnable for testing");
			expect(help).toContain("No input schema defined");
			expect(help).toContain("No output schema defined");
		});

		it("should generate help for a runnable with schemas", () => {
			const inputSchema = z.object({
				name: z.string(),
				age: z.number().optional(),
			});
			const outputSchema = z.object({
				greeting: z.string(),
			});

			const runnable = new Runnable({
				name: "GreetingRunnable",
				description: "Creates personalized greetings",
				inputSchema,
				outputSchema,
			});

			const help = runnable.help();

			expect(help).toContain("GreetingRunnable");
			expect(help).toContain("Creates personalized greetings");
			expect(help).toContain("name: string");
			expect(help).toContain("age?: number");
			expect(help).toContain("greeting: string");
		});

		it("should handle unnamed runnable", () => {
			const runnable = new Runnable();
			const help = runnable.help();

			expect(help).toContain("Unnamed Runnable");
		});

		it("should format different schema types correctly", () => {
			const inputSchema = z.union([
				z.string(),
				z.number(),
				z.array(z.boolean()),
			]);

			const runnable = new Runnable({
				name: "TypeTestRunnable",
				inputSchema,
			});

			const help = runnable.help();

			expect(help).toContain("string | number | array of boolean");
		});

		it("should handle enum schemas", () => {
			const inputSchema = z.enum(["red", "green", "blue"]);

			const runnable = new Runnable({
				name: "ColorRunnable",
				inputSchema,
			});

			const help = runnable.help();

			expect(help).toContain('"red" | "green" | "blue"');
		});
	});

	describe("run() method", () => {
		it("should return final output from invoke", async () => {
			class AddOne extends Runnable {
				async *invoke(i) {
					return i + 1;
				}
			}
			const runnable = new AddOne();
			const result = await runnable.run(41);
			expect(result).toBe(42);
		});

		it("should consume all events", async () => {
			class Yielding extends Runnable {
				async *invoke() {
					yield { type: "chunk", data: 1 };
					return 2;
				}
			}
			const runnable = new Yielding();
			const output = await runnable.run();
			expect(output).toBe(2);
		});
	});

	describe("validation behavior", () => {
		it("should validate input when schema provided", async () => {
			const runnable = new Runnable({
				inputSchema: z.object({ x: z.number() }),
			});
			const { events, returnValue } = await consumeGenerator(
				runnable.invoke({ x: "bad" }),
			);
			expect(returnValue).toBeUndefined();
			expect(events[0].type).toBe("test_framework_error_catch");
		});

		it("should validate output when schema provided", async () => {
			const runnable = new Runnable({
				inputSchema: z.object({ x: z.number() }),
				outputSchema: z.object({ x: z.number() }),
			});
			const { returnValue } = await consumeGenerator(runnable.invoke({ x: 1 }));
			expect(returnValue).toEqual({ x: 1 });
		});

		it("should bypass input validation when disabled", async () => {
			const runnable = new Runnable({
				inputSchema: z.object({ x: z.number() }),
				validateInput: false,
			});
			const { returnValue } = await consumeGenerator(
				runnable.invoke({ x: "skip" }),
			);
			expect(returnValue).toEqual({ x: "skip" });
		});

		it("should bypass output validation when disabled", async () => {
			const runnable = new Runnable({
				outputSchema: z.object({ y: z.string() }),
				validateOutput: false,
			});
			const { returnValue } = await consumeGenerator(runnable.invoke({ y: 5 }));
			expect(returnValue).toEqual({ y: 5 });
		});
	});
});
