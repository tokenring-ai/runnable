export class GreetingRunnable extends Runnable<any, any, any, any> {
	constructor();
	invoke(
		input: any,
		context: any,
	): AsyncGenerator<
		{
			type: string;
			level: string;
			message: string;
			timestamp: number;
			runnableName: string;
		},
		any,
		unknown
	>;
}
export function demonstrateSchemaRunnable(): Promise<void>;
import { Runnable } from "../runnable.js";
