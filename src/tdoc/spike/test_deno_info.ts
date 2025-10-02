#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment: Test deno info --json for dependency analysis
 * Since deno vendor is removed in Deno 2, we need a different approach
 *
 * Goals:
 * 1. Run deno info --json on example.ts
 * 2. Identify local vs external dependencies
 * 3. See what information we get about external deps
 * 4. Figure out how to handle external type definitions
 */

import { join, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const SPIKE_DIR = new URL(".", import.meta.url).pathname;
const EXAMPLE_FILE = join(SPIKE_DIR, "example.ts");

console.log("=== Testing deno info --json ===\n");

// Step 1: Run deno info --json
console.log("1. Running deno info --json...");
const infoCmd = new Deno.Command("deno", {
  args: ["info", "--json", EXAMPLE_FILE],
  stdout: "piped",
  stderr: "piped",
});

const { success, stdout, stderr } = await infoCmd.output();
if (!success) {
  console.error("   ✗ Failed:");
  console.error(new TextDecoder().decode(stderr));
  Deno.exit(1);
}

const info = JSON.parse(new TextDecoder().decode(stdout));
console.log("   ✓ Got dependency information");

// Step 2: Analyze the structure
console.log("\n2. Analyzing dependency structure...");
console.log(`   Total modules: ${info.modules?.length || 0}`);

// Step 3: Categorize dependencies
const localDeps: any[] = [];
const externalDeps: any[] = [];

for (const module of info.modules || []) {
  if (module.local?.startsWith("/")) {
    // Local file
    localDeps.push(module);
  } else {
    // External dependency
    externalDeps.push(module);
  }
}

console.log(`   Local dependencies: ${localDeps.length}`);
console.log(`   External dependencies: ${externalDeps.length}`);

// Step 4: Show external dependencies
console.log("\n3. External dependencies:");
const externalByType = new Map<string, any[]>();

for (const dep of externalDeps) {
  const specifier = dep.specifier || "";
  let type = "unknown";

  if (specifier.startsWith("npm:")) type = "npm";
  else if (specifier.startsWith("jsr:")) type = "jsr";
  else if (specifier.startsWith("https://")) type = "https";
  else if (specifier.startsWith("node:")) type = "node";

  if (!externalByType.has(type)) {
    externalByType.set(type, []);
  }
  externalByType.get(type)!.push(dep);
}

for (const [type, deps] of externalByType) {
  console.log(`\n   ${type} packages (${deps.length}):`);
  for (const dep of deps.slice(0, 5)) {
    console.log(`     - ${dep.specifier}`);
    if (dep.local) {
      console.log(`       Cached at: ${dep.local}`);
    }
  }
  if (deps.length > 5) {
    console.log(`     ... and ${deps.length - 5} more`);
  }
}

// Step 5: Look for what's imported from external deps
console.log("\n4. Analyzing imports from external dependencies:");
for (const module of info.modules || []) {
  if (module.specifier === "file://" + EXAMPLE_FILE) {
    console.log("   Found our entry file dependencies:");
    for (const dep of module.dependencies || []) {
      if (dep.code) {
        console.log(`     Import: ${dep.code.specifier}`);
      }
    }
    break;
  }
}

// Step 6: Check cache for type definitions
console.log("\n5. Checking Deno cache for type definitions...");
const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
const denoCacheDir = join(homeDir, ".cache", "deno");
console.log(`   Deno cache directory: ${denoCacheDir}`);

// Look for npm types in cache
const npmTypesDir = join(denoCacheDir, "npm", "registry.npmjs.org");
try {
  const entries = [];
  for await (const entry of Deno.readDir(npmTypesDir)) {
    entries.push(entry.name);
    if (entries.length >= 5) break;
  }
  console.log(`   Found npm packages in cache:`);
  entries.forEach(e => console.log(`     - ${e}`));
} catch {
  console.log("   Could not access npm cache");
}

console.log("\n=== Analysis Complete ===");
console.log("\nKey findings:");
console.log("- deno info --json provides full dependency graph");
console.log("- External dependencies are cached locally");
console.log("- Cache paths are available in the 'local' field");
console.log("- We can potentially read cached files for type extraction");
console.log("\nProblem: Without deno vendor, we need to:");
console.log("1. Either read from Deno's cache (fragile, cache location varies)");
console.log("2. Or fetch type definitions ourselves");
console.log("3. Or use stub types (simplest but loses type info)");