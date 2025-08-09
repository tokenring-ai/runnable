/**
 * Main function to validate compatibility between two Zod schemas
 * @param {import('zod').ZodSchema} outputSchema - The output schema
 * @param {import('zod').ZodSchema} inputSchema - The input schema
 * @returns {ValidationResult} Validation result
 */
export function validateZodTypeCompatibility(
	outputSchema: import("zod").ZodSchema,
	inputSchema: import("zod").ZodSchema,
): ValidationResult;
/**
 * Validates that a schema exists and provides helpful information
 * @param {import('zod').ZodSchema} schema - The schema to validate
 * @param {string} context - Context for error messages (e.g., "node 'nodeId' input")
 * @returns {ValidationResult} Validation result
 */
export function validateSchemaExists(
	schema: import("zod").ZodSchema,
	context: string,
): ValidationResult;
export type ValidationResult = {
	/**
	 * - Whether the schemas are compatible
	 */
	compatible: boolean;
	/**
	 * - Array of warning messages
	 */
	warnings: string[];
	/**
	 * - Array of error messages
	 */
	errors: string[];
};
export type SchemaInfo = {
	/**
	 * - The base type (string, number, object, array, etc.)
	 */
	type: string;
	/**
	 * - Whether the schema is optional
	 */
	optional: boolean;
	/**
	 * - Whether the schema is nullable
	 */
	nullable: boolean;
	/**
	 * - For object types, the properties schema info
	 */
	properties?: any;
	/**
	 * - For array types, the element schema info
	 */
	element?: SchemaInfo;
	/**
	 * - For union types, the possible schemas
	 */
	union?: SchemaInfo[];
	/**
	 * - For enum types, the possible values
	 */
	enum?: any[];
	/**
	 * - For literal types, the literal value
	 */
	literal?: any;
};
