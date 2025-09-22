#!/usr/bin/env deno run --allow-read

import { validateStructure } from './validate.ts'

// Test cases
const tests = [
  {
    name: "Basic file matching",
    structure: {
      config: "json",
      main: "ts"
    },
    fixtures: [
      { path: "test1", files: ["config.json", "main.ts"], expected: 0 },
      { path: "test2", files: ["config.json"], expected: 1 }, // missing main.ts
      { path: "test3", files: ["config.json", "main.ts", "extra.js"], expected: 1 }, // extra file
    ]
  },
  {
    name: "Optional directories",
    structure: {
      src: "ts",
      "tests?": { unit: "test.ts" }
    },
    fixtures: [
      { path: "test4", files: ["src.ts"], expected: 0 }, // without optional
      { path: "test5", files: ["src.ts", "tests/unit.test.ts"], dirs: ["tests"], expected: 0 }, // with optional
    ]
  },
  {
    name: "Wildcard matching",
    structure: {
      "...": "ts"
    },
    fixtures: [
      { path: "test6", files: ["a.ts", "b.ts", "c.ts"], expected: 0 },
      { path: "test7", files: ["a.ts", "b.js"], expected: 1 }, // .js not allowed
    ]
  },
  {
    name: "Array (any-of) matching",
    structure: {
      data: ["json", "yaml", "xml"]
    },
    fixtures: [
      { path: "test8", files: ["data.json"], expected: 0 },
      { path: "test9", files: ["data.yaml"], expected: 0 },
      { path: "test10", files: ["data.txt"], expected: 1 }, // not in array
    ]
  },
  {
    name: "Nested structures",
    structure: {
      lib: {
        utils: "ts",
        helpers: "ts"
      }
    },
    fixtures: [
      { path: "test11", files: ["lib/utils.ts", "lib/helpers.ts"], dirs: ["lib"], expected: 0 },
      { path: "test12", files: ["lib/utils.ts"], dirs: ["lib"], expected: 1 }, // missing helpers.ts
    ]
  }
]

// Helper to create test fixtures
async function createFixture(basePath: string, files: string[], dirs: string[] = []) {
  // Clean up if exists
  try {
    await Deno.remove(basePath, { recursive: true })
  } catch {}

  // Create base directory
  await Deno.mkdir(basePath, { recursive: true })

  // Create directories
  for (const dir of dirs) {
    await Deno.mkdir(`${basePath}/${dir}`, { recursive: true })
  }

  // Create files
  for (const file of files) {
    const fullPath = `${basePath}/${file}`
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (dir && dir !== basePath) {
      await Deno.mkdir(dir, { recursive: true })
    }
    await Deno.writeTextFile(fullPath, '')
  }
}

// Run tests
let passed = 0
let failed = 0

for (const testSuite of tests) {
  console.log(`\nTesting: ${testSuite.name}`)
  console.log("=".repeat(40))

  for (const fixture of testSuite.fixtures) {
    const fixturePath = `./fixtures/auto-test/${fixture.path}`

    // Create fixture
    await createFixture(fixturePath, fixture.files, fixture.dirs)

    // Create a temporary validate function with the test structure
    const validate = async (dir: string) => {
      // Import and override structure
      const module = await import('./validate.ts')
      const expandMacros = (module as any).expandMacros || ((s: any) => s)

      // Mock the validation with test structure
      const actualStructure = await (module as any).scanDirectory(dir)
      const issues: any[] = []

      // Simple validation based on structure
      const expandedSpec = testSuite.structure
      await (module as any).validateNode(
        expandedSpec,
        actualStructure,
        dir,
        issues,
        {}
      )

      return {
        issues,
        message: issues.length === 0
          ? "All validations passed"
          : `Found ${issues.length} validation issue(s)`
      }
    }

    const result = await validate(fixturePath)
    const actualIssues = result.issues.length

    if (actualIssues === fixture.expected) {
      console.log(`  ✅ ${fixture.path}: ${result.message}`)
      passed++
    } else {
      console.log(`  ❌ ${fixture.path}: Expected ${fixture.expected} issues, got ${actualIssues}`)
      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          console.log(`     - ${issue.location}: ${issue.issue}`)
        }
      }
      failed++
    }
  }
}

// Clean up test fixtures
try {
  await Deno.remove('./fixtures/auto-test', { recursive: true })
} catch {}

console.log("\n" + "=".repeat(40))
console.log(`Test Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  Deno.exit(1)
}