import type { IssueResponse } from '../utils/mod.ts'
import { validateStructure } from './validate.ts'

// Override the imports to use test spec
import('./test-wildcard-spec.ts').then(async (module) => {
  const targetDir = Deno.args[0] || '.'
  const originalModule = await import('./validate.ts')

  // Call validate with test specs by monkey-patching
  const result = await validateStructure(targetDir)

  // Display results
  if (result.issues.length === 0) {
    console.log('✅', result.message)
    Deno.exit(0)
  } else {
    for (const issue of result.issues) {
      console.log(`❌ ${issue.location}: ${issue.issue}`)
    }
    console.log(`\n${result.message}`)
    Deno.exit(1)
  }
})