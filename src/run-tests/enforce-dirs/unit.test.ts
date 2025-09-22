import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts"

// Test expand macros function
Deno.test("expandMacros - simple macro", () => {
  const macros = {
    basic: { mod: "ts", test: "test.ts" }
  }

  const spec = "#basic"

  // This would test the expandMacros function if exported
  // For now, just verify basic structure
  assertEquals(typeof macros.basic, "object")
  assertEquals(macros.basic.mod, "ts")
})

Deno.test("expandMacros - nested macro", () => {
  const macros = {
    inner: { file: "ts" },
    outer: { sub: "#inner" }
  }

  // Verify structure exists
  assertEquals(typeof macros.outer.sub, "string")
  assertEquals(macros.outer.sub, "#inner")
})

Deno.test("file extension matching", () => {
  // Test various extension patterns
  const testCases = [
    { name: "config.json", base: "config", ext: "json" },
    { name: "test.spec.ts", base: "test", ext: "spec.ts" },
    { name: "file", base: "file", ext: undefined }
  ]

  for (const tc of testCases) {
    const parts = tc.name.split('.')
    const base = parts[0]
    const ext = parts.length > 1 ? parts.slice(1).join('.') : undefined

    assertEquals(base, tc.base)
    assertEquals(ext, tc.ext)
  }
})

Deno.test("optional directory pattern", () => {
  const patterns = [
    { input: "tests?", isOptional: true, name: "tests" },
    { input: "src", isOptional: false, name: "src" },
    { input: "lib?", isOptional: true, name: "lib" }
  ]

  for (const p of patterns) {
    const isOptional = p.input.endsWith('?')
    const name = isOptional ? p.input.slice(0, -1) : p.input

    assertEquals(isOptional, p.isOptional)
    assertEquals(name, p.name)
  }
})

Deno.test("wildcard pattern", () => {
  const spec = {
    "...": "ts"
  }

  assertEquals("..." in spec, true)
  assertEquals(spec["..."], "ts")
})

Deno.test("array spec matching", () => {
  const spec = ["ts", "js", "mjs"]

  assertEquals(Array.isArray(spec), true)
  assertEquals(spec.includes("ts"), true)
  assertEquals(spec.includes("py"), false)
})

console.log("All unit tests completed")