import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { findInvalidRelativeImports, parseGrepOutput } from "./mod.ts";

Deno.test("parseGrepOutput should parse grep output correctly", () => {
  const grepOutput = `src/file.ts:10:import { foo } from "../bar";`;
  const issues = parseGrepOutput(grepOutput);

  assertEquals(issues.length, 1);
  assertEquals(issues[0].location, "src/file.ts:10");
  assertEquals(issues[0].issue.includes("Invalid relative import"), true);
});

Deno.test("parseGrepOutput should handle empty output", () => {
  const issues = parseGrepOutput("");
  assertEquals(issues.length, 0);
});

Deno.test("findInvalidRelativeImports should return empty for clean imports", async () => {
  // Create a temp directory with no relative imports
  const tempDir = await Deno.makeTempDir();
  const cleanFile = `${tempDir}/clean.ts`;
  await Deno.writeTextFile(cleanFile, `
    import { foo } from "./bar.ts";
    import { baz } from "https://deno.land/x/mod.ts";
  `);

  const result = await findInvalidRelativeImports(tempDir);
  assertEquals(result.issues.length, 0);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("findInvalidRelativeImports should detect ../ imports", async () => {
  // Create a temp directory with relative imports
  const tempDir = await Deno.makeTempDir();
  const relativeFile = `${tempDir}/relative.ts`;
  await Deno.writeTextFile(relativeFile, `
    import { foo } from "../bar.ts";
  `);

  const result = await findInvalidRelativeImports(tempDir);
  assertEquals(result.issues.length > 0, true);

  await Deno.remove(tempDir, { recursive: true });
});