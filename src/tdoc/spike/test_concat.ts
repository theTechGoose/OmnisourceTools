#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment: Complete concatenation pipeline
 *
 * Goals:
 * 1. Use deno info to get all dependencies
 * 2. Concatenate local files with imports removed
 * 3. Add type stubs for external deps
 * 4. Add Deno globals
 * 5. Test if TypeDoc can process the output
 */

import { join, fromFileUrl, resolve, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";

const SPIKE_DIR = new URL(".", import.meta.url).pathname;
const EXAMPLE_FILE = join(SPIKE_DIR, "example.ts");
const OUTPUT_FILE = join(SPIKE_DIR, "concatenated.ts");

console.log("=== Complete Concatenation Pipeline ===\n");

// Get git root (simplified for spike)
async function getGitRoot(): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await cmd.output();
  return new TextDecoder().decode(stdout).trim();
}

// Remove imports function
function removeImports(content: string): string {
  // Remove single-line imports
  let result = content.replace(
    /^import\s+(?:type\s+)?[\s\S]*?from\s*["'][^"']+["']\s*;?\s*$/gm,
    ''
  );

  // Better multiline import handling
  // Match from 'import' to the ending semicolon or newline after the quote
  result = result.replace(
    /^import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?\s*$/gm,
    ''
  );

  return result;
}

// Transform re-exports
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
    ''
  );

  return result;
}

// Step 1: Get dependency info
console.log("1. Getting dependency information...");
const cmd = new Deno.Command("deno", {
  args: ["info", "--json", EXAMPLE_FILE],
  stdout: "piped",
  stderr: "piped",
});

const { stdout } = await cmd.output();
const info = JSON.parse(new TextDecoder().decode(stdout));
console.log(`   Found ${info.modules?.length || 0} modules`);

// Step 2: Categorize dependencies
const rootAbs = await getGitRoot();
const localFiles: string[] = [];
const externalDeps = new Set<string>();

for (const module of info.modules || []) {
  if (module.local && module.local.startsWith("file://")) {
    const localPath = fromFileUrl(module.local);

    // Check if it's a local project file
    if (localPath.startsWith(rootAbs + "/") || localPath === rootAbs) {
      if (!localPath.includes("/node_modules/")) {
        if (localPath.endsWith(".ts") || localPath.endsWith(".tsx")) {
          localFiles.push(localPath);
        }
      }
    }
  } else if (module.specifier) {
    // Track external dependency
    if (module.specifier.startsWith("npm:") ||
        module.specifier.startsWith("jsr:") ||
        module.specifier.startsWith("https://")) {
      externalDeps.add(module.specifier);
    }
  }
}

console.log(`   Local files: ${localFiles.length}`);
console.log(`   External dependencies: ${externalDeps.size}`);

// Step 3: Generate type stubs for external deps
console.log("\n2. Generating type stubs...");
let typeStubs = `// ============================================
// Type stubs for external dependencies
// ============================================

`;

// Analyze what's imported from external deps
const importsFromExternal = new Map<string, Set<string>>();

// Read the example file to see what's imported
const exampleContent = await Deno.readTextFile(EXAMPLE_FILE);
const importRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+["']([^"']+)["']/g;
let match;

while ((match = importRegex.exec(exampleContent)) !== null) {
  const [, namedImports, defaultImport, namespaceImport, moduleSpecifier] = match;

  if (!importsFromExternal.has(moduleSpecifier)) {
    importsFromExternal.set(moduleSpecifier, new Set());
  }

  if (namedImports) {
    // Parse named imports
    namedImports.split(',').forEach(imp => {
      const cleaned = imp.trim();
      if (cleaned) {
        importsFromExternal.get(moduleSpecifier)!.add(cleaned);
      }
    });
  }
  if (defaultImport) {
    importsFromExternal.get(moduleSpecifier)!.add(`default:${defaultImport}`);
  }
  if (namespaceImport) {
    importsFromExternal.get(moduleSpecifier)!.add(`namespace:${namespaceImport}`);
  }
}

// Generate stubs based on what's imported
for (const [moduleSpec, imports] of importsFromExternal) {
  if (moduleSpec.startsWith("npm:") || moduleSpec.startsWith("jsr:")) {
    typeStubs += `// From ${moduleSpec}\n`;

    for (const imp of imports) {
      if (imp.startsWith("default:")) {
        const name = imp.slice(8);
        typeStubs += `declare const ${name}: any;\n`;
      } else if (imp.startsWith("namespace:")) {
        const name = imp.slice(10);
        typeStubs += `declare const ${name}: any;\n`;
      } else {
        // Check if it's a type import (rough heuristic: starts with uppercase)
        if (imp[0] === imp[0].toUpperCase()) {
          typeStubs += `type ${imp} = any;\n`;
        } else {
          typeStubs += `declare const ${imp}: any;\n`;
        }
      }
    }
    typeStubs += "\n";
  }
}

// Step 4: Add Deno globals
console.log("3. Adding Deno globals...");
const denoGlobals = `// ============================================
// Deno namespace and globals
// ============================================

declare namespace Deno {
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string): Promise<void>;
  export const args: string[];
  export function stat(path: string): Promise<any>;
  export function readDir(path: string): AsyncIterable<any>;
  export function mkdir(path: string, options?: any): Promise<void>;
  export function remove(path: string, options?: any): Promise<void>;
  export const Command: any;
  export const env: any;
  export const execPath: () => string;
  export function exit(code?: number): never;
}

declare const WebSocket: any;
declare const Response: any;

`;

// Step 5: Concatenate local files
console.log("4. Concatenating local files...");
let concatenated = "";

for (const file of localFiles) {
  console.log(`   Processing: ${file}`);
  let content = await Deno.readTextFile(file);

  // Remove imports
  content = removeImports(content);

  // Transform re-exports
  content = transformReExports(content);

  // Add file header
  concatenated += `
// ============================================
// Source: ${file}
// ============================================

${content}
`;
}

// Step 6: Combine everything
console.log("\n5. Writing output file...");
const finalOutput = denoGlobals + typeStubs + concatenated;
await Deno.writeTextFile(OUTPUT_FILE, finalOutput);
console.log(`   Wrote to: ${OUTPUT_FILE}`);
console.log(`   Total size: ${finalOutput.length} characters`);

// Step 7: Test TypeScript compilation
console.log("\n6. Testing TypeScript compilation...");
const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--lib", "ES2020,DOM", "--target", "ES2020", OUTPUT_FILE],
  stdout: "piped",
  stderr: "piped",
});

const tscResult = await tscCmd.output();
if (tscResult.success) {
  console.log("   ✓ TypeScript compilation succeeded!");
} else {
  console.log("   ✗ TypeScript compilation failed:");
  const errors = new TextDecoder().decode(tscResult.stderr);
  console.log(errors.split('\n').slice(0, 10).join('\n'));
}

// Step 8: Test with TypeDoc
console.log("\n7. Testing with TypeDoc...");
const typedocCmd = new Deno.Command("npx", {
  args: ["typedoc", "--out", join(SPIKE_DIR, "docs"), OUTPUT_FILE],
  stdout: "piped",
  stderr: "piped",
});

const typedocResult = await typedocCmd.output();
if (typedocResult.success) {
  console.log("   ✓ TypeDoc succeeded!");
  console.log(`   Docs generated at: ${join(SPIKE_DIR, "docs")}`);
} else {
  console.log("   ✗ TypeDoc failed:");
  const errors = new TextDecoder().decode(typedocResult.stderr);
  console.log(errors.split('\n').slice(0, 5).join('\n'));
}

console.log("\n=== Pipeline Complete ===");
console.log("\nSummary:");
console.log("- Dependency analysis works");
console.log("- Import removal works (mostly)");
console.log("- Type stubs approach is viable");
console.log("- Need to refine import removal for multiline cases");
console.log("- TypeDoc can process the output if TypeScript compiles successfully");