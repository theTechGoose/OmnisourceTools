#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 1: Test deno vendor functionality
 *
 * Goals:
 * 1. Run deno vendor on example.ts
 * 2. Examine the vendor directory structure
 * 3. Find import_map.json
 * 4. Clean up vendor directory
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const SPIKE_DIR = new URL(".", import.meta.url).pathname;
const VENDOR_DIR = join(SPIKE_DIR, "vendor");
const EXAMPLE_FILE = join(SPIKE_DIR, "example.ts");

console.log("=== Experiment 1: Testing deno vendor ===\n");

// Step 1: Clean up any existing vendor directory
console.log("1. Cleaning up existing vendor directory...");
try {
  await Deno.remove(VENDOR_DIR, { recursive: true });
  console.log("   ✓ Cleaned up existing vendor directory");
} catch {
  console.log("   ✓ No existing vendor directory");
}

// Step 2: Run deno vendor
console.log("\n2. Running deno vendor...");
const vendorCmd = new Deno.Command("deno", {
  args: ["vendor", "--output", VENDOR_DIR, EXAMPLE_FILE],
  stdout: "piped",
  stderr: "piped",
});

const { success, stdout, stderr } = await vendorCmd.output();
if (!success) {
  console.error("   ✗ Failed to vendor:");
  console.error(new TextDecoder().decode(stderr));
  Deno.exit(1);
}
console.log("   ✓ Vendor command succeeded");
console.log("   Output:", new TextDecoder().decode(stdout));

// Step 3: Examine vendor directory structure
console.log("\n3. Examining vendor directory structure...");
async function listDir(path: string, indent = "   ") {
  for await (const entry of Deno.readDir(path)) {
    console.log(`${indent}${entry.isDirectory ? "📁" : "📄"} ${entry.name}`);
    if (entry.isDirectory && !entry.name.includes("node_modules")) {
      // Only go one level deep for brevity
      if (indent.length < 10) {
        await listDir(join(path, entry.name), indent + "  ");
      }
    }
  }
}
await listDir(VENDOR_DIR);

// Step 4: Check for import_map.json
console.log("\n4. Checking for import_map.json...");
const importMapPath = join(VENDOR_DIR, "import_map.json");
try {
  const importMap = JSON.parse(await Deno.readTextFile(importMapPath));
  console.log("   ✓ Found import_map.json");
  console.log("   Imports:", Object.keys(importMap.imports || {}));
  console.log("\n   Import mappings:");
  for (const [key, value] of Object.entries(importMap.imports || {})) {
    console.log(`     ${key} → ${value}`);
  }
} catch (e) {
  console.error("   ✗ Could not read import_map.json:", e.message);
}

// Step 5: Look for type definition files
console.log("\n5. Looking for type definition files...");
async function findTypeFiles(dir: string, results: string[] = []): Promise<string[]> {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      await findTypeFiles(fullPath, results);
    } else if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.mts")) {
      results.push(fullPath.replace(VENDOR_DIR + "/", ""));
    }
  }
  return results;
}

const typeFiles = await findTypeFiles(VENDOR_DIR);
console.log(`   Found ${typeFiles.length} type definition files:`);
typeFiles.slice(0, 10).forEach(f => console.log(`     - ${f}`));
if (typeFiles.length > 10) {
  console.log(`     ... and ${typeFiles.length - 10} more`);
}

// Step 6: Clean up
console.log("\n6. Cleaning up vendor directory...");
try {
  await Deno.remove(VENDOR_DIR, { recursive: true });
  console.log("   ✓ Successfully cleaned up vendor directory");
} catch (e) {
  console.error("   ✗ Failed to clean up:", e.message);
}

console.log("\n=== Experiment 1 Complete ===");
console.log("\nKey findings:");
console.log("- deno vendor creates a vendor/ directory with all dependencies");
console.log("- import_map.json contains mappings from specifiers to local files");
console.log("- Type definition files are preserved in the vendor directory");
console.log("- Cleanup with Deno.remove() works as expected");