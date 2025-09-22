import type { Spec } from '../utils/mod.ts'

// Simple test structure
export const structure: Spec = {
  config: "json",
  main: "ts",
  lib: {
    utils: "ts",
    helpers: "ts"
  },
  "tests?": {
    unit: "test.ts"
  }
}

export const macros = {}
export const rules = {}