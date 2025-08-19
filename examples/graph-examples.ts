/**
 */

import {RunnableGraph} from "../graph.js";
import {Runnable} from "../runnable.js";

// Example Runnable implementations for demonstrations

/**
 * A runnable that validates input data.
 */
class ValidationRunnable extends Runnable {
  rules: {
    required?: string[];
    minLength?: Record<string, number>;
  };

  constructor(rules = {}) {
    super({name: "Validator"});
    this.rules = rules;
  }

  async* invoke(input: any, context: any) {
    yield {
      type: "log",
      level: "info",
      message: "Starting validation",
      timestamp: Date.now(),
      runnableName: this.name,
    };

    const errors: string[] = [];

    if (this.rules.required) {
      for (const field of this.rules.required) {
        if (!input[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    if (this.rules.minLength) {
      for (const [field, minLen] of Object.entries(this.rules.minLength)) {
        if (input[field] && input[field].length < minLen) {
          errors.push(`Field ${field} must be at least ${minLen} characters`);
        }
      }
    }

    if (errors.length > 0) {
      yield {
        type: "error_event",
        error: {
          name: "ValidationError",
          message: errors.join(", "),
        },
        timestamp: Date.now(),
        runnableName: this.name,
      };
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    yield {
      type: "log",
      level: "info",
      message: "Validation passed",
      timestamp: Date.now(),
      runnableName: this.name,
    };

    return {...input, validated: true};
  }
}

/**
 * A runnable that transforms data.
 */
class TransformRunnable extends Runnable {
  transformFn: (input: any) => Promise<any> | any;

  constructor(name: string, transformFn: (input: any) => Promise<any> | any) {
    super({name});
    this.transformFn = transformFn;
  }

  async* invoke(input: any, context: any) {
    yield {
      type: "log",
      level: "info",
      message: `Transforming data with ${this.name}`,
      timestamp: Date.now(),
      runnableName: this.name,
    };

    const result = await this.transformFn(input);

    yield {
      type: "chunk",
      data: result,
      timestamp: Date.now(),
      runnableName: this.name,
    };

    return result;
  }
}

/**
 * A runnable that enriches data with external information.
 */
class EnrichmentRunnable extends Runnable {
  enrichmentSource: any;

  constructor(enrichmentSource: any) {
    super({name: "Enricher"});
    this.enrichmentSource = enrichmentSource;
  }

  async* invoke(input: any, context: any) {
    yield {
      type: "log",
      level: "info",
      message: "Starting data enrichment",
      timestamp: Date.now(),
      runnableName: this.name,
    };

    // Simulate async enrichment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const enrichedData = {
      ...input,
      enrichment: this.enrichmentSource,
      enrichedAt: new Date().toISOString(),
    };

    yield {
      type: "log",
      level: "info",
      message: "Data enrichment completed",
      timestamp: Date.now(),
      runnableName: this.name,
    };

    return enrichedData;
  }
}

/**
 * A runnable that aggregates multiple inputs.
 */
class AggregatorRunnable extends Runnable {
  strategy: string;

  constructor(aggregationStrategy = "merge") {
    super({name: "Aggregator"});
    this.strategy = aggregationStrategy;
  }

  async* invoke(input: any, context: any) {
    yield {
      type: "log",
      level: "info",
      message: `Aggregating data using ${this.strategy} strategy`,
      timestamp: Date.now(),
      runnableName: this.name,
    };

    let result: any;

    if (this.strategy === "merge") {
      result = Object.assign({}, ...Object.values(input));
    } else if (this.strategy === "array") {
      result = Object.values(input);
    } else if (this.strategy === "count") {
      result = {count: Object.keys(input).length, items: input};
    }

    yield {
      type: "log",
      level: "info",
      message: `Aggregation completed with ${Object.keys(result).length} properties`,
      timestamp: Date.now(),
      runnableName: this.name,
    };

    return result;
  }
}

/**
 * A runnable that splits data into multiple outputs.
 */
class SplitterRunnable extends Runnable {
  splitRules: Record<string, any>;

  constructor(splitRules: Record<string, any>) {
    super({name: "Splitter"});
    this.splitRules = splitRules;
  }

  async* invoke(input: any, context: any) {
    yield {
      type: "log",
      level: "info",
      message: "Splitting data into multiple outputs",
      timestamp: Date.now(),
      runnableName: this.name,
    };

    const outputs: Record<string, any> = {};

    for (const [outputKey, rule] of Object.entries(this.splitRules)) {
      if (typeof rule === "function") {
        outputs[outputKey] = rule(input);
      } else if (typeof rule === "string") {
        outputs[outputKey] = input[rule];
      } else {
        outputs[outputKey] = rule;
      }
    }

    yield {
      type: "log",
      level: "info",
      message: `Data split into ${Object.keys(outputs).length} outputs`,
      timestamp: Date.now(),
      runnableName: this.name,
    };

    return outputs;
  }
}

// Example 1: Simple Linear Pipeline
export async function simpleLinearPipeline(): Promise<any> {
  console.log("\n=== Simple Linear Pipeline Example ===");

  const validator = new ValidationRunnable({
    required: ["name", "email"],
    minLength: {name: 2, email: 5},
  });

  const transformer = new TransformRunnable("EmailNormalizer", (input) => ({
    ...input,
    email: input.email.toLowerCase().trim(),
    processedAt: new Date().toISOString(),
  }));

  const enricher = new EnrichmentRunnable("user-profile-service");

  const pipeline = RunnableGraph.builder({name: "UserProcessingPipeline"})
    .node("validator", validator)
    .node("transformer", transformer)
    .node("enricher", enricher)
    .connect("validator", "transformer")
    .connect("transformer", "enricher")
    .entry("validator")
    .exit("enricher")
    .build();

  const input = {
    name: "John Doe",
    email: "  JOHN.DOE@EXAMPLE.COM  ",
    age: 30,
  };

  console.log("Input:", input);

  try {
    const generator = pipeline.invoke(input);
    const events: any[] = [];
    let result;

    for await (const event of generator) {
      events.push(event);
      if (event.type === "log") {
        console.log(`[${event.level.toUpperCase()}] ${event.message}`);
      } else if (event.type === "chunk") {
        console.log("[CHUNK]", event.data);
      }
    }

    // Get the final result
    const finalResult = await generator.next();
    result = finalResult.done ? finalResult.value : result;

    console.log("Final Result:", result);
    return result;
  } catch (error) {
    console.error("Pipeline failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Example 2: Fan-out/Fan-in Pattern
export async function fanOutFanInPattern(): Promise<any> {
  console.log("\n=== Fan-out/Fan-in Pattern Example ===");

  const splitter = new SplitterRunnable({
    personalInfo: (input: any) => ({name: input.name, age: input.age}),
    contactInfo: (input: any) => ({email: input.email, phone: input.phone}),
    metadata: (input: any) => ({id: input.id, timestamp: Date.now()}),
  });

  const personalProcessor = new TransformRunnable(
    "PersonalProcessor",
    (input: any) => ({
      ...input,
      fullName: input.name.toUpperCase(),
      ageGroup: input.age < 18 ? "minor" : input.age < 65 ? "adult" : "senior",
    }),
  );

  const contactProcessor = new TransformRunnable(
    "ContactProcessor",
    (input: any) => ({
      ...input,
      emailDomain: input.email ? input.email.split("@")[1] : null,
      hasPhone: !!input.phone,
    }),
  );

  const metadataProcessor = new TransformRunnable(
    "MetadataProcessor",
    (input: any) => ({
      ...input,
      processedAt: new Date(input.timestamp).toISOString(),
      hash: `${input.id}-${input.timestamp}`,
    }),
  );

  const aggregator = new AggregatorRunnable("merge");

  const pipeline = RunnableGraph.builder({
    name: "FanOutFanInPipeline",
    parallel: true,
    maxConcurrency: 3,
  })
    .node("splitter", splitter, {
      outputs: ["personalInfo", "contactInfo", "metadata"],
    })
    .node("personalProcessor", personalProcessor)
    .node("contactProcessor", contactProcessor)
    .node("metadataProcessor", metadataProcessor)
    .node("aggregator", aggregator, {
      inputs: ["personal", "contact", "metadata"],
    })
    .connect("splitter", "personalProcessor", {fromOutput: "personalInfo"})
    .connect("splitter", "contactProcessor", {fromOutput: "contactInfo"})
    .connect("splitter", "metadataProcessor", {fromOutput: "metadata"})
    .connect("personalProcessor", "aggregator", {toInput: "personal"})
    .connect("contactProcessor", "aggregator", {toInput: "contact"})
    .connect("metadataProcessor", "aggregator", {toInput: "metadata"})
    .entry("splitter")
    .exit("aggregator")
    .build();

  const input = {
    id: "user-123",
    name: "Jane Smith",
    age: 28,
    email: "jane.smith@company.com",
    phone: "+1-555-0123",
  };

  console.log("Input:", input);

  try {
    const generator = pipeline.invoke(input);
    const events: any[] = [];
    let result;

    for await (const event of generator) {
      events.push(event);
      if (event.type === "log") {
        console.log(`[${event.nodeId || "GRAPH"}] ${event.message}`);
      }
    }

    const finalResult = await generator.next();
    result = finalResult.done ? finalResult.value : result;

    console.log("Final Result:", result);
    return result;
  } catch (error) {
    console.error("Pipeline failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Example 3: Conditional Processing with Error Handling
export async function conditionalProcessingWithErrorHandling(): Promise<void> {
  console.log("\n=== Conditional Processing with Error Handling Example ===");

  const validator = new ValidationRunnable({
    required: ["type", "data"],
  });

  const typeAProcessor = new TransformRunnable("TypeAProcessor", (input: any) => {
    if (input.type !== "A") throw new Error("Not type A");
    return {
      ...input,
      processedBy: "TypeAProcessor",
      result: input.data.toUpperCase(),
    };
  });

  const typeBProcessor = new TransformRunnable("TypeBProcessor", (input: any) => {
    if (input.type !== "B") throw new Error("Not type B");
    return {
      ...input,
      processedBy: "TypeBProcessor",
      result: input.data.toLowerCase(),
    };
  });

  const fallbackProcessor = new TransformRunnable(
    "FallbackProcessor",
    (input: any) => ({
      ...input,
      processedBy: "FallbackProcessor",
      result: `Unknown type: ${input.type}`,
    }),
  );

  const aggregator = new AggregatorRunnable("merge");

  const pipeline = RunnableGraph.builder({
    name: "ConditionalPipeline",
    continueOnError: true,
  })
    .node("validator", validator)
    .node("typeAProcessor", typeAProcessor, {optional: true})
    .node("typeBProcessor", typeBProcessor, {optional: true})
    .node("fallbackProcessor", fallbackProcessor)
    .node("aggregator", aggregator, {inputs: ["typeA", "typeB", "fallback"]})
    .connect("validator", "typeAProcessor")
    .connect("validator", "typeBProcessor")
    .connect("validator", "fallbackProcessor")
    .connect("typeAProcessor", "aggregator", {toInput: "typeA"})
    .connect("typeBProcessor", "aggregator", {toInput: "typeB"})
    .connect("fallbackProcessor", "aggregator", {toInput: "fallback"})
    .entry("validator")
    .exit("aggregator")
    .build();

  const testCases = [
    {type: "A", data: "hello world"},
    {type: "B", data: "HELLO WORLD"},
    {type: "C", data: "unknown type"},
  ];

  for (const input of testCases) {
    console.log(`\nProcessing input:`, input);

    try {
      const generator = pipeline.invoke(input);
      const events: any[] = [];
      let result;

      for await (const event of generator) {
        events.push(event);
        if (event.type === "log") {
          console.log(`[${event.nodeId || "GRAPH"}] ${event.message}`);
        } else if (event.type === "error_event") {
          console.log(`[ERROR] ${event.error.message}`);
        }
      }

      const finalResult = await generator.next();
      result = finalResult.done ? finalResult.value : result;

      console.log("Result:", result);
    } catch (error) {
      console.error("Pipeline failed:", error instanceof Error ? error.message : String(error));
    }
  }
}

// Example 4: Real-world Data Processing Pipeline
export async function realWorldDataProcessingPipeline(): Promise<any> {
  console.log("\n=== Real-world Data Processing Pipeline Example ===");

  // Simulate a data processing pipeline for e-commerce orders
  const orderValidator = new ValidationRunnable({
    required: ["orderId", "customerId", "items", "total"],
    minLength: {orderId: 5, customerId: 3},
  });

  const inventoryChecker = new TransformRunnable(
    "InventoryChecker",
    async (input: any) => {
      // Simulate inventory check
      await new Promise((resolve) => setTimeout(resolve, 50));
      const availableItems = input.items.map((item: any) => ({
        ...item,
        available: Math.random() > 0.1, // 90% availability
      }));
      return {...input, items: availableItems, inventoryChecked: true};
    },
  );

  const priceCalculator = new TransformRunnable("PriceCalculator", (input: any) => {
    const subtotal = input.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );
    const tax = subtotal * 0.08;
    const shipping = subtotal > 100 ? 0 : 10;
    const total = subtotal + tax + shipping;

    return {
      ...input,
      pricing: {subtotal, tax, shipping, total},
      priceCalculated: true,
    };
  });

  const paymentProcessor = new TransformRunnable(
    "PaymentProcessor",
    async (input: any) => {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      const paymentSuccess = Math.random() > 0.05; // 95% success rate

      if (!paymentSuccess) {
        throw new Error("Payment processing failed");
      }

      return {
        ...input,
        payment: {
          status: "completed",
          transactionId: `txn_${Date.now()}`,
          processedAt: new Date().toISOString(),
        },
      };
    },
  );

  const fulfillmentPrep = new TransformRunnable("FulfillmentPrep", (input: any) => ({
    ...input,
    fulfillment: {
      status: "ready",
      warehouse: "WH-001",
      estimatedShipDate: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
  }));

  const notificationSender = new TransformRunnable(
    "NotificationSender",
    async (input: any) => {
      // Simulate sending notifications
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        ...input,
        notifications: {
          customerNotified: true,
          warehouseNotified: true,
          sentAt: new Date().toISOString(),
        },
      };
    },
  );

  const orderFinalizer = new AggregatorRunnable("merge");

  const pipeline = RunnableGraph.builder({
    name: "OrderProcessingPipeline",
    parallel: true,
    maxConcurrency: 2,
  })
    .node("validator", orderValidator)
    .node("inventoryChecker", inventoryChecker)
    .node("priceCalculator", priceCalculator)
    .node("paymentProcessor", paymentProcessor)
    .node("fulfillmentPrep", fulfillmentPrep)
    .node("notificationSender", notificationSender)
    .node("finalizer", orderFinalizer, {
      inputs: ["fulfillment", "notification"],
    })
    .connect("validator", "inventoryChecker")
    .connect("inventoryChecker", "priceCalculator")
    .connect("priceCalculator", "paymentProcessor")
    .connect("paymentProcessor", "fulfillmentPrep")
    .connect("paymentProcessor", "notificationSender")
    .connect("fulfillmentPrep", "finalizer", {toInput: "fulfillment"})
    .connect("notificationSender", "finalizer", {toInput: "notification"})
    .entry("validator")
    .exit("finalizer")
    .build();

  const sampleOrder = {
    orderId: "ORD-12345",
    customerId: "CUST-789",
    items: [
      {id: "ITEM-001", name: "Widget A", price: 29.99, quantity: 2},
      {id: "ITEM-002", name: "Widget B", price: 49.99, quantity: 1},
    ],
    total: 109.97,
    customerEmail: "customer@example.com",
  };

  console.log("Processing order:", sampleOrder);

  try {
    const startTime = Date.now();
    const generator = pipeline.invoke(sampleOrder);
    const events: any[] = [];
    let result;

    for await (const event of generator) {
      events.push(event);
      if (event.type === "log") {
        console.log(`[${event.nodeId || "GRAPH"}] ${event.message}`);
      } else if (event.type === "error_event") {
        console.log(`[ERROR] ${event.error.message}`);
      }
    }

    const finalResult = await generator.next();
    result = finalResult.done ? finalResult.value : result;
    const endTime = Date.now();

    console.log(`\nOrder processing completed in ${endTime - startTime}ms`);
    console.log("Final Result:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("Order processing failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Main function to run all examples
export async function runAllExamples(): Promise<void> {
  try {
    await simpleLinearPipeline();
    await fanOutFanInPattern();
    await conditionalProcessingWithErrorHandling();
    await realWorldDataProcessingPipeline();

    console.log("\n=== All examples completed successfully! ===");
  } catch (error) {
    console.error("Example execution failed:", error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // noinspection JSIgnoredPromiseFromCall
  runAllExamples();
}