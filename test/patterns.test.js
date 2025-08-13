import { describe, it, expect } from "vitest";
import {
	MapRunnable,
	FilterRunnable,
	ConditionalRunnable,
	ParallelJoinRunnable,
} from "../patterns.ts";
import { Runnable } from "../runnable.ts";

async function collect(generator) {
	const events = [];
	let result = await generator.next();
	while (!result.done) {
		events.push(result.value);
		result = await generator.next();
	}
	return { events, returnValue: result.value };
}

describe("Reusable pattern runnables", () => {
	it("MapRunnable should map over inputs and yield chunks", async () => {
		const map = new MapRunnable((x) => x * 2, { name: "mapper" });
		const { events, returnValue } = await collect(map.invoke([1, 2, 3]));
		expect(returnValue).toEqual([2, 4, 6]);
		expect(events.length).toBe(3);
		expect(events[0]).toMatchObject({ type: "chunk", data: 2 });
	});

	it("FilterRunnable should filter inputs and yield kept items", async () => {
		const filt = new FilterRunnable((x) => x % 2 === 0, { name: "filter" });
		const { events, returnValue } = await collect(filt.invoke([1, 2, 3, 4]));
		expect(returnValue).toEqual([2, 4]);
		expect(events.map((e) => e.data)).toEqual([2, 4]);
	});

	it("ConditionalRunnable should choose between runnables", async () => {
		class A extends Runnable {
			async *invoke() {
				return "A";
			}
		}
		class B extends Runnable {
			async *invoke() {
				return "B";
			}
		}
		const cond = new ConditionalRunnable((i) => i === "a", new A(), new B());
		let result = await collect(cond.invoke("a"));
		expect(result.returnValue).toBe("A");
		result = await collect(cond.invoke("b"));
		expect(result.returnValue).toBe("B");
	});

	it("ParallelJoinRunnable should run runnables and combine outputs", async () => {
		class PlusOne extends Runnable {
			async *invoke(i) {
				return i + 1;
			}
		}
		class TimesTwo extends Runnable {
			async *invoke(i) {
				return i * 2;
			}
		}
		const join = new ParallelJoinRunnable([new PlusOne(), new TimesTwo()]);
		const { returnValue } = await collect(join.invoke(3));
		expect(returnValue).toEqual([4, 6]);
	});
});
