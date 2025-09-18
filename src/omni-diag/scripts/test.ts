import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { getSetupScriptPath } from "./mod.ts";

Deno.test("getSetupScriptPath returns valid path", () => {
  const path = getSetupScriptPath();
  assertEquals(path.endsWith("/setup.sh"), true);
});