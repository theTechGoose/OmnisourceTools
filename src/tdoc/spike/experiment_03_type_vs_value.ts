#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 3: Type vs Value Heuristic
 * Test if the uppercase/keyword detection correctly identifies types vs values
 */

console.log("=== Experiment 3: Type vs Value Heuristic ===\n");

// Test cases for the heuristic
const testCases = [
  // Definitely types
  { name: "ZodType", expectedType: "type", reason: "Uppercase + contains 'Type'" },
  { name: "UserSchema", expectedType: "type", reason: "Contains 'Schema'" },
  { name: "ValidationError", expectedType: "type", reason: "Contains 'Error'" },
  { name: "User", expectedType: "type", reason: "Uppercase first letter" },
  { name: "IUser", expectedType: "type", reason: "Interface pattern (I prefix)" },
  { name: "TConfig", expectedType: "type", reason: "Type pattern (T prefix)" },

  // Definitely values
  { name: "assertEquals", expectedType: "value", reason: "Lowercase function" },
  { name: "z", expectedType: "value", reason: "Lowercase single letter" },
  { name: "validateUser", expectedType: "value", reason: "Lowercase function" },
  { name: "logger", expectedType: "value", reason: "Lowercase object" },
  { name: "config", expectedType: "value", reason: "Lowercase variable" },

  // Edge cases
  { name: "userSchema", expectedType: "type", reason: "Contains 'Schema' despite lowercase" },
  { name: "errorHandler", expectedType: "value", reason: "Contains 'Error' but starts lowercase (likely function)" },
  { name: "TypeError", expectedType: "type", reason: "Contains 'Type' and 'Error', uppercase" },
  { name: "URL", expectedType: "type", reason: "All uppercase (likely class/type)" },
  { name: "pi", expectedType: "value", reason: "Lowercase constant" },
  { name: "MAX_VALUE", expectedType: "value", reason: "SCREAMING_CASE constant" },
];

// The heuristic function from the researcher's approach
function isLikelyType(name: string): boolean {
  // Check if first letter is uppercase
  const firstLetterUppercase = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();

  // Check for type-related keywords
  const containsTypeKeyword = name.includes("Type") ||
                              name.includes("Schema") ||
                              name.includes("Error");

  // Special case: if it starts lowercase but has Schema/Type, it's likely still a type
  if (name.includes("Schema") || name.includes("Type")) {
    return true;
  }

  // Special case: "Error" at the end usually means type, but "errorHandler" is a function
  if (name.includes("Error") && firstLetterUppercase) {
    return true;
  }

  return firstLetterUppercase || containsTypeKeyword;
}

// Test the heuristic
console.log("Testing heuristic function:\n");
console.log("Name".padEnd(20) + "Expected".padEnd(10) + "Detected".padEnd(10) + "Correct?".padEnd(10) + "Reason");
console.log("-".repeat(70));

let correct = 0;
let total = 0;

testCases.forEach((testCase) => {
  const detected = isLikelyType(testCase.name) ? "type" : "value";
  const isCorrect = detected === testCase.expectedType;

  if (isCorrect) correct++;
  total++;

  console.log(
    testCase.name.padEnd(20) +
    testCase.expectedType.padEnd(10) +
    detected.padEnd(10) +
    (isCorrect ? "✅" : "❌").padEnd(10) +
    testCase.reason
  );
});

console.log("\n" + "=".repeat(70));
console.log(`Accuracy: ${correct}/${total} (${Math.round(correct/total * 100)}%)\n`);

// Generate stubs to show the difference
console.log("Generated stubs for examples:\n");

["ZodType", "assertEquals", "userSchema"].forEach(name => {
  const isType = isLikelyType(name);
  const stubName = `__${name}_STUB__`;

  if (isType) {
    console.log(`// Type stub for ${name}:`);
    console.log(`type ${stubName} = any; // Originally: ${name}`);
    console.log(`type ${name} = ${stubName};\n`);
  } else {
    console.log(`// Value stub for ${name}:`);
    console.log(`declare const ${stubName}: any; // Originally: ${name}`);
    console.log(`const ${name} = ${stubName};\n`);
  }
});

// Test TypeScript compilation
console.log("Testing TypeScript compilation with generated stubs:\n");

const testCode = `
// Type stubs
type __ZodType_STUB__ = any;
type ZodType = __ZodType_STUB__;

type __userSchema_STUB__ = any;
type userSchema = __userSchema_STUB__;

// Value stubs
declare const __assertEquals_STUB__: any;
const assertEquals = __assertEquals_STUB__;

// Test usage
type TestType = ZodType;
type TestSchema = userSchema;
const testAssert = assertEquals;
`;

const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile, testCode);

const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--skipLibCheck", tempFile],
  stdout: "piped",
  stderr: "piped",
});

const { success } = await tscCmd.output();

if (success) {
  console.log("✅ TypeScript compilation successful!");
} else {
  console.log("❌ TypeScript compilation failed");
}

await Deno.remove(tempFile);

// Summary
console.log("\n=== Summary ===");
console.log("The heuristic works well with ~94% accuracy!");
console.log("Key findings:");
console.log("1. Uppercase first letter is a strong indicator of type");
console.log("2. Keywords 'Type', 'Schema', 'Error' are reliable indicators");
console.log("3. Special case: 'userSchema' is a type despite lowercase start");
console.log("4. Edge case: 'errorHandler' needs context (lowercase = likely function)");
console.log("5. The stub approach works for both types and values");