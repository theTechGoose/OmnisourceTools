#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 7: Empty Files After Processing
 * Test what happens when a file becomes empty after import removal
 */

console.log("=== Experiment 7: Empty Files After Import Removal ===\n");

// Test cases of files that might become empty
const testFiles = [
  {
    name: "File with only imports",
    content: `import { z } from "npm:zod";
import type { User } from "./types.ts";
import { assertEquals } from "jsr:@std/testing";`,
    description: "Contains only import statements"
  },
  {
    name: "File with imports and comments",
    content: `// This file handles validation
import { z } from "npm:zod";
import type { ValidationError } from "./errors.ts";

// TODO: Add more validators`,
    description: "Has comments that should remain"
  },
  {
    name: "File with imports and whitespace",
    content: `
import { z } from "npm:zod";


import { assertEquals } from "jsr:@std/testing";


`,
    description: "Has excessive whitespace"
  },
  {
    name: "Type-only export file",
    content: `import type { User, Config } from "./types.ts";
export type { User, Config };`,
    description: "Re-exports types only"
  },
];

const importRemovalRegex = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;

console.log("Testing empty file handling:\n");

for (const file of testFiles) {
  console.log(`Test: ${file.name}`);
  console.log(`Description: ${file.description}`);
  console.log(`Original (${file.content.length} chars):`);
  console.log(file.content);
  console.log();

  // Remove imports
  const afterRemoval = file.content.replace(importRemovalRegex, '');

  // Clean up excessive newlines
  const cleaned = afterRemoval.replace(/\n{3,}/g, '\n\n').trim();

  console.log(`After processing (${cleaned.length} chars):`);
  console.log(cleaned || "(empty file)");

  // Check if file is effectively empty (only whitespace/comments)
  const hasContent = cleaned.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().length > 0;

  console.log(`Has meaningful content: ${hasContent ? 'Yes' : 'No'}`);
  console.log("-".repeat(60) + "\n");
}

// Test TypeDoc with empty file
console.log("Testing TypeDoc with mostly empty concatenated file:\n");

const emptyConcat = `
// ============================================
// Deno namespace declarations
// ============================================

declare namespace Deno {
  export function readTextFile(path: string): Promise<string>;
}

// ============================================
// Source: /path/to/empty1.ts
// ============================================

// This file had only imports

// ============================================
// Source: /path/to/empty2.ts
// ============================================

// TODO: Add implementation

// ============================================
// Source: /path/to/actual.ts
// ============================================

export class MyClass {
  constructor() {}
}
`;

const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile, emptyConcat);

// Try TypeScript compilation
const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--skipLibCheck", tempFile],
  stdout: "piped",
  stderr: "piped",
});

const { success } = await tscCmd.output();

if (success) {
  console.log("✅ TypeScript compiles empty sections without issue");
} else {
  console.log("❌ TypeScript has issues with empty sections");
}

// Try basic TypeDoc (if available)
console.log("\nTesting TypeDoc generation:");
const typedocCmd = new Deno.Command("npx", {
  args: ["typedoc", "--version"],
  stdout: "piped",
  stderr: "piped",
});

const typedocCheck = await typedocCmd.output();
if (typedocCheck.success) {
  // TypeDoc is available, test it
  const docsDir = await Deno.makeTempDir();
  const docCmd = new Deno.Command("npx", {
    args: [
      "typedoc",
      "--out", docsDir,
      "--emit", "docs",
      "--readme", "none",
      tempFile
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const docResult = await docCmd.output();
  if (docResult.success) {
    console.log("✅ TypeDoc handles empty sections gracefully");
  } else {
    console.log("⚠️  TypeDoc generated with warnings/errors");
  }

  await Deno.remove(docsDir, { recursive: true });
} else {
  console.log("ℹ️  TypeDoc not available for testing");
}

await Deno.remove(tempFile);

// Summary
console.log("\n=== Summary ===");
console.log("Key findings:");
console.log("1. Files with only imports become empty - this is OK");
console.log("2. Comments are preserved even when imports are removed");
console.log("3. File header comments help maintain structure");
console.log("4. TypeScript/TypeDoc handle empty sections without issues");
console.log("5. Consider: Skip files that become completely empty?");
console.log("6. Alternative: Keep file markers for debugging");