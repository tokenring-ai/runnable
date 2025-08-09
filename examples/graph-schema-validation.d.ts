export class NumberProcessorRunnable extends Runnable<any, any, any, any> {
	constructor();
	invoke(input: any): AsyncGenerator<
		{
			type: string;
			level: string;
			message: string;
			timestamp: number;
			runnableName: string;
		},
		{
			result: string;
			processed: boolean;
		},
		unknown
	>;
}
export class StringFormatterRunnable extends Runnable<any, any, any, any> {
	constructor();
	invoke(input: any): AsyncGenerator<
		{
			type: string;
			level: string;
			message: string;
			timestamp: number;
			runnableName: string;
		},
		{
			message: string;
			timestamp: number;
		},
		unknown
	>;
}
export class IncompatibleRunnable extends Runnable<any, any, any, any> {
	constructor();
	invoke(input: any): AsyncGenerator<
		never,
		{
			output: string;
		},
		unknown
	>;
}
export function demonstrateCompatibleGraph(): Promise<void>;
export function demonstrateIncompatibleGraph(): Promise<void>;
export function demonstrateWarningScenarios(): Promise<void>;
export function demonstrateHelp(): Promise<void>;
import { Runnable } from "../index.js";
