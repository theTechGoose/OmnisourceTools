#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 4: Re-export Edge Cases
 * Test how different re-export patterns should be transformed
 */

console.log("=== Experiment 4: Re-export Edge Cases ===\n");

// Test cases for re-export transformations
const testCases = [
  {
    name: "export * from local file",
    input: `export * from "./local.ts";`,
    expected: `export * from "./local.ts";`, // Keep local
    reason: "Local re-exports should be preserved"
  },
  {
    name: "export * from npm",
    input: `export * from "npm:zod";`,
    expected: `// [Removed: export * from external module]`,
    reason: "External star exports can't be transformed safely"
  },
  {
    name: "export named from npm",
    input: `export { ZodType, ZodError } from "npm:zod@3.22.4";`,
    expected: `export { ZodType, ZodError };`,
    reason: "Named exports can be transformed to regular exports"
  },
  {
    name: "export type from npm",
    input: `export type { UserType, ConfigType } from "npm:my-types";`,
    expected: `export type { UserType, ConfigType };`,
    reason: "Type exports can be transformed"
  },
  {
    name: "export with rename from npm",
    input: `export { validate as validateUser } from "jsr:@std/validation";`,
    expected: `export { validate as validateUser };`,
    reason: "Renamed exports preserve the alias"
  },
  {
    name: "mixed local and external",
    input: `export { localFunc } from "./local.ts";\nexport { external } from "npm:package";`,
    expected: `export { localFunc } from "./local.ts";\nexport { external };`,
    reason: "Local preserved, external transformed"
  },
  {
    name: "export * as namespace",
    input: `export * as zod from "npm:zod";`,
    expected: `// [Removed: export * from external module]`,
    reason: "Namespace exports from external can't be safely transformed"
  },
  {
    name: "default re-export",
    input: `export { default as MyDefault } from "npm:some-lib";`,
    expected: `export { default as MyDefault };`,
    reason: "Default re-exports can be transformed"
  },
];

// Transform function based on researcher's notes
function transformReExports(code: string): string {
  let result = code;

  // Transform: export { x } from "external" → export { x }
  result = result.replace(
    /^export\s+(\{[^}]+\})\s+from\s+["'](?:npm:|jsr:|https:\/\/)[^"']+["'];?\s*$/gm,
    'export $1;'
  );

  // Transform: export type { x } from "external" → export type { x }
  result = result.replace(
    /^export\s+type\s+(\{[^}]+\})\s+from\s+["'](?:npm:|jsr:|https:\/\/)[^"']+["'];?\s*$/gm,
    'export type $1;'
  );

  // Remove: export * from "external" (can't be transformed safely)
  result = result.replace(
    /^export\s+\*(?:\s+as\s+\w+)?\s+from\s+["'](?:npm:|jsr:|https:\/\/)[^"']+["'];?\s*$/gm,
    '// [Removed: export * from external module]'
  );

  return result;
}

// Test the transformation
console.log("Testing re-export transformation:\n");

let passCount = 0;
let totalCount = 0;

testCases.forEach((testCase) => {
  console.log(`Test: ${testCase.name}`);
  console.log(`Input:  ${testCase.input}`);

  const actual = transformReExports(testCase.input);

  console.log(`Expected: ${testCase.expected}`);
  console.log(`Actual:   ${actual}`);

  const passed = actual === testCase.expected;
  passCount += passed ? 1 : 0;
  totalCount++;

  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Reason: ${testCase.reason}\n`);
});

console.log("=".repeat(60));
console.log(`Results: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount * 100)}%)\n`);

// Test a complete example
console.log("Complete example transformation:\n");

const fullExample = `
// This file has various re-exports
export { User, type UserConfig } from "./models/user.ts";
export * from "./utils/helpers.ts";
export { z, ZodType } from "npm:zod@3.22.4";
export type { ZodError, ZodSchema } from "npm:zod@3.22.4";
export * from "npm:some-external-lib";
export * as validation from "jsr:@std/validation";
export { default as logger } from "./logger.ts";
`;

console.log("Original:");
console.log(fullExample);

const transformed = transformReExports(fullExample);
console.log("\nTransformed:");
console.log(transformed);

// Summary
console.log("\n=== Summary ===");
console.log("Key findings:");
console.log("1. Local re-exports (./file) must be preserved");
console.log("2. Named exports from external can be transformed to regular exports");
console.log("3. 'export *' from external modules must be removed (can't determine what to export)");
console.log("4. Type exports work the same as value exports");
console.log("5. The regex must distinguish between local and external modules");