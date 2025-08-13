import { describe, it, expect, beforeEach, vi } from "vitest";
import { LogEvent, ChunkEvent, ErrorEvent } from "../events.ts";

describe("Event factory helpers", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(42);
	});

	it("LogEvent should build log event with metadata", () => {
		const evt = new LogEvent("info", "hello", { runnableName: "r1" });
		expect(evt).toBeInstanceOf(LogEvent);
		expect(evt).toMatchObject({
			type: "log",
			level: "info",
			message: "hello",
			runnableName: "r1",
			timestamp: 42,
		});
	});

	it("ChunkEvent should build chunk event", () => {
		const evt = new ChunkEvent(5, { runnableName: "r2" });
		expect(evt).toBeInstanceOf(ChunkEvent);
		expect(evt).toMatchObject({
			type: "chunk",
			data: 5,
			runnableName: "r2",
			timestamp: 42,
		});
	});

	it("ErrorEvent should handle Error objects", () => {
		const err = new Error("oops");
		const evt = new ErrorEvent(err, { runnableName: "r3" });
		expect(evt).toBeInstanceOf(ErrorEvent);
		expect(evt.type).toBe("error_event");
		expect(evt.error.message).toBe("oops");
		expect(evt.runnableName).toBe("r3");
		expect(evt.timestamp).toBe(42);
	});
});
