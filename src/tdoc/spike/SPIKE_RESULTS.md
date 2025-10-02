# Spike Experiment Results

## Problem Statement
- Need to generate a single TypeScript file for TypeDoc documentation
- TypeDoc doesn't understand Deno globals or import specifiers (npm:, jsr:, etc.)
- External library types (like ZodType) break when imports are removed

## Key Findings

### 1. deno vendor is deprecated
- `deno vendor` command was removed in Deno 2.0
- Alternative `"vendor": true` in deno.json doesn't help programmatically

### 2. Viable Solution: Concatenation with Verbose Stubs

The working approach:
1. Use `deno info --json` to get all dependencies
2. Concatenate local TypeScript files
3. Remove all import statements
4. Generate verbose type stubs for external dependencies
5. Add Deno namespace declarations

### 3. Verbose Stub Approach Works ✅

Instead of using generic `any`, we use descriptive stubs:
```typescript
// Instead of:
type ZodType = any;

// We generate:
type __ZodType_STUB__ = any; // Originally: ZodType
type ZodType = __ZodType_STUB__;
```

Benefits:
- Clear what's stubbed vs real
- Easy to debug
- Preserves original names for compatibility
- TypeScript compiles successfully
- TypeDoc generates docs successfully

### 4. Import Removal Strategy

Successfully removes:
- Single-line imports
- Type imports
- Multiline imports (needs refinement)

Transforms re-exports:
- `export { x } from 'module'` → `export { x }`
- `export * from 'module'` → removed

### 5. Avoiding Conflicts

Don't redefine DOM globals like `Response`, `WebSocket` - TypeScript already knows these.

## Recommended Implementation

1. **Restore the concat function** from commented code
2. **Implement verbose stub generation** as tested
3. **Add minimal Deno namespace** (only what's used)
4. **Improve multiline import removal** regex
5. **Skip dnt entirely** - not needed for documentation

## Code That Works

The `test_stub_approach.ts` spike successfully:
- Generates valid TypeScript
- Compiles with tsc
- Processes with TypeDoc
- Produces readable documentation

This approach is simpler than vendor/type extraction and produces the same result.