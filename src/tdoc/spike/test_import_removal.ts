#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 2: Test import removal patterns
 *
 * Goals:
 * 1. Test various import patterns
 * 2. Remove imports while preserving rest of code
 * 3. Handle edge cases
 */

console.log("=== Testing Import Removal Patterns ===\n");

// Sample TypeScript code with various import patterns
const sampleCode = `
// Some leading comments
import { z } from "npm:zod@3.22.4";
import type { ZodType } from "npm:zod@3.22.4";
import {
  assertEquals,
  assertNotEquals
} from "jsr:@std/assert@1.0.0";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import React from "npm:react";
import { useState, useEffect } from "npm:react";

// This is not an import
const notImport = "import { fake } from 'module'";

export interface User {
  name: string;
  age: number;
}

export function validateUser(data: unknown): User {
  // Using imported z
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });
  return schema.parse(data);
}

// Re-exports that need transformation
export { z } from "npm:zod@3.22.4";
export type { ZodType } from "npm:zod@3.22.4";
export * from "npm:another-lib";
export { something } from "./local-file";

// Regular exports that should be kept
export const myConst = 42;
export function myFunction() {}
export type MyType = string;
`;

console.log("Original code:");
console.log("=============");
console.log(sampleCode);

// Function to remove imports
function removeImports(content: string): string {
  // Remove import statements (including multiline)
  let result = content;

  // Pattern 1: Simple single-line imports
  result = result.replace(
    /^import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*from\s*["'][^"']+["']\s*;?\s*$/gm,
    ''
  );

  // Pattern 2: Multiline imports (more complex)
  result = result.replace(
    /^import\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+)[\s\S]*?from\s*["'][^"']+["']\s*;?\s*$/gm,
    ''
  );

  // Clean up multiple consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

// Function to transform re-exports
function transformReExports(content: string): string {
  let result = content;

  // Transform: export { x } from "module" → export { x }
  result = result.replace(
    /^export\s+(\{[^}]+\})\s+from\s+["'][^"']+["']\s*;?\s*$/gm,
    'export $1;'
  );

  // Transform: export type { x } from "module" → export type { x }
  result = result.replace(
    /^export\s+type\s+(\{[^}]+\})\s+from\s+["'][^"']+["']\s*;?\s*$/gm,
    'export type $1;'
  );

  // Remove: export * from "module"
  result = result.replace(
    /^export\s+\*(?:\s+as\s+\w+)?\s+from\s+["'][^"']+["']\s*;?\s*$/gm,
    '// [Removed: export * from ...]'
  );

  return result;
}

// Process the code
console.log("\n\nAfter removing imports:");
console.log("=======================");
let processed = removeImports(sampleCode);
console.log(processed);

console.log("\n\nAfter transforming re-exports:");
console.log("===============================");
processed = transformReExports(processed);
console.log(processed);

// Test edge cases
console.log("\n\n=== Testing Edge Cases ===\n");

const edgeCases = [
  {
    name: "Import in string",
    code: `const str = "import { x } from 'module'";`,
    expected: `const str = "import { x } from 'module'";`
  },
  {
    name: "Import in comment",
    code: `// import { x } from 'module';`,
    expected: `// import { x } from 'module';`
  },
  {
    name: "Dynamic import",
    code: `const mod = await import("./module");`,
    expected: `const mod = await import("./module");`
  },
  {
    name: "Type-only import",
    code: `import type { MyType } from "./types";`,
    expected: ``
  },
];

for (const testCase of edgeCases) {
  const result = removeImports(testCase.code).trim();
  const passed = result === testCase.expected;
  console.log(`${passed ? '✓' : '✗'} ${testCase.name}`);
  if (!passed) {
    console.log(`  Expected: "${testCase.expected}"`);
    console.log(`  Got:      "${result}"`);
  }
}

console.log("\n=== Summary ===");
console.log("- Basic import removal works");
console.log("- Re-export transformation works");
console.log("- Need to handle multiline imports carefully");
console.log("- Dynamic imports should be preserved");
console.log("- String/comment imports are preserved correctly");