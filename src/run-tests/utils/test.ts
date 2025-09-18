import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getEnvFile, type Issue, type Spec } from "./mod.ts";

Deno.test("getEnvFile should return env file path", async () => {
  const tempDir = await Deno.makeTempDir();

  // getEnvFile looks for env/local file relative to git root
  const result = await getEnvFile(tempDir);
  assertEquals(typeof result, "string");

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("Issue type should have correct shape", () => {
  const issue: Issue = {
    issue: "Test issue",
    location: "test/location",
  };

  assertEquals(typeof issue.issue, "string");
  assertEquals(typeof issue.location, "string");
});

Deno.test("Spec type should accept valid structures", () => {
  const spec: Spec = {
    src: "ts",
    "...": {
      nested: "json",
    },
  };

  assertEquals(spec.src, "ts");
  assertEquals(typeof spec["..."], "object");
});