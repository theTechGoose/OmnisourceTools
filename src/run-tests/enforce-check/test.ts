import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { runDenoCheck } from "./mod.ts";

Deno.test("runDenoCheck should return empty array for valid TypeScript", async () => {
  // Create a temp directory with valid TS file
  const tempDir = await Deno.makeTempDir();
  const validFile = `${tempDir}/valid.ts`;
  await Deno.writeTextFile(validFile, `const x: number = 42;`);

  const result = await runDenoCheck(tempDir);
  assertEquals(result.issues.length, 0);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("runDenoCheck should detect type errors", async () => {
  // Create a temp directory with invalid TS file
  const tempDir = await Deno.makeTempDir();
  const invalidFile = `${tempDir}/invalid.ts`;
  await Deno.writeTextFile(invalidFile, `const x: number = "not a number";`);

  const result = await runDenoCheck(tempDir);
  assertEquals(result.issues.length > 0, true);

  await Deno.remove(tempDir, { recursive: true });
});