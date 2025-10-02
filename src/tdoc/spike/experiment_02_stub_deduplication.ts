#!/usr/bin/env -S deno run --allow-all

/**
 * Experiment 2: Stub Name Collision & Deduplication
 * Test what happens with duplicate imports across multiple files
 */

console.log("=== Experiment 2: Stub Deduplication ===\n");

// Simulate imports collected from multiple files
const file1Imports = new Map<string, Set<string>>([
  ["npm:zod", new Set(["ZodType", "ZodError", "z"])],
  ["jsr:@std/testing", new Set(["assertEquals"])],
]);

const file2Imports = new Map<string, Set<string>>([
  ["npm:zod", new Set(["ZodType", "ZodSchema"])], // ZodType is duplicate
  ["npm:other", new Set(["Something"])],
]);

const file3Imports = new Map<string, Set<string>>([
  ["npm:zod", new Set(["z", "ZodError"])], // z and ZodError are duplicates
  ["jsr:@std/testing", new Set(["assertEquals", "assertThrows"])], // assertEquals is duplicate
]);

// Merge all imports (simulating concatenation process)
function mergeImports(...importMaps: Map<string, Set<string>>[]): Map<string, Set<string>> {
  const merged = new Map<string, Set<string>>();

  for (const importMap of importMaps) {
    for (const [module, items] of importMap) {
      if (!merged.has(module)) {
        merged.set(module, new Set());
      }
      // Add all items to the set (Set automatically handles duplicates)
      items.forEach(item => merged.get(module)!.add(item));
    }
  }

  return merged;
}

// Generate stubs with deduplication
function generateStubsWithDedup(imports: Map<string, Set<string>>): string {
  let stubs = "";
  const generatedStubs = new Set<string>(); // Track what we've generated

  for (const [module, items] of imports) {
    stubs += `// Stubs for ${module}\n`;

    for (const item of items) {
      // Check if we've already generated this stub
      if (generatedStubs.has(item)) {
        stubs += `// Skipped duplicate: ${item}\n`;
        continue;
      }

      generatedStubs.add(item);

      // Generate stub based on naming heuristic
      const isLikelyType = item[0] === item[0].toUpperCase() ||
                          item.includes("Type") ||
                          item.includes("Schema");

      const stubName = `__${item}_STUB__`;

      if (isLikelyType) {
        stubs += `type ${stubName} = any; // Originally: ${item}\n`;
        stubs += `type ${item} = ${stubName};\n`;
      } else {
        stubs += `declare const ${stubName}: any; // Originally: ${item}\n`;
        stubs += `const ${item} = ${stubName};\n`;
      }
    }
    stubs += "\n";
  }

  return stubs;
}

// Test without deduplication (naive approach)
console.log("1. WITHOUT DEDUPLICATION (Naive Merge):\n");
const naiveMerged = new Map<string, Set<string>>();

// Manually add duplicates to show the problem
for (const [module, items] of file1Imports) {
  naiveMerged.set(module, new Set(items));
}
// This would cause duplicates if we didn't use Set
console.log("File 1 imports:", file1Imports);
console.log("File 2 imports:", file2Imports);
console.log("File 3 imports:", file3Imports);

// Test with deduplication
console.log("\n2. WITH DEDUPLICATION (Using Set):\n");
const merged = mergeImports(file1Imports, file2Imports, file3Imports);

console.log("Merged imports:");
for (const [module, items] of merged) {
  console.log(`  ${module}: [${Array.from(items).join(", ")}]`);
}

// Generate stubs
console.log("\n3. GENERATED STUBS:\n");
const stubs = generateStubsWithDedup(merged);
console.log(stubs);

// Check for TypeScript errors
console.log("4. TYPESCRIPT COMPILATION TEST:\n");

const testCode = `
${stubs}

// Test that we can use the stubbed types/values
const testZ: typeof z = z;
type TestType = ZodType;
type TestSchema = ZodSchema;
const testAssert: typeof assertEquals = assertEquals;
`;

// Write to temp file and try to compile
const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(tempFile, testCode);

const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--skipLibCheck", tempFile],
  stdout: "piped",
  stderr: "piped",
});

const { success, stderr } = await tscCmd.output();

if (success) {
  console.log("✅ TypeScript compilation successful - no duplicate identifier errors!");
} else {
  console.log("❌ TypeScript compilation failed:");
  console.log(new TextDecoder().decode(stderr));
}

// Clean up
await Deno.remove(tempFile);

// Summary
console.log("\n=== Summary ===");
console.log("Key findings:");
console.log("1. Using Set<string> automatically prevents duplicate items");
console.log("2. Must track generated stubs globally to avoid re-declaring");
console.log("3. The stubName (__item_STUB__) pattern avoids conflicts");
console.log("4. Deduplication is essential for multi-file concatenation");