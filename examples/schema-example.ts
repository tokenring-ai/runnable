/**
 */

import {z} from "zod";
import {Runnable} from "../runnable.js";

// Define input and output schemas
const inputSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  age: z.number().int().min(0, "Age must be a positive integer").optional(),
  email: z.string().email("Must be a valid email address").optional(),
});

const outputSchema = z.object({
  greeting: z.string(),
  isAdult: z.boolean(),
  timestamp: z.number(),
});

// Create a concrete implementation of Runnable
export class GreetingRunnable extends Runnable {
  constructor() {
    super({
      name: "PersonalGreeting",
      description: "Creates personalized greetings with age validation",
      inputSchema,
      outputSchema,
    });
  }

  async* invoke(
    input: z.infer<typeof inputSchema>,
    context?: unknown,
  ): AsyncGenerator<
    {
      type: string;
      level: string;
      message: string;
      timestamp: number;
      runnableName: string;
    },
    z.infer<typeof outputSchema>,
    void
  > {
    // Validate input using the schema
    try {
      if (!this.inputSchema) {
        throw new Error("Input schema is not defined");
      }
      const validatedInput = this.inputSchema.parse(input);

      yield {
        type: "log",
        level: "info",
        message: `Processing greeting for ${validatedInput.name}`,
        timestamp: Date.now(),
        runnableName: this.name ?? "Unnamed",
      };

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create the output
      const result = {
        greeting: `Hello, ${validatedInput.name}!${validatedInput.email ? ` We'll contact you at ${validatedInput.email}.` : ""}`,
        isAdult: validatedInput.age ? validatedInput.age >= 18 : false,
        timestamp: Date.now(),
      };

      // Validate output using the schema
      if (!this.outputSchema) {
        throw new Error("Output schema is not defined");
      }
      const validatedOutput = this.outputSchema.parse(result);

      yield {
        type: "log",
        level: "info",
        message: "Greeting created successfully",
        timestamp: Date.now(),
        runnableName: this.name ?? "Unnamed",
      };

      return validatedOutput;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      yield {
        type: "log",
        level: "error",
        message: `Validation error: ${msg}`,
        timestamp: Date.now(),
        runnableName: this.name ?? "Unnamed",
      };
      throw error;
    }
  }
}

// Example usage
export async function demonstrateSchemaRunnable(): Promise<void> {
  const runnable = new GreetingRunnable();

  // Display help information
  console.log("=== RUNNABLE HELP ===");
  console.log(runnable.help());
  console.log("\n");

  // Test with valid input
  console.log("=== TESTING WITH VALID INPUT ===");
  const validInput = {
    name: "Alice",
    age: 25,
    email: "alice@example.com",
  };

  try {
    const generator = runnable.invoke(validInput, {});
    const events: any[] = [];
    let result;

    for await (const event of generator) {
      events.push(event);
      console.log("Event:", event);
    }

    // The generator's return value is available after iteration
    // In a real scenario, you'd need to handle this differently
    // For demo purposes, let's run it again to get the return value
    const gen2 = runnable.invoke(validInput, {});
    let next = await gen2.next();
    while (!next.done) {
      next = await gen2.next();
    }
    result = next.value;

    console.log("Final Result:", result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
  }

  console.log("\n=== TESTING WITH INVALID INPUT ===");
  const invalidInput = {
    name: "", // Empty name should fail validation
    age: -5, // Negative age should fail validation
    email: "not-an-email", // Invalid email format
  };

  try {
    const generator = runnable.invoke(invalidInput, {});
    for await (const event of generator) {
      console.log("Event:", event);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Expected validation error:", msg);
  }
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSchemaRunnable().catch(console.error);
}