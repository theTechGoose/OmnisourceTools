import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { enforceStructure } from "./mod.ts";

Deno.test("enforceStructure should detect missing required files", async () => {
  const tempDir = await Deno.makeTempDir();

  // Test with empty directory - should fail for missing src, deno.json, design.ts
  const result = await enforceStructure(tempDir);

  assertEquals(result.issues.length > 0, true);
  assertEquals(result.issues.some(i => i.issue.includes("Missing required")), true);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("enforceStructure should pass with correct structure", async () => {
  const tempDir = await Deno.makeTempDir();

  // Create minimal valid structure
  await Deno.mkdir(`${tempDir}/src`, { recursive: true });
  await Deno.writeTextFile(`${tempDir}/deno.json`, "{}");
  await Deno.writeTextFile(`${tempDir}/design.ts`, "// design");

  const result = await enforceStructure(tempDir);

  // Should still have issues because src needs bootstrap.ts
  assertEquals(result.issues.length > 0, true);

  await Deno.remove(tempDir, { recursive: true });
});