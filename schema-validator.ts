/**
 * @file core/runnable/schema-validator.ts
 * @description Provides utilities for validating Zod schema compatibility between runnables
 */

import {z} from 'zod';

/**
 * Result of schema validation
 */
export type ValidationResult = {
  /**
   * Whether the schemas are compatible
   */
  compatible: boolean;
  /**
   * Array of warning messages
   */
  warnings: string[];
  /**
   * Array of error messages
   */
  errors: string[];
};

/**
 * Information about a schema structure
 */
export type SchemaInfo = {
  /**
   * The base type (string, number, object, array, etc.)
   */
  type: string;
  /**
   * Whether the schema is optional
   */
  optional: boolean;
  /**
   * Whether the schema is nullable
   */
  nullable: boolean;
  /**
   * For object types, the properties schema info
   */
  properties?: Record<string, SchemaInfo>;
  /**
   * For array types, the element schema info
   */
  element?: SchemaInfo;
  /**
   * For union types, the possible schemas
   */
  union?: SchemaInfo[];
  /**
   * For enum types, the possible values
   */
  enum?: any[];
  /**
   * For literal types, the literal value
   */
  literal?: any;
};

/**
 * Extracts schema information from a Zod schema
 * @param schema - The Zod schema to analyze
 * @returns Information about the schema structure
 */
function extractSchemaInfo(schema: z.ZodSchema): SchemaInfo {
  if (!schema || !schema._def) {
    return {type: "unknown", optional: false, nullable: false};
  }

  const def: any = (schema as any)._def;
  const typeName: string = def.typeName;

  // Handle optional schemas
  if (typeName === "ZodOptional") {
    const innerInfo = extractSchemaInfo(def.innerType);
    return {...innerInfo, optional: true};
  }

  // Handle nullable schemas
  if (typeName === "ZodNullable") {
    const innerInfo = extractSchemaInfo(def.innerType);
    return {...innerInfo, nullable: true};
  }

  // Handle default schemas (which are effectively optional)
  if (typeName === "ZodDefault") {
    const innerInfo = extractSchemaInfo(def.innerType);
    return {...innerInfo, optional: true};
  }

  switch (typeName) {
    case "ZodString":
      return {type: "string", optional: false, nullable: false};

    case "ZodNumber":
      return {type: "number", optional: false, nullable: false};

    case "ZodBoolean":
      return {type: "boolean", optional: false, nullable: false};

    case "ZodDate":
      return {type: "date", optional: false, nullable: false};

    case "ZodArray":
      return {
        type: "array",
        optional: false,
        nullable: false,
        element: extractSchemaInfo(def.type as z.ZodSchema),
      };

    case "ZodObject":
      const properties: Record<string, SchemaInfo> = {};
      for (const [key, value] of Object.entries((def as any).shape())) {
        properties[key] = extractSchemaInfo(value as z.ZodSchema);
      }
      return {
        type: "object",
        optional: false,
        nullable: false,
        properties,
      };

    case "ZodUnion":
      return {
        type: "union",
        optional: false,
        nullable: false,
        union: (def.options as z.ZodSchema[]).map(extractSchemaInfo),
      };

    case "ZodEnum":
      return {
        type: "enum",
        optional: false,
        nullable: false,
        enum: (def.values as any[]),
      };

    case "ZodLiteral":
      return {
        type: "literal",
        optional: false,
        nullable: false,
        literal: (def.value as any),
      };

    case "ZodAny":
      return {type: "any", optional: false, nullable: false};

    case "ZodUnknown":
      return {type: "unknown", optional: false, nullable: false};

    case "ZodVoid":
      return {type: "void", optional: false, nullable: false};

    case "ZodUndefined":
      return {type: "undefined", optional: true, nullable: false};

    case "ZodNull":
      return {type: "null", optional: false, nullable: true};

    default:
      return {type: "unknown", optional: false, nullable: false};
  }
}

/**
 * Checks if two basic types are compatible
 * @param outputType - The output type
 * @param inputType - The input type
 * @returns Whether the types are compatible
 */
function areBasicTypesCompatible(outputType: string, inputType: string): boolean {
  // Any and unknown are compatible with everything
  if (
    outputType === "any" ||
    inputType === "any" ||
    outputType === "unknown" ||
    inputType === "unknown"
  ) {
    return true;
  }

  // Union types require special handling in the calling code
  // We'll just return true here to let the union-specific code handle it
  if (outputType === "union") {
    return true;
  }

  // Exact match
  if (outputType === inputType) {
    return true;
  }

  // Special compatibility rules
  switch (inputType) {
    case "string":
      // Numbers and booleans can be converted to strings
      return ["number", "boolean"].includes(outputType);

    case "number":
      // Only numbers are compatible with number inputs
      return outputType === "number";

    case "boolean":
      // Only booleans are compatible with boolean inputs
      return outputType === "boolean";

    case "date":
      // Strings can be parsed as dates, dates are compatible
      return ["string", "date"].includes(outputType);

    case "array":
      // Only arrays are compatible with array inputs
      return outputType === "array";

    case "object":
      // Only objects are compatible with object inputs
      return outputType === "object";

    default:
      return false;
  }
}

/**
 * Validates compatibility between object schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateObjectCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (!outputSchema.properties || !inputSchema.properties) {
    result.warnings.push(
      "Object schema properties not available for detailed validation",
    );
    return result;
  }

  // Check if all required input properties are provided by output
  for (const [inputKey, inputProp] of Object.entries(inputSchema.properties)) {
    const outputProp = outputSchema.properties[inputKey];

    if (!outputProp) {
      if (!inputProp.optional) {
        result.errors.push(
          `Required input property '${inputKey}' is not provided by output schema`,
        );
        result.compatible = false;
      } else {
        result.warnings.push(
          `Optional input property '${inputKey}' is not provided by output schema`,
        );
      }
      continue;
    }

    // Recursively validate property compatibility
    const propResult = validateSchemaCompatibility(outputProp, inputProp);

    // Add property path to errors for nested objects
    if (!propResult.compatible) {
      result.errors.push(`Property '${inputKey}' has incompatible types: output is ${outputProp.type}, input is ${inputProp.type}`);
      result.compatible = false;
    }

    // Also add the detailed warnings and errors
    result.warnings.push(...propResult.warnings);
    result.errors.push(...propResult.errors);
  }

  // Also check for extra properties in output not required by input
  for (const [outputKey, outputProp] of Object.entries(outputSchema.properties)) {
    if (!inputSchema.properties[outputKey]) {
      result.warnings.push(
        `Output property '${outputKey}' is not used by input schema`,
      );
    }
  }

  return result;
}

/**
 * Validates compatibility between array schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateArrayCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (!outputSchema.element || !inputSchema.element) {
    result.warnings.push(
      "Array element schema not available for detailed validation",
    );
    return result;
  }

  // Validate element type compatibility
  const elementResult = validateSchemaCompatibility(
    outputSchema.element,
    inputSchema.element,
  );

  // Add specific array element error message for tests
  if (!elementResult.compatible) {
    result.errors.push(
      `Array element type incompatibility: ${outputSchema.element.type} is not compatible with ${inputSchema.element.type}`
    );
    result.compatible = false;
  }

  // Also include the detailed error messages
  result.warnings.push(...elementResult.warnings);
  result.errors.push(...elementResult.errors);

  return result;
}

/**
 * Validates compatibility between enum schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateEnumCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (!outputSchema.enum || !inputSchema.enum) {
    result.warnings.push("Enum values not available for detailed validation");
    return result;
  }

  // Check if there are any common values between the enums
  const outputEnum = outputSchema.enum ?? [];
  const inputEnum = inputSchema.enum ?? [];
  const commonValues = outputEnum.filter((value) => inputEnum.includes(value));

  if (commonValues.length === 0) {
    result.errors.push(
      `Output and input enums have no common values`
    );
    result.compatible = false;
    return result;
  }

  // For partially overlapping enum types, we consider them compatible but issue a warning
  // Check if there are values in input not found in output
  const missingValues = inputEnum.filter((value) => !outputEnum.includes(value));

  // Check if there are extra values in output not found in input
  const extraValues = outputEnum.filter((value) => !inputEnum.includes(value));

  // If we have common values but some values differ
  if ((missingValues.length > 0 || extraValues.length > 0) && commonValues.length > 0) {
    result.warnings.push(
      `Output and input enums contain different sets of values`
    );
  }

  return result;
}

/**
 * Validates compatibility between union schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateUnionCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  // Case 1: Both input and output are unions
  if (outputSchema.union && inputSchema.union) {
    // For unions, at least one output type must be compatible with each input type
    for (const inputType of inputSchema.union) {
      let hasCompatible = false;
      for (const outputType of outputSchema.union) {
        const typeResult = validateSchemaCompatibility(outputType, inputType);
        if (typeResult.compatible) {
          hasCompatible = true;
          break;
        }
      }

      if (!hasCompatible) {
        result.errors.push(
          `No compatible option in output union for input type '${inputType.type}'`,
        );
        result.compatible = false;
      }
    }
    return result;
  }

  // Case 2: Output is union, input is simple type
  if (outputSchema.union && !inputSchema.union) {
    let hasCompatible = false;
    for (const outputType of outputSchema.union) {
      const typeResult = validateSchemaCompatibility(outputType, inputSchema);
      if (typeResult.compatible) {
        hasCompatible = true;
        result.warnings.push(`Found compatible option in output union for input type '${inputSchema.type}'`);
        break;
      }
    }

    if (!hasCompatible) {
      result.errors.push(
        `No compatible option in output union for input type '${inputSchema.type}'`,
      );
      result.compatible = false;
    }
    return result;
  }

  // Case 3: Input is union, output is simple type
  if (!outputSchema.union && inputSchema.union) {
    result.warnings.push("Union options not available for detailed validation");
  }

  return result;
}

/**
 * Validates compatibility between literal schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateLiteralCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (
    outputSchema.literal === undefined ||
    inputSchema.literal === undefined
  ) {
    result.warnings.push("Literal values not available for detailed validation");
    return result;
  }

  // Literal values must match exactly
  if (outputSchema.literal !== inputSchema.literal) {
    result.errors.push(
      `Literal values don't match: output '${outputSchema.literal}' vs input '${inputSchema.literal}'`,
    );
    result.compatible = false;
  }

  return result;
}

/**
 * Validates compatibility between two schemas
 * @param outputSchema - The output schema info
 * @param inputSchema - The input schema info
 * @returns Validation result
 */
function validateSchemaCompatibility(
  outputSchema: SchemaInfo,
  inputSchema: SchemaInfo
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  // Handle void/undefined types - they only work with optional inputs
  if (outputSchema.type === "void" || outputSchema.type === "undefined") {
    if (inputSchema.optional) {
      return result; // Void outputs are compatible with optional inputs
    } else {
      result.errors.push(
        `Output is void/undefined but input is required`
      );
      result.compatible = false;
      return result;
    }
  }

  // Handle nullable and optional cases
  if (outputSchema.nullable && !inputSchema.nullable) {
    result.errors.push(
      `Output can be null but input does not accept null`,
    );
    result.compatible = false;
  }

  if (!inputSchema.optional && outputSchema.optional) {
    result.warnings.push(
      `Output is optional but input is required`,
    );
  }

  // Validate basic type compatibility
  if (!areBasicTypesCompatible(outputSchema.type, inputSchema.type)) {
    result.errors.push(
      `Incompatible types: Output type '${outputSchema.type}' is not compatible with input type '${inputSchema.type}'`,
    );
    result.compatible = false;
    return result;
  }

  // Special case for output union types - handle before other input type validations
  if (outputSchema.type === "union") {
    // Case where output is a union
    if (inputSchema.type === "union") {
      // Both are unions - check compatibility
      const unionResult = validateUnionCompatibility(
        outputSchema,
        inputSchema,
      );
      result.warnings.push(...unionResult.warnings);
      result.errors.push(...unionResult.errors);
      if (!unionResult.compatible) {
        result.compatible = false;
      }
    } else {
      // Output is union, input is simple type
      let hasCompatible = false;
      for (const outputOption of (outputSchema.union ?? [])) {
        const optionResult = validateSchemaCompatibility(outputOption, inputSchema);
        if (optionResult.compatible) {
          hasCompatible = true;
          result.warnings.push(`Found compatible option in output union for input type '${inputSchema.type}'`);
          break;
        }
      }

      if (!hasCompatible) {
        result.errors.push(`No compatible option in output union for input type '${inputSchema.type}'`);
        result.compatible = false;
      }
    }
    return result;
  }

  // Handle deeper validation based on schema type
  switch (inputSchema.type) {
    case "object":
      if (outputSchema.type === "object") {
        const objectResult = validateObjectCompatibility(
          outputSchema,
          inputSchema,
        );
        result.warnings.push(...objectResult.warnings);
        result.errors.push(...objectResult.errors);
        if (!objectResult.compatible) {
          result.compatible = false;
        }
      }
      break;

    case "array":
      if (outputSchema.type === "array") {
        const arrayResult = validateArrayCompatibility(
          outputSchema,
          inputSchema,
        );
        result.warnings.push(...arrayResult.warnings);
        result.errors.push(...arrayResult.errors);
        if (!arrayResult.compatible) {
          result.compatible = false;
        }
      }
      break;

    case "enum":
      if (outputSchema.type === "enum") {
        const enumResult = validateEnumCompatibility(
          outputSchema,
          inputSchema,
        );
        result.warnings.push(...enumResult.warnings);
        result.errors.push(...enumResult.errors);
        if (!enumResult.compatible) {
          result.compatible = false;
        }
      }
      break;

    case "union":
      // Input is union but output is not - this is handled above already
      result.warnings.push("Union options not available for detailed validation");
      break;

    case "literal":
      if (outputSchema.type === "literal") {
        const literalResult = validateLiteralCompatibility(
          outputSchema,
          inputSchema,
        );
        result.warnings.push(...literalResult.warnings);
        result.errors.push(...literalResult.errors);
        if (!literalResult.compatible) {
          result.compatible = false;
        }
      }
      break;
  }

  return result;
}

/**
 * Main function to validate compatibility between two Zod schemas
 * @param outputSchema - The output schema
 * @param inputSchema - The input schema
 * @returns Validation result
 */
export function validateZodTypeCompatibility(
  outputSchema: z.ZodSchema,
  inputSchema: z.ZodSchema
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (!outputSchema || !inputSchema) {
    result.errors.push(
      "One or both schemas are missing, cannot validate compatibility"
    );
    result.compatible = false;
    return result;
  }

  const outputSchemaInfo = extractSchemaInfo(outputSchema);
  const inputSchemaInfo = extractSchemaInfo(inputSchema);

  const compatibilityResult = validateSchemaCompatibility(
    outputSchemaInfo,
    inputSchemaInfo,
  );

  result.compatible = compatibilityResult.compatible;
  result.warnings.push(...compatibilityResult.warnings);
  result.errors.push(...compatibilityResult.errors);

  return result;
}

/**
 * Validates that a schema exists and provides helpful information
 * @param schema - The schema to validate
 * @param context - Context for error messages (e.g., "node 'nodeId' input")
 * @returns Validation result
 */
export function validateSchemaExists(
  schema: z.ZodSchema,
  context: string
): ValidationResult {
  const result: ValidationResult = {compatible: true, warnings: [], errors: []};

  if (!schema) {
    result.warnings.push(`${context} has no schema defined`);
    return result;
  }

  try {
    const schemaInfo = extractSchemaInfo(schema);
    if (schemaInfo.type === "unknown") {
      result.warnings.push(
        `Schema for ${context} is of unknown type and may not work as expected`,
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.warnings.push(
      `Could not analyze schema for ${context}: ${msg}`,
    );
  }

  return result;
}