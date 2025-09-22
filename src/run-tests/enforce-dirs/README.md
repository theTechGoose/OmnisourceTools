# Directory Structure Enforcement

This module provides directory structure validation that integrates with the `run-tests` bootstrap system.

## Integration with Bootstrap

The directory structure enforcement is now integrated into the main test runner bootstrap. When you run:

```bash
run-tests [directories...]
```

It will automatically:
1. Find the project root (directory containing deno.json)
2. Validate the entire project structure against `specs.ts`
3. Report any structure violations along with other test results

## How It Works

### Bootstrap Integration Flow
1. `bootstrap.ts` calls `getRoot()` to find the project root
2. `enforceStructure(root)` validates the entire project structure
3. Results are displayed first (since structure issues often cause other problems)
4. Other checks (tests, lint, etc.) run on specified directories

### Module Structure
- `mod.ts` - Main export that integrates with bootstrap
- `validate.ts` - Core validation logic
- `specs.ts` - Project structure specification

## Usage

### Via Bootstrap (Recommended)
```bash
# Run all checks including structure validation
deno run --allow-read --allow-env --allow-run bootstrap.ts src

# With watch mode
deno run --allow-read --allow-env --allow-run bootstrap.ts --watch src
```

### Standalone
```bash
# Validate current directory
deno run --allow-read validate.ts .

# Validate specific directory
deno run --allow-read validate.ts ./my-project
```

## Structure Specification

The project structure is defined in `specs.ts`:

```typescript
const structure: Spec = {
  src: ["#developed", "#undeveloped"],
  deno: "json",
  design: "ts",
  tests: ["#developedTests", "#undevelopedTests"],
};
```

This means the root must have:
- `src/` directory with either developed or undeveloped structure
- `deno.json` file
- `design.ts` file
- `tests/` directory with test structure

## Understanding Validation Errors

When structure validation fails, you'll see messages like:

```
=================❌ 5 structure issues found=================

Issue 1: location: /path/to/project/src
Does not match any of: directory, directory
```

Common issues:
- **"Expected file with extension .X"** - Missing required file
- **"Does not match any of: ..."** - Directory doesn't match any allowed macro patterns
- **"Unexpected file/directory"** - File/directory not defined in specification

## Customizing Structure

To customize the expected structure for your project:

1. Edit `specs.ts` to define your structure
2. Use macros for reusable patterns
3. Add validation rules as needed

Example custom structure:
```typescript
const structure: Spec = {
  src: {
    components: { "...": "tsx" },
    utils: { "...": "ts" }
  },
  "tests?": { "...": "test.ts" },
  "docs?": { "...": "md" }
}
```

## Features

- **Macro expansion** - Define reusable patterns
- **Wildcard matching** - `"..."` matches any name
- **Optional directories** - `"name?"` for optional paths
- **Array specifications** - Multiple allowed options
- **Custom validation rules** - Add business logic
- **Watch mode support** - Auto-revalidate on changes

## Integration Benefits

By integrating with bootstrap:
- **Unified testing** - Structure validation runs with all other checks
- **Early detection** - Structure issues are shown first
- **Watch mode** - Auto-revalidates structure on file changes
- **Consistent interface** - Same command for all validations