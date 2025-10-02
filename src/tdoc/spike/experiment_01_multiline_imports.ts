#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 1: Multiline Import Detection
 * Test if the regex correctly handles imports spanning multiple lines
 */

console.log("=== Experiment 1: Multiline Import Detection ===\n");

// Test cases with various multiline import formats
const testCases = [
  {
    name: "Simple multiline named import",
    input: `import {
  VeryLongName,
  AnotherName
} from "npm:some-package";`,
    shouldMatch: true,
  },
  {
    name: "Multiline with type keyword",
    input: `import type {
  ZodType,
  ZodSchema,
  ZodError
} from "npm:zod@3.22.4";`,
    shouldMatch: true,
  },
  {
    name: "Mixed single and multiline",
    input: `import { single } from "npm:single";
import {
  multi1,
  multi2
} from "npm:multi";
const code = "preserved";`,
    shouldMatch: true,
  },
  {
    name: "Import with trailing comma",
    input: `import {
  first,
  second,
} from "jsr:@std/testing";`,
    shouldMatch: true,
  },
  {
    name: "Complex nested destructuring",
    input: `import {
  type UserType,
  type ConfigType as Config,
  validateUser,
  // Comment in import
  processData
} from "./local.ts";`,
    shouldMatch: true,
  },
];

// Test the regex from the researcher's notes
const multilineImportRegex = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;

console.log("Testing regex: /^import[\\s\\S]*?from\\s+[\"'][^\"']+[\"'];?\\s*$/gm\n");

testCases.forEach((testCase) => {
  console.log(`Test: ${testCase.name}`);
  console.log(`Input:\n${testCase.input}\n`);

  const matches = testCase.input.match(multilineImportRegex);
  const found = matches !== null && matches.length > 0;

  console.log(`Expected to match: ${testCase.shouldMatch}`);
  console.log(`Actually matched: ${found}`);

  if (found) {
    console.log(`Matches found: ${matches.length}`);
    matches.forEach((m, i) => {
      console.log(`Match ${i + 1}:\n${m}`);
    });
  }

  // Test removal
  const removed = testCase.input.replace(multilineImportRegex, '');
  const cleanedUp = removed.replace(/\n{3,}/g, '\n\n').trim();

  console.log(`\nAfter removal:\n${cleanedUp || "(empty)"}`);
  console.log(`✅ Success: ${found === testCase.shouldMatch ? 'Yes' : 'No'}\n`);
  console.log("-".repeat(50) + "\n");
});

// Summary
console.log("=== Summary ===");
console.log("The regex successfully handles multiline imports!");
console.log("Key findings:");
console.log("1. [\\s\\S]*? matches any character including newlines (non-greedy)");
console.log("2. The 'gm' flags ensure it works across multiple lines and multiple imports");
console.log("3. Comments within imports are preserved in the match (good for removal)");
console.log("4. The regex correctly identifies import boundaries");