/**
 * @fileoverview Tests for runnable helper functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	info,
	warning,
	error,
	fatal,
	performance as performanceHelper,
	createPerformanceTimer,
	PerformanceTimer,
	measureAsync,
	measure,
} from "../helpers.js";

describe("Runnable Helpers", () => {
	beforeEach(() => {
		// Mock Date.now to have predictable timestamps
		vi.spyOn(Date, "now").mockReturnValue(1234567890);
	});

	describe("Log Event Helpers", () => {
		describe("info", () => {
			it("should create an info log event", () => {
				const event = info("Test info message");

				expect(event).toEqual({
					type: "log",
					level: "info",
					message: "Test info message",
					timestamp: 1234567890,
				});
			});

			it("should include additional metadata", () => {
				const event = info("Test message", { userId: 123, action: "login" });

				expect(event).toEqual({
					type: "log",
					level: "info",
					message: "Test message",
					timestamp: 1234567890,
					userId: 123,
					action: "login",
				});
			});
		});

		describe("warning", () => {
			it("should create a warning log event", () => {
				const event = warning("Test warning message");

				expect(event).toEqual({
					type: "log",
					level: "warning",
					message: "Test warning message",
					timestamp: 1234567890,
				});
			});

			it("should include additional metadata", () => {
				const event = warning("Deprecated API used", {
					api: "oldMethod",
					version: "1.0",
				});

				expect(event).toEqual({
					type: "log",
					level: "warning",
					message: "Deprecated API used",
					timestamp: 1234567890,
					api: "oldMethod",
					version: "1.0",
				});
			});
		});

		describe("error", () => {
			it("should create an error log event with message only", () => {
				const event = error("Test error message");

				expect(event).toEqual({
					type: "log",
					level: "error",
					message: "Test error message",
					timestamp: 1234567890,
				});
			});

			it("should include error object details", () => {
				const testError = new Error("Something went wrong");
				testError.stack = "Error: Something went wrong\n    at test.js:1:1";

				const event = error("Operation failed", testError);

				expect(event).toEqual({
					type: "log",
					level: "error",
					message: "Operation failed",
					timestamp: 1234567890,
					error: {
						name: "Error",
						message: "Something went wrong",
						stack: "Error: Something went wrong\n    at test.js:1:1",
					},
				});
			});

			it("should handle non-Error objects as errorData", () => {
				const event = error("Custom error", {
					code: 500,
					details: "Server error",
				});

				expect(event).toEqual({
					type: "log",
					level: "error",
					message: "Custom error",
					timestamp: 1234567890,
					errorData: { code: 500, details: "Server error" },
				});
			});

			it("should include additional metadata", () => {
				const testError = new Error("Test error");
				const event = error("Failed operation", testError, {
					operation: "save",
					userId: 123,
				});

				expect(event.operation).toBe("save");
				expect(event.userId).toBe(123);
			});
		});

		describe("fatal", () => {
			it("should create a fatal error log event", () => {
				const event = fatal("System failure");

				expect(event).toEqual({
					type: "log",
					level: "fatal",
					message: "System failure",
					timestamp: 1234567890,
				});
			});

			it("should include error object details", () => {
				const testError = new Error("Critical failure");
				const event = fatal("System crashed", testError);

				expect(event.level).toBe("fatal");
				expect(event.error.message).toBe("Critical failure");
			});
		});
	});

	describe("Performance Helpers", () => {
		describe("performance", () => {
			it("should create a performance event", () => {
				const event = performanceHelper("Database Query", 150.5);

				expect(event).toEqual({
					type: "performance",
					level: "info",
					message: "Performance: Database Query took 150.5ms",
					operation: "Database Query",
					duration: 150.5,
					timestamp: 1234567890,
				});
			});

			it("should include additional metadata", () => {
				const event = performanceHelper("API Call", 200, {
					endpoint: "/users",
					method: "GET",
				});

				expect(event.endpoint).toBe("/users");
				expect(event.method).toBe("GET");
			});
		});

		describe("PerformanceTimer", () => {
			let mockPerformanceNow;

			beforeEach(() => {
				let currentTime = 1234567890000; // Start with a realistic timestamp
				mockPerformanceNow = vi.spyOn(Date, "now").mockImplementation(() => {
					return currentTime;
				});

				// Helper to advance mock time
				global.advanceTime = (ms) => {
					currentTime += ms;
				};
			});

			it("should create a timer with a name", () => {
				const timer = new PerformanceTimer("Test Operation");
				expect(timer.name).toBe("Test Operation");
				expect(timer.measurements).toEqual([]);
				expect(timer.isRunning).toBe(false);
			});

			it("should start and capture measurements", () => {
				const timer = new PerformanceTimer("Loop Timer");

				timer.start();
				expect(timer.isRunning).toBe(true);

				global.advanceTime(100);
				const duration1 = timer.capture();
				expect(duration1).toBe(100);

				global.advanceTime(150);
				const duration2 = timer.capture();
				expect(duration2).toBe(150);

				expect(timer.measurements).toEqual([100, 150]);
			});

			it("should stop the timer", () => {
				const timer = new PerformanceTimer("Test Timer");

				timer.start();
				global.advanceTime(200);
				const finalDuration = timer.stop();

				expect(finalDuration).toBe(200);
				expect(timer.isRunning).toBe(false);
				expect(timer.measurements).toEqual([200]);
			});

			it("should calculate statistics correctly", () => {
				const timer = new PerformanceTimer("Stats Timer");
				timer.measurements = [100, 200, 150, 300, 250];

				const stats = timer.getStats();

				expect(stats).toEqual({
					count: 5,
					total: 1000,
					average: 200,
					minimum: 100,
					maximum: 300,
				});
			});

			it("should handle empty measurements", () => {
				const timer = new PerformanceTimer("Empty Timer");

				const stats = timer.getStats();

				expect(stats).toEqual({
					count: 0,
					total: 0,
					average: 0,
					minimum: 0,
					maximum: 0,
				});
			});

			it("should create performance stats event", () => {
				const timer = new PerformanceTimer("Loop Processing");
				timer.measurements = [50, 75, 60];

				const event = timer.performanceStats({ batchSize: 100 });

				expect(event.type).toBe("performance");
				expect(event.level).toBe("info");
				expect(event.operation).toBe("Loop Processing");
				expect(event.statistics).toEqual({
					count: 3,
					total: 185,
					average: 61.67,
					minimum: 50,
					maximum: 75,
				});
				expect(event.batchSize).toBe(100);
				expect(event.message).toContain("3 operations");
				expect(event.message).toContain("avg: 61.67ms");
			});

			it("should reset the timer", () => {
				const timer = new PerformanceTimer("Reset Timer");
				timer.start();
				global.advanceTime(100);
				timer.capture();

				timer.reset();

				expect(timer.measurements).toEqual([]);
				expect(timer.isRunning).toBe(false);
				expect(timer.startTime).toBe(null);
			});

			it("should throw error when capturing without starting", () => {
				const timer = new PerformanceTimer("Error Timer");

				expect(() => timer.capture()).toThrow(
					"Timer must be started before capturing measurements",
				);
			});

			it("should throw error when stopping without starting", () => {
				const timer = new PerformanceTimer("Error Timer");

				expect(() => timer.stop()).toThrow("Timer is not running");
			});
		});

		describe("createPerformanceTimer", () => {
			it("should create a new PerformanceTimer instance", () => {
				const timer = createPerformanceTimer("My Operation");

				expect(timer).toBeInstanceOf(PerformanceTimer);
				expect(timer.name).toBe("My Operation");
			});
		});

		describe("measureAsync", () => {
			beforeEach(() => {
				let currentTime = 1234567890000;
				vi.spyOn(Date, "now").mockImplementation(() => {
					const time = currentTime;
					currentTime += 100; // Each call advances by 100ms
					return time;
				});
			});

			it("should measure async function execution", async () => {
				const asyncFn = async () => {
					return "success";
				};

				const { result, event } = await measureAsync(
					"Async Operation",
					asyncFn,
				);

				expect(result).toBe("success");
				expect(event.type).toBe("performance");
				expect(event.operation).toBe("Async Operation");
				expect(event.duration).toBe(100);
			});

			it("should handle async function errors", async () => {
				const asyncFn = async () => {
					throw new Error("Async error");
				};

				await expect(
					measureAsync("Failing Operation", asyncFn),
				).rejects.toThrow("Failing Operation failed after 100ms: Async error");
			});
		});

		describe("measure", () => {
			beforeEach(() => {
				let currentTime = 1234567890000;
				vi.spyOn(Date, "now").mockImplementation(() => {
					const time = currentTime;
					currentTime += 50; // Each call advances by 50ms
					return time;
				});
			});

			it("should measure synchronous function execution", () => {
				const syncFn = () => {
					return "sync result";
				};

				const { result, event } = measure("Sync Operation", syncFn);

				expect(result).toBe("sync result");
				expect(event.type).toBe("performance");
				expect(event.operation).toBe("Sync Operation");
				expect(event.duration).toBe(50);
			});

			it("should handle synchronous function errors", () => {
				const syncFn = () => {
					throw new Error("Sync error");
				};

				expect(() => measure("Failing Sync Operation", syncFn)).toThrow(
					"Failing Sync Operation failed after 50ms: Sync error",
				);
			});
		});
	});
});

describe("Integration Examples", () => {
	it("should demonstrate typical usage patterns", async () => {
		const events = [];

		// Simulate a runnable that uses all helpers
		async function* exampleRunnable() {
			yield info("Starting data processing");

			const timer = createPerformanceTimer("Data Processing Loop");
			timer.start();

			const items = [1, 2, 3, 4, 5];

			for (const item of items) {
				// Simulate processing
				await new Promise((resolve) => setTimeout(resolve, 10));
				timer.capture();

				if (item === 3) {
					yield warning("Processing item 3 took longer than expected");
				}
			}

			yield timer.performanceStats({ itemCount: items.length });

			try {
				const { result, event } = await measureAsync(
					"Database Save",
					async () => {
						// Simulate database operation
						return "saved";
					},
				);
				yield event;
				yield info("Data saved successfully", { result });
			} catch (err) {
				yield error("Failed to save data", err);
			}

			return "processing complete";
		}

		// Consume the generator
		const generator = exampleRunnable();
		let result;
		let done = false;

		while (!done) {
			const { value, done: isDone } = await generator.next();
			done = isDone;

			if (!done) {
				events.push(value);
			} else {
				result = value;
			}
		}

		// Verify we got the expected events
		expect(events.length).toBeGreaterThan(0);
		expect(events[0].message).toBe("Starting data processing");
		expect(events.some((e) => e.type === "performance")).toBe(true);
		expect(result).toBe("processing complete");
	});
});
