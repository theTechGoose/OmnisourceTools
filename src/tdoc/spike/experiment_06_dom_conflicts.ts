#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 6: DOM Global Conflicts
 * Test that Deno globals don't redefine DOM types that TypeScript already knows
 */

console.log("=== Experiment 6: DOM Global Conflicts ===\n");

// List of globals to test
const globalsToTest = [
  // DOM globals that TypeScript already knows - DON'T REDEFINE
  { name: "Response", isDom: true, shouldDefine: false },
  { name: "Request", isDom: true, shouldDefine: false },
  { name: "WebSocket", isDom: true, shouldDefine: false },
  { name: "URL", isDom: true, shouldDefine: false },
  { name: "URLSearchParams", isDom: true, shouldDefine: false },
  { name: "Headers", isDom: true, shouldDefine: false },
  { name: "FormData", isDom: true, shouldDefine: false },
  { name: "File", isDom: true, shouldDefine: false },
  { name: "Blob", isDom: true, shouldDefine: false },
  { name: "crypto", isDom: true, shouldDefine: false },
  { name: "console", isDom: true, shouldDefine: false },

  // Deno-specific globals - SHOULD DEFINE
  { name: "Deno.Command", isDom: false, shouldDefine: true },
  { name: "Deno.readTextFile", isDom: false, shouldDefine: true },
  { name: "Deno.writeTextFile", isDom: false, shouldDefine: true },
  { name: "Deno.serve", isDom: false, shouldDefine: true },
  { name: "Deno.env", isDom: false, shouldDefine: true },
  { name: "Deno.args", isDom: false, shouldDefine: true },
  { name: "Deno.exit", isDom: false, shouldDefine: true },
  { name: "Deno.errors", isDom: false, shouldDefine: true },
];

// Test TypeScript compilation with different global definitions
console.log("Testing TypeScript compilation with globals:\n");

// Test 1: With DOM conflicts (should fail)
console.log("1. WITH DOM CONFLICTS (redefining Response, WebSocket, etc.):\n");

const conflictingGlobals = `
// BAD: Redefining DOM globals
declare class Response {
  constructor(body?: any, init?: any);
}

declare class WebSocket {
  constructor(url: string);
}

// Using the redefined types
const res = new Response("Hello");
const ws = new WebSocket("ws://localhost");
`;

const tempFile1 = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile1, conflictingGlobals);

const tsc1 = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--lib", "ES2020,DOM", tempFile1],
  stdout: "piped",
  stderr: "piped",
});

const result1 = await tsc1.output();
if (result1.success) {
  console.log("⚠️  TypeScript accepted DOM redefinitions (unexpected)");
} else {
  console.log("✅ TypeScript rejected DOM redefinitions (expected)");
  const errors = new TextDecoder().decode(result1.stderr);
  // Show first error only
  const firstError = errors.split('\n').find(line => line.includes('error'));
  if (firstError) console.log(`   Error: ${firstError}`);
}

await Deno.remove(tempFile1);

// Test 2: Without DOM conflicts (should succeed)
console.log("\n2. WITHOUT DOM CONFLICTS (only Deno namespace):\n");

const correctGlobals = `
// GOOD: Only define Deno namespace, not DOM globals
declare namespace Deno {
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string): Promise<void>;
  export const args: string[];
  export const env: {
    get(key: string): string | undefined;
  };
  export function exit(code?: number): never;
  export const Command: any;
  export function serve(options: any, handler: any): any;
  export function upgradeWebSocket(req: any): any;
}

// DOM globals work without redefinition
const res = new Response("Hello");
const ws = new WebSocket("ws://localhost");

// Deno globals also work
const content = await Deno.readTextFile("file.txt");
`;

const tempFile2 = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile2, correctGlobals);

const tsc2 = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--lib", "ES2020,DOM", "--target", "ES2020", tempFile2],
  stdout: "piped",
  stderr: "piped",
});

const result2 = await tsc2.output();
if (result2.success) {
  console.log("✅ TypeScript accepted Deno namespace without DOM conflicts!");
} else {
  console.log("❌ TypeScript rejected even without DOM conflicts:");
  const errors = new TextDecoder().decode(result2.stderr);
  console.log(errors.slice(0, 200));
}

await Deno.remove(tempFile2);

// Generate the recommended Deno globals
console.log("\n3. RECOMMENDED DENO GLOBALS:\n");

const recommendedGlobals = `declare namespace Deno {
  // File system
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string, options?: { append?: boolean }): Promise<void>;
  export function readDir(path: string): AsyncIterable<any>;
  export function stat(path: string): Promise<any>;
  export function lstat(path: string): Promise<any>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function makeTempDir(): Promise<string>;

  // Process
  export const args: string[];
  export const env: {
    get(key: string): string | undefined;
  };
  export const execPath: () => string;
  export function exit(code?: number): never;

  // Commands
  export const Command: any;

  // Errors
  export const errors: {
    NotFound: any;
  };

  // IO
  export const stdin: {
    read(buffer: Uint8Array): Promise<number | null>;
  };

  // Server (without conflicting with DOM)
  export function serve(options: any, handler: any): any;
  export function upgradeWebSocket(req: any): any;
}

// For import.meta
declare const import: any;`;

console.log(recommendedGlobals);

// Summary
console.log("\n=== Summary ===");
console.log("Key findings:");
console.log("1. Never redefine DOM globals (Response, WebSocket, URL, etc.)");
console.log("2. TypeScript's DOM lib already includes these types");
console.log("3. Only define Deno namespace with Deno-specific APIs");
console.log("4. Must declare 'const import: any' for import.meta support");
console.log("5. Use 'any' for complex Deno types to keep stubs simple");