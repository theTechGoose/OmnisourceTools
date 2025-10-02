#!/usr/bin/env -S deno run --allow-all

/**
 * Test verbose stub name approach
 * Replace external types with descriptive stubs like __ZodType_STUB__
 */

console.log("=== Testing Verbose Stub Approach ===\n");

// Sample code with external dependencies
const sampleCode = `
import { z, ZodType, ZodSchema } from "npm:zod@3.22.4";
import type { ZodError } from "npm:zod@3.22.4";
import { assertEquals } from "jsr:@std/assert@1.0.0";

export interface User {
  name: string;
  age: number;
}

export function validateUser(data: unknown, schema: ZodType): User {
  return schema.parse(data);
}

export function handleError(error: ZodError) {
  console.log(error.errors);
}

export const userSchema: ZodSchema = z.object({
  name: z.string(),
  age: z.number(),
});

export function testEqual(a: any, b: any) {
  assertEquals(a, b);
}
`;

// Track imports to generate stubs
function extractImports(code: string): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();

  // Match import statements
  const importRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const [, namedImports, defaultImport, namespaceImport, moduleSpecifier] = match;

    if (!imports.has(moduleSpecifier)) {
      imports.set(moduleSpecifier, new Set());
    }

    if (namedImports) {
      namedImports.split(',').forEach(imp => {
        const cleaned = imp.trim();
        if (cleaned) {
          // Check if it's a type import
          const isType = code.includes(`import type { ${cleaned}`) ||
                        code.includes(`import { type ${cleaned}`);
          imports.get(moduleSpecifier)!.add(isType ? `type:${cleaned}` : cleaned);
        }
      });
    }
    if (defaultImport) {
      imports.get(moduleSpecifier)!.add(`default:${defaultImport}`);
    }
    if (namespaceImport) {
      imports.get(moduleSpecifier)!.add(`namespace:${namespaceImport}`);
    }
  }

  return imports;
}

// Generate verbose stubs
function generateVerboseStubs(imports: Map<string, Set<string>>): string {
  let stubs = `// ============================================
// Verbose type stubs for external dependencies
// ============================================

`;

  for (const [module, items] of imports) {
    if (!module.startsWith("npm:") && !module.startsWith("jsr:")) continue;

    stubs += `// Stubs for ${module}\n`;

    for (const item of items) {
      if (item.startsWith("type:")) {
        const typeName = item.slice(5);
        const stubName = `__${typeName}_STUB__`;
        stubs += `type ${stubName} = any; // Originally: ${typeName}\n`;
        stubs += `type ${typeName} = ${stubName};\n`;
      } else if (item.startsWith("default:")) {
        const name = item.slice(8);
        const stubName = `__${name}_STUB__`;
        stubs += `declare const ${stubName}: any; // Originally: default export ${name}\n`;
        stubs += `const ${name} = ${stubName};\n`;
      } else if (item.startsWith("namespace:")) {
        const name = item.slice(10);
        const stubName = `__${name}_STUB__`;
        stubs += `declare const ${stubName}: any; // Originally: namespace ${name}\n`;
        stubs += `const ${name} = ${stubName};\n`;
      } else {
        // Regular named import - could be const or type
        // Use heuristic: uppercase first letter = likely type
        const isLikelyType = item[0] === item[0].toUpperCase();
        const stubName = `__${item}_STUB__`;

        if (isLikelyType) {
          stubs += `type ${stubName} = any; // Originally: ${item} (assumed type)\n`;
          stubs += `type ${item} = ${stubName};\n`;
        } else {
          stubs += `declare const ${stubName}: any; // Originally: ${item}\n`;
          stubs += `const ${item} = ${stubName};\n`;
        }
      }
    }
    stubs += "\n";
  }

  return stubs;
}

// Remove imports
function removeImports(code: string): string {
  // Remove import statements
  return code.replace(
    /^import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)[\s\S]*?from\s+["'][^"']+["']\s*;?\s*$/gm,
    ''
  );
}

// Process the code
console.log("1. Original code:");
console.log("================");
console.log(sampleCode);

const imports = extractImports(sampleCode);
console.log("\n2. Extracted imports:");
console.log("====================");
for (const [module, items] of imports) {
  console.log(`   ${module}:`);
  for (const item of items) {
    console.log(`     - ${item}`);
  }
}

const stubs = generateVerboseStubs(imports);
console.log("\n3. Generated verbose stubs:");
console.log("===========================");
console.log(stubs);

const codeWithoutImports = removeImports(sampleCode);
const finalCode = stubs + codeWithoutImports;

console.log("\n4. Final concatenated code:");
console.log("===========================");
console.log(finalCode);

// Write to file for testing
const OUTPUT_FILE = "/Users/raphaelcastro/Documents/programming/OmnisourceTools/src/tdoc/spike/stubbed_output.ts";
await Deno.writeTextFile(OUTPUT_FILE, finalCode);

// Test TypeScript compilation
console.log("\n5. Testing TypeScript compilation:");
console.log("==================================");
const tscCmd = new Deno.Command("npx", {
  args: ["tsc", "--noEmit", "--lib", "ES2020,DOM", "--target", "ES2020", OUTPUT_FILE],
  stdout: "piped",
  stderr: "piped",
});

const result = await tscCmd.output();
if (result.success) {
  console.log("   ✓ TypeScript compilation succeeded!");
} else {
  console.log("   ✗ TypeScript compilation failed:");
  const errors = new TextDecoder().decode(result.stderr);
  console.log(errors.split('\n').slice(0, 10).join('\n'));
}

console.log("\n=== Summary ===");
console.log("- Verbose stub names like __ZodType_STUB__ make it clear what's stubbed");
console.log("- Original names are aliased to stubs for compatibility");
console.log("- Comments document what each stub represents");
console.log("- This approach is more debuggable and transparent");