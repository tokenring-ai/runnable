/**
 * @file core/runnable/schema-validator.js
 * @description Provides utilities for validating Zod schema compatibility between runnables
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} compatible - Whether the schemas are compatible
 * @property {string[]} warnings - Array of warning messages
 * @property {string[]} errors - Array of error messages
 */

/**
 * @typedef {Object} SchemaInfo
 * @property {string} type - The base type (string, number, object, array, etc.)
 * @property {boolean} optional - Whether the schema is optional
 * @property {boolean} nullable - Whether the schema is nullable
 * @property {Object} [properties] - For object types, the properties schema info
 * @property {SchemaInfo} [element] - For array types, the element schema info
 * @property {SchemaInfo[]} [union] - For union types, the possible schemas
 * @property {any[]} [enum] - For enum types, the possible values
 * @property {any} [literal] - For literal types, the literal value
 */

/**
 * Extracts schema information from a Zod schema
 * @param {import('zod').ZodSchema} schema - The Zod schema to analyze
 * @returns {SchemaInfo} Information about the schema structure
 */
function extractSchemaInfo(schema) {
  if (!schema || !schema._def) {
    return { type: 'unknown', optional: false, nullable: false };
  }

  const def = schema._def;
  const typeName = def.typeName;

  // Handle optional schemas
  if (typeName === 'ZodOptional') {
    const innerInfo = extractSchemaInfo(def.innerType);
    return { ...innerInfo, optional: true };
  }

  // Handle nullable schemas
  if (typeName === 'ZodNullable') {
    const innerInfo = extractSchemaInfo(def.innerType);
    return { ...innerInfo, nullable: true };
  }

  // Handle default schemas (which are effectively optional)
  if (typeName === 'ZodDefault') {
    const innerInfo = extractSchemaInfo(def.innerType);
    return { ...innerInfo, optional: true };
  }

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', optional: false, nullable: false };
    
    case 'ZodNumber':
      return { type: 'number', optional: false, nullable: false };
    
    case 'ZodBoolean':
      return { type: 'boolean', optional: false, nullable: false };
    
    case 'ZodDate':
      return { type: 'date', optional: false, nullable: false };
    
    case 'ZodArray':
      return {
        type: 'array',
        optional: false,
        nullable: false,
        element: extractSchemaInfo(def.type)
      };
    
    case 'ZodObject':
      const properties = {};
      for (const [key, value] of Object.entries(def.shape())) {
        properties[key] = extractSchemaInfo(value);
      }
      return {
        type: 'object',
        optional: false,
        nullable: false,
        properties
      };
    
    case 'ZodUnion':
      return {
        type: 'union',
        optional: false,
        nullable: false,
        union: def.options.map(extractSchemaInfo)
      };
    
    case 'ZodEnum':
      return {
        type: 'enum',
        optional: false,
        nullable: false,
        enum: def.values
      };
    
    case 'ZodLiteral':
      return {
        type: 'literal',
        optional: false,
        nullable: false,
        literal: def.value
      };
    
    case 'ZodAny':
      return { type: 'any', optional: false, nullable: false };
    
    case 'ZodUnknown':
      return { type: 'unknown', optional: false, nullable: false };
    
    case 'ZodVoid':
      return { type: 'void', optional: false, nullable: false };
    
    case 'ZodUndefined':
      return { type: 'undefined', optional: true, nullable: false };
    
    case 'ZodNull':
      return { type: 'null', optional: false, nullable: true };
    
    default:
      return { type: 'unknown', optional: false, nullable: false };
  }
}

/**
 * Checks if two basic types are compatible
 * @param {string} outputType - The output type
 * @param {string} inputType - The input type
 * @returns {boolean} Whether the types are compatible
 */
function areBasicTypesCompatible(outputType, inputType) {
  // Any and unknown are compatible with everything
  if (outputType === 'any' || inputType === 'any' || 
      outputType === 'unknown' || inputType === 'unknown') {
    return true;
  }

  // Exact match
  if (outputType === inputType) {
    return true;
  }

  // Special compatibility rules
  switch (inputType) {
    case 'string':
      // Numbers and booleans can be converted to strings
      return ['number', 'boolean'].includes(outputType);
    
    case 'number':
      // Only numbers are compatible with number inputs
      return outputType === 'number';
    
    case 'boolean':
      // Only booleans are compatible with boolean inputs
      return outputType === 'boolean';
    
    case 'date':
      // Strings can be parsed as dates, dates are compatible
      return ['string', 'date'].includes(outputType);
    
    case 'array':
      // Only arrays are compatible with array inputs
      return outputType === 'array';
    
    case 'object':
      // Only objects are compatible with object inputs
      return outputType === 'object';
    
    default:
      return false;
  }
}

/**
 * Validates compatibility between object schemas
 * @param {SchemaInfo} outputSchema - The output schema info
 * @param {SchemaInfo} inputSchema - The input schema info
 * @returns {ValidationResult} Validation result
 */
function validateObjectCompatibility(outputSchema, inputSchema) {
  const result = { compatible: true, warnings: [], errors: [] };

  if (!outputSchema.properties || !inputSchema.properties) {
    result.warnings.push('Object schema properties not available for detailed validation');
    return result;
  }

  // Check if all required input properties are provided by output
  for (const [inputKey, inputProp] of Object.entries(inputSchema.properties)) {
    const outputProp = outputSchema.properties[inputKey];

    if (!outputProp) {
      if (!inputProp.optional) {
        result.errors.push(`Required input property '${inputKey}' is not provided by output schema`);
        result.compatible = false;
      } else {
        result.warnings.push(`Optional input property '${inputKey}' is not provided by output schema`);
      }
      continue;
    }

    // Recursively validate property compatibility
    const propResult = validateSchemaInfoCompatibility(outputProp, inputProp);
    result.warnings.push(...propResult.warnings.map(w => `Property '${inputKey}': ${w}`));
    result.errors.push(...propResult.errors.map(e => `Property '${inputKey}': ${e}`));
    
    if (!propResult.compatible) {
      result.compatible = false;
    }
  }

  return result;
}

/**
 * Validates compatibility between array schemas
 * @param {SchemaInfo} outputSchema - The output schema info
 * @param {SchemaInfo} inputSchema - The input schema info
 * @returns {ValidationResult} Validation result
 */
function validateArrayCompatibility(outputSchema, inputSchema) {
  const result = { compatible: true, warnings: [], errors: [] };

  if (!outputSchema.element || !inputSchema.element) {
    result.warnings.push('Array element schemas not available for detailed validation');
    return result;
  }

  // Validate element compatibility
  const elementResult = validateSchemaInfoCompatibility(outputSchema.element, inputSchema.element);
  result.warnings.push(...elementResult.warnings.map(w => `Array element: ${w}`));
  result.errors.push(...elementResult.errors.map(e => `Array element: ${e}`));
  
  if (!elementResult.compatible) {
    result.compatible = false;
  }

  return result;
}

/**
 * Validates compatibility between union schemas
 * @param {SchemaInfo} outputSchema - The output schema info
 * @param {SchemaInfo} inputSchema - The input schema info
 * @returns {ValidationResult} Validation result
 */
function validateUnionCompatibility(outputSchema, inputSchema) {
  const result = { compatible: false, warnings: [], errors: [] };

  // For union types, we need at least one compatible path
  if (outputSchema.type === 'union' && inputSchema.type === 'union') {
    // Both are unions - check if any output option is compatible with any input option
    for (const outputOption of outputSchema.union) {
      for (const inputOption of inputSchema.union) {
        const optionResult = validateSchemaInfoCompatibility(outputOption, inputOption);
        if (optionResult.compatible) {
          result.compatible = true;
          result.warnings.push('Union types have at least one compatible path');
          return result;
        }
      }
    }
    result.errors.push('No compatible path found between union types');
  } else if (outputSchema.type === 'union') {
    // Output is union, input is single type - check if any output option is compatible
    for (const outputOption of outputSchema.union) {
      const optionResult = validateSchemaInfoCompatibility(outputOption, inputSchema);
      if (optionResult.compatible) {
        result.compatible = true;
        result.warnings.push('Union output type has compatible option for input');
        return result;
      }
    }
    result.errors.push('No compatible option in union output type for input');
  } else if (inputSchema.type === 'union') {
    // Input is union, output is single type - check if output is compatible with any input option
    for (const inputOption of inputSchema.union) {
      const optionResult = validateSchemaInfoCompatibility(outputSchema, inputOption);
      if (optionResult.compatible) {
        result.compatible = true;
        result.warnings.push('Output type is compatible with at least one union input option');
        return result;
      }
    }
    result.errors.push('Output type is not compatible with any union input option');
  }

  return result;
}

/**
 * Validates compatibility between two schema info objects
 * @param {SchemaInfo} outputSchema - Schema info for the output type
 * @param {SchemaInfo} inputSchema - Schema info for the input type
 * @returns {ValidationResult} Validation result with compatibility status and messages
 */
function validateSchemaInfoCompatibility(outputSchema, inputSchema) {
  const result = { compatible: true, warnings: [], errors: [] };

  // Check nullability compatibility
  if (outputSchema.nullable && !inputSchema.nullable && !inputSchema.optional) {
    result.errors.push('Output can be null but input does not accept null values');
    result.compatible = false;
  }

  // Check optionality compatibility
  if (outputSchema.optional && !inputSchema.optional) {
    result.warnings.push('Output is optional but input is required - may cause runtime errors if output is undefined');
  }

  // Handle void/undefined types
  if (outputSchema.type === 'void' || outputSchema.type === 'undefined') {
    if (!inputSchema.optional) {
      result.errors.push('Output is void/undefined but input is required');
      result.compatible = false;
    }
    return result;
  }

  // Handle union types
  if (outputSchema.type === 'union' || inputSchema.type === 'union') {
    const unionResult = validateUnionCompatibility(outputSchema, inputSchema);
    result.compatible = unionResult.compatible;
    result.warnings.push(...unionResult.warnings);
    result.errors.push(...unionResult.errors);
    return result;
  }

  // Handle enum types
  if (outputSchema.type === 'enum' && inputSchema.type === 'enum') {
    const outputValues = new Set(outputSchema.enum);
    const inputValues = new Set(inputSchema.enum);
    const hasCommonValues = [...outputValues].some(v => inputValues.has(v));
    
    if (!hasCommonValues) {
      result.errors.push('Enum types have no common values');
      result.compatible = false;
    } else if (outputValues.size !== inputValues.size || ![...outputValues].every(v => inputValues.has(v))) {
      result.warnings.push('Enum types have different sets of values but some overlap');
    }
    return result;
  }

  // Handle literal types
  if (outputSchema.type === 'literal' && inputSchema.type === 'literal') {
    if (outputSchema.literal !== inputSchema.literal) {
      result.errors.push(`Literal values don't match: ${outputSchema.literal} !== ${inputSchema.literal}`);
      result.compatible = false;
    }
    return result;
  }

  // Handle basic type compatibility
  if (!areBasicTypesCompatible(outputSchema.type, inputSchema.type)) {
    result.errors.push(`Incompatible types: ${outputSchema.type} cannot be used as ${inputSchema.type}`);
    result.compatible = false;
    return result;
  }

  // Handle complex type validation
  if (outputSchema.type === 'object' && inputSchema.type === 'object') {
    const objectResult = validateObjectCompatibility(outputSchema, inputSchema);
    result.compatible = result.compatible && objectResult.compatible;
    result.warnings.push(...objectResult.warnings);
    result.errors.push(...objectResult.errors);
  } else if (outputSchema.type === 'array' && inputSchema.type === 'array') {
    const arrayResult = validateArrayCompatibility(outputSchema, inputSchema);
    result.compatible = result.compatible && arrayResult.compatible;
    result.warnings.push(...arrayResult.warnings);
    result.errors.push(...arrayResult.errors);
  }

  return result;
}

/**
 * Main function to validate compatibility between two Zod schemas
 * @param {import('zod').ZodSchema} outputSchema - The output schema
 * @param {import('zod').ZodSchema} inputSchema - The input schema
 * @returns {ValidationResult} Validation result
 */
export function validateZodTypeCompatibility(outputSchema, inputSchema) {
  if (!outputSchema || !inputSchema) {
    return {
      compatible: false,
      warnings: [],
      errors: ['One or both schemas are missing']
    };
  }

  try {
    const outputInfo = extractSchemaInfo(outputSchema);
    const inputInfo = extractSchemaInfo(inputSchema);
    
    return validateSchemaInfoCompatibility(outputInfo, inputInfo);
  } catch (error) {
    return {
      compatible: false,
      warnings: [],
      errors: [`Schema analysis failed: ${error.message}`]
    };
  }
}

/**
 * Validates that a schema exists and provides helpful information
 * @param {import('zod').ZodSchema} schema - The schema to validate
 * @param {string} context - Context for error messages (e.g., "node 'nodeId' input")
 * @returns {ValidationResult} Validation result
 */
export function validateSchemaExists(schema, context) {
  if (!schema) {
    return {
      compatible: true,
      warnings: [`${context} has no schema defined - type checking skipped`],
      errors: []
    };
  }

  return {
    compatible: true,
    warnings: [],
    errors: []
  };
}