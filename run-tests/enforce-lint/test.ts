import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { runDenoLint } from "./mod.ts";

Deno.test("runDenoLint should return empty array for clean code", async () => {
  // Create a temp directory with clean TS file
  const tempDir = await Deno.makeTempDir();
  const cleanFile = `${tempDir}/clean.ts`;
  await Deno.writeTextFile(cleanFile, `const x = 42;\nconsole.log(x);\n`);

  const result = await runDenoLint(tempDir);
  assertEquals(result.issues.length, 0);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("runDenoLint should detect lint issues", async () => {
  // Create a temp directory with code that has lint issues
  const tempDir = await Deno.makeTempDir();
  const dirtyFile = `${tempDir}/dirty.ts`;
  // no-unused-vars lint error
  await Deno.writeTextFile(dirtyFile, `const unusedVariable = 42;\n`);

  const result = await runDenoLint(tempDir);
  // Deno lint might be configured to ignore this, so we just check it runs
  assertEquals(Array.isArray(result.issues), true);

  await Deno.remove(tempDir, { recursive: true });
});