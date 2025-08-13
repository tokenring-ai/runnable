import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
	validateZodTypeCompatibility,
	validateSchemaExists,
} from "../schema-validator.ts";

describe("Schema Validator", () => {
	describe("validateSchemaExists", () => {
		it("should return warning when schema is missing", () => {
			const result = validateSchemaExists(null, "test context");

			expect(result.compatible).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain(
				"test context has no schema defined",
			);
			expect(result.errors).toHaveLength(0);
		});

		it("should return success when schema exists", () => {
			const schema = z.string();
			const result = validateSchemaExists(schema, "test context");

			expect(result.compatible).toBe(true);
			expect(result.warnings).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("validateZodTypeCompatibility - Basic Types", () => {
		it("should validate compatible basic types", () => {
			const outputSchema = z.string();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should detect incompatible basic types", () => {
			const outputSchema = z.number();
			const inputSchema = z.boolean();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("Incompatible types");
		});

		it("should allow number to string conversion", () => {
			const outputSchema = z.number();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should allow boolean to string conversion", () => {
			const outputSchema = z.boolean();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should handle any type as compatible with everything", () => {
			const outputSchema = z.any();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});
	});

	describe("validateZodTypeCompatibility - Optional and Nullable", () => {
		it("should warn when output is optional but input is required", () => {
			const outputSchema = z.string().optional();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain(
				"Output is optional but input is required",
			);
		});

		it("should error when output is nullable but input is not", () => {
			const outputSchema = z.string().nullable();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain(
				"Output can be null but input does not accept null",
			);
		});

		it("should allow nullable output to nullable input", () => {
			const outputSchema = z.string().nullable();
			const inputSchema = z.string().nullable();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should allow optional output to optional input", () => {
			const outputSchema = z.string().optional();
			const inputSchema = z.string().optional();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe("validateZodTypeCompatibility - Object Types", () => {
		it("should validate compatible object schemas", () => {
			const outputSchema = z.object({
				name: z.string(),
				age: z.number(),
			});
			const inputSchema = z.object({
				name: z.string(),
				age: z.number(),
			});

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should detect missing required properties", () => {
			const outputSchema = z.object({
				name: z.string(),
			});
			const inputSchema = z.object({
				name: z.string(),
				age: z.number(), // Required but not in output
			});

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain(
				"Required input property 'age' is not provided",
			);
		});

		it("should warn about missing optional properties", () => {
			const outputSchema = z.object({
				name: z.string(),
			});
			const inputSchema = z.object({
				name: z.string(),
				age: z.number().optional(), // Optional, so just a warning
			});

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain(
				"Optional input property 'age' is not provided",
			);
		});

		it("should validate nested object properties", () => {
			const outputSchema = z.object({
				user: z.object({
					name: z.string(),
					age: z.string(), // Wrong type
				}),
			});
			const inputSchema = z.object({
				user: z.object({
					name: z.string(),
					age: z.number(), // Expects number
				}),
			});

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors.some((e) => e.includes("Property 'user'"))).toBe(
				true,
			);
		});
	});

	describe("validateZodTypeCompatibility - Array Types", () => {
		it("should validate compatible array schemas", () => {
			const outputSchema = z.array(z.string());
			const inputSchema = z.array(z.string());

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should detect incompatible array element types", () => {
			const outputSchema = z.array(z.number());
			const inputSchema = z.array(z.boolean());

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors.some((e) => e.includes("Array element"))).toBe(true);
		});

		it("should allow compatible array element conversions", () => {
			const outputSchema = z.array(z.number());
			const inputSchema = z.array(z.string()); // numbers can convert to strings

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});
	});

	describe("validateZodTypeCompatibility - Union Types", () => {
		it("should validate compatible union types", () => {
			const outputSchema = z.union([z.string(), z.number()]);
			const inputSchema = z.union([z.string(), z.number()]);

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should find compatible paths in union types", () => {
			const outputSchema = z.union([z.string(), z.number()]);
			const inputSchema = z.string(); // string is compatible with one option

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);
			console.log("Union compatible test result:", {
				compatible: result.compatible,
				warnings: result.warnings,
				errors: result.errors,
			});

			expect(result.compatible).toBe(true);
			expect(result.warnings.some((w) => w.includes("compatible option"))).toBe(
				true,
			);
		});

		it("should detect incompatible union types", () => {
			const outputSchema = z.union([z.boolean(), z.date()]);
			const inputSchema = z.number(); // number is not compatible with boolean or date

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);
			console.log("Union incompatible test result:", {
				compatible: result.compatible,
				warnings: result.warnings,
				errors: result.errors,
			});

			expect(result.compatible).toBe(false);
			expect(
				result.errors.some((e) => e.includes("No compatible option")),
			).toBe(true);
		});
	});

	describe("validateZodTypeCompatibility - Enum Types", () => {
		it("should validate identical enum types", () => {
			const outputSchema = z.enum(["red", "green", "blue"]);
			const inputSchema = z.enum(["red", "green", "blue"]);

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should detect incompatible enum types", () => {
			const outputSchema = z.enum(["red", "green"]);
			const inputSchema = z.enum(["blue", "yellow"]);

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(result.errors.some((e) => e.includes("no common values"))).toBe(
				true,
			);
		});

		it("should warn about partially overlapping enum types", () => {
			const outputSchema = z.enum(["red", "green", "blue"]);
			const inputSchema = z.enum(["red", "yellow"]); // 'red' overlaps

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
			expect(
				result.warnings.some((w) => w.includes("different sets of values")),
			).toBe(true);
		});
	});

	describe("validateZodTypeCompatibility - Literal Types", () => {
		it("should validate identical literal types", () => {
			const outputSchema = z.literal("hello");
			const inputSchema = z.literal("hello");

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should detect incompatible literal types", () => {
			const outputSchema = z.literal("hello");
			const inputSchema = z.literal("world");

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(
				result.errors.some((e) => e.includes("Literal values don't match")),
			).toBe(true);
		});
	});

	describe("validateZodTypeCompatibility - Edge Cases", () => {
		it("should handle missing schemas", () => {
			const result = validateZodTypeCompatibility(null, z.string());

			expect(result.compatible).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("schemas are missing");
		});

		it("should handle void/undefined output types", () => {
			const outputSchema = z.void();
			const inputSchema = z.string();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(false);
			expect(
				result.errors.some((e) =>
					e.includes("void/undefined but input is required"),
				),
			).toBe(true);
		});

		it("should allow void output to optional input", () => {
			const outputSchema = z.void();
			const inputSchema = z.string().optional();

			const result = validateZodTypeCompatibility(outputSchema, inputSchema);

			expect(result.compatible).toBe(true);
		});

		it("should handle schema analysis errors gracefully", () => {
			// Create a mock schema that will cause an error during analysis
			const badSchema = { _def: { typeName: "InvalidType" } };
			const goodSchema = z.string();

			const result = validateZodTypeCompatibility(badSchema, goodSchema);

			// The function should still work but treat unknown types as 'unknown'
			expect(result.compatible).toBe(true); // 'unknown' is compatible with anything
		});
	});
});
