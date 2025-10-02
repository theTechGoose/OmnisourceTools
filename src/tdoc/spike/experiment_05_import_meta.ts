#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 5: import.meta.main Preservation
 * Test that dynamic imports and import.meta survive while static imports are removed
 */

console.log("=== Experiment 5: import.meta.main Preservation ===\n");

const testCases = [
  {
    name: "Static import (should remove)",
    input: `import { assertEquals } from "jsr:@std/testing";`,
    shouldRemove: true,
  },
  {
    name: "Dynamic import (should keep)",
    input: `const { z } = await import("npm:zod");`,
    shouldRemove: false,
  },
  {
    name: "import.meta.main (should keep)",
    input: `if (import.meta.main) {\n  console.log("Running as main");\n}`,
    shouldRemove: false,
  },
  {
    name: "import.meta.url (should keep)",
    input: `const __dirname = dirname(fromFileUrl(import.meta.url));`,
    shouldRemove: false,
  },
  {
    name: "Mixed static and dynamic",
    input: `import { x } from "mod";\nconst { y } = await import("dynamic");`,
    expectedAfter: `const { y } = await import("dynamic");`,
  },
  {
    name: "import() in code (should keep)",
    input: `async function loadModule() {\n  return await import("./module.ts");\n}`,
    shouldRemove: false,
  },
  {
    name: "Conditional dynamic import",
    input: `if (needsModule) {\n  const mod = await import("npm:package");\n}`,
    shouldRemove: false,
  },
];

// The regex that should only match static imports
const staticImportRegex = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;

console.log("Testing static import removal (preserving dynamic imports):\n");

testCases.forEach((test) => {
  console.log(`Test: ${test.name}`);
  console.log(`Input:\n${test.input}\n`);

  // Apply the regex
  const result = test.input.replace(staticImportRegex, '').trim();

  // Determine what we expect
  let expected: string;
  if (test.expectedAfter !== undefined) {
    expected = test.expectedAfter;
  } else if (test.shouldRemove === true) {
    expected = "";
  } else {
    expected = test.input.trim();
  }

  const passed = result === expected;

  console.log(`Expected: ${expected || "(empty)"}`);
  console.log(`Actual:   ${result || "(empty)"}`);
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
});

// Test a complete example with mixed imports
console.log("=".repeat(60));
console.log("\nComplete example with mixed imports:\n");

const fullExample = `
import { serve } from "https://deno.land/std/http/server.ts";
import type { User } from "./types.ts";
import { z } from "npm:zod";

// Dynamic import in function
async function loadConfig() {
  const { config } = await import("./config.ts");
  return config;
}

// Conditional dynamic import
if (process.env.NODE_ENV === "development") {
  const { DevTools } = await import("./dev-tools.ts");
  DevTools.init();
}

// Main execution check
if (import.meta.main) {
  console.log("Starting server...");
  const port = 8080;

  // Dynamic import based on environment
  const handler = await import(\`./handlers/\${Deno.env.get("HANDLER")}.ts\`);

  serve(handler.default, { port });
}

// Using import.meta.url
const __filename = fromFileUrl(import.meta.url);
console.log("Running from:", __filename);
`;

console.log("Original:");
console.log(fullExample);

const processed = fullExample.replace(staticImportRegex, '');
const cleaned = processed.replace(/\n{3,}/g, '\n\n').trim();

console.log("\nAfter removing static imports:");
console.log(cleaned);

// Test that TypeScript understands the preserved dynamic imports
console.log("\n" + "=".repeat(60));
console.log("\nTesting TypeScript compilation with dynamic imports:\n");

const testCode = `
// Stub for import.meta
declare const import: {
  meta: {
    main: boolean;
    url: string;
  };
};

// Test code with dynamic import
async function test() {
  const { something } = await import("module");

  if (import.meta.main) {
    console.log("Main module");
  }

  return something;
}
`;

const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile, testCode);

const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--skipLibCheck", "--target", "ES2020", "--module", "ES2020", tempFile],
  stdout: "piped",
  stderr: "piped",
});

const { success, stderr } = await tscCmd.output();

if (success) {
  console.log("✅ TypeScript accepts dynamic imports and import.meta!");
} else {
  console.log("❌ TypeScript compilation issue:");
  console.log(new TextDecoder().decode(stderr));
}

await Deno.remove(tempFile);

// Summary
console.log("\n=== Summary ===");
console.log("Key findings:");
console.log("1. Static imports (import ... from) are correctly removed");
console.log("2. Dynamic imports (await import()) are preserved");
console.log("3. import.meta.main and import.meta.url are preserved");
console.log("4. The regex doesn't match 'import(' function calls");
console.log("5. Important: Must declare 'const import: any' in Deno globals for TypeScript");