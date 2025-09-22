# Directory Structure Validation Command - Implementation Plan

## Overview
Create a command-line tool that validates a directory structure against a specification written in the file system structure DSL.

## Command Interface

### Basic Usage
```bash
deno run --allow-read validate.ts ./target-directory
deno run --allow-read validate.ts .  # validate current directory
```

The command simply takes a target directory as its single argument. No flags or options are supported.

## Core Components

### 1. Spec Imports
**Purpose**: Import specification from a separate file

- [ ] Import `structure` and `macros` from separate spec file
  - **Test**: Create a simple spec file with exports, verify imports work
  - **Validation**: `console.log(structure, macros)` should show imported objects

- [ ] Import `rules` if defined
  - **Test**: Create spec with and without rules export
  - **Validation**: Handle both cases without errors

- [ ] Validate spec syntax (ensure all macro references exist, etc.)
  - **Test**: Create spec with invalid macro reference `#nonExistent`
  - **Validation**: Should throw clear error about missing macro

- [ ] Build internal representation of the complete spec tree
  - **Test**: Log the built representation for a simple spec
  - **Validation**: Structure should be properly nested object

### 2. Macro Expander
**Purpose**: Resolve all macro references into concrete specifications

- [ ] Implement recursive macro expansion
  - **Test**: Create macro that references another macro: `basic: { sub: "#other" }`
  - **Validation**: Expanded result should have no `#` references

- [ ] Handle circular reference detection
  - **Test**: Create circular reference: `a: "#b", b: "#a"`
  - **Validation**: Should throw error about circular dependency

- [ ] Cache expanded macros for performance
  - **Test**: Expand same macro multiple times, measure time
  - **Validation**: Second expansion should be faster

- [ ] Support nested macro references
  - **Test**: Use macro in array: `["ts", "#basic"]`
  - **Validation**: Result should merge both specs correctly

### 3. Directory Walker
**Purpose**: Traverse the actual file system

- [ ] Implement efficient directory traversal
  - **Test**: Create test directory with known structure
  - **Validation**: `scanDirectory()` returns all files/dirs as object

- [ ] Build file system tree representation
  - **Test**: Directory with nested folders and files
  - **Validation**: Tree object matches actual structure

- [ ] Apply ignore patterns
  - **Test**: Add node_modules to test directory
  - **Validation**: Should not appear in scanned results

- [ ] Handle symbolic links appropriately
  - **Test**: Create symlink in test directory
  - **Validation**: Should skip or follow based on implementation

### 4. Validator Engine
**Purpose**: Compare actual structure against specification

- [ ] Implement spec matching logic:
  - [ ] Exact name matching
    - **Test**: Spec: `{ "config": "json" }`, create config.json
    - **Validation**: No issues returned

  - [ ] Wildcard (`...`) matching
    - **Test**: Spec: `{ "...": "ts" }`, create any.ts, other.ts
    - **Validation**: All .ts files validate without issues

  - [ ] Optional directory (`?`) handling
    - **Test**: Spec: `{ "tests?": "ts" }`, run with and without tests/
    - **Validation**: Both cases should pass

  - [ ] Array (any-of) validation
    - **Test**: Spec: `["ts", "js"]`, create file.ts
    - **Validation**: Should pass for either extension

- [ ] Execute validation rules (`@rule` references)
  - **Test**: Add `@noRoot` rule to path with _root
  - **Validation**: Should return rule's error message

- [ ] Track validation state and errors
  - **Test**: Run validation on structure with multiple issues
  - **Validation**: All issues collected in result array

### 5. Rule Executor
**Purpose**: Run custom validation rules

- [ ] Load and execute rule functions
  - **Test**: Create simple rule that checks path length
  - **Validation**: Rule executes and returns result

- [ ] Handle async rules properly
  - **Test**: Create async rule that reads file content
  - **Validation**: Await works, result returned correctly

- [ ] Provide rule context (path, parent, etc.)
  - **Test**: Rule that uses path parameter
  - **Validation**: Path matches the file being validated

- [ ] Collect rule violation messages
  - **Test**: Rule that returns error message
  - **Validation**: Message appears in issues array

### 6. Error Reporter
**Purpose**: Present validation results to the user

- [ ] Format human-readable error messages
  - **Test**: Create issue with location and message
  - **Validation**: Output format: `❌ path/to/file: error message`

- [ ] Show file paths with context
  - **Test**: Deep nested path error
  - **Validation**: Full path shown in output

- [ ] Group errors by type/severity
  - **Test**: Mix of missing files and rule violations
  - **Validation**: Errors grouped logically in output

- [ ] Support JSON output format
  - **Test**: Return IssueResponse object
  - **Validation**: Valid JSON structure with issues array

- [ ] Provide fix suggestions
  - **Test**: Missing required file
  - **Validation**: Suggests creating the file

### 7. Main Entry Point
**Purpose**: CLI entry point with `import.meta.main` check

- [ ] Parse command line arguments (target directory)
  - **Test**: Run with `deno run validate.ts /some/path`
  - **Validation**: Uses `/some/path` as target

- [ ] Call validation function
  - **Test**: Mock validateStructure, verify it's called
  - **Validation**: Function called with correct argument

- [ ] Display results to console
  - **Test**: Run with valid/invalid structure
  - **Validation**: See success/error messages in console

- [ ] Exit with appropriate status code
  - **Test**: Check `$?` after running command
  - **Validation**: 0 for success, 1 for errors

## Validation Algorithm

```typescript
import type { IssueResponse, Issue, Spec, Rule } from '../utils/mod.ts'
// Import from separate spec file
import { structure, macros } from './my-spec.ts'

export function validateStructure(targetDir: string = '.'): IssueResponse {
  // Phase 1: Load and prepare (specs are imported directly)
  const expandedSpec = expandMacros(structure, macros)

  // Phase 2: Scan file system
  const actualStructure = scanDirectory(targetDir)

  // Phase 3: Validate structure
  const issues: Issue[] = []
  validateNode(expandedSpec, actualStructure, targetDir, issues, {})

  // Phase 4: Return IssueResponse format
  return {
    name: `validate-structure: ${targetDir}`,
    issues: issues,
    message: issues.length === 0
      ? "All validations passed"
      : `Found ${issues.length} validation issue(s)`
  }
}

function validateNode(spec: Spec, actual, path: string, issues: Issue[], rules: Record<string, Rule>) {
  if (typeof spec === 'string') {
    // Validate file extension
    if (!validateFileExtension(actual, spec)) {
      issues.push({
        issue: `Expected file with extension .${spec}`,
        location: path
      })
    }
  } else if (Array.isArray(spec)) {
    // Validate any-of options
    const valid = spec.some(s => validateSpec(s, actual, path, rules))
    if (!valid) {
      issues.push({
        issue: `Does not match any of the allowed specifications: ${spec.join(', ')}`,
        location: path
      })
    }
  } else if (typeof spec === 'object') {
    // Validate directory structure
    for (const [key, value] of Object.entries(spec)) {
      if (key === '...') {
        // Handle wildcard matching
      } else if (key.endsWith('?')) {
        // Handle optional directory
      } else {
        // Handle exact name matching
      }
    }
  }
}

// Main CLI entry point
if (import.meta.main) {
  const targetDir = Deno.args[0] || '.'
  const result = validateStructure(targetDir)

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
}
```

## Error Types

### Critical Errors
- Missing required files
- Missing required directories
- Failed validation rules

### Warnings
- Unexpected files/directories (not in spec)
- Optional directories not present
- Deprecated patterns detected

### Info
- Successfully validated paths
- Applied macros
- Executed rules

## Implementation Phases

### Phase 1: Core Validation (MVP)
- [ ] Basic spec loading
  - **Test**: Load simple spec with one directory
  - **Validation**: Spec object accessible in code

- [ ] Simple macro expansion (no recursion)
  - **Test**: Expand basic macro like `#basic: { mod: "ts" }`
  - **Validation**: `#basic` replaced with actual spec

- [ ] Directory structure validation
  - **Test**: Validate simple directory with few files
  - **Validation**: Correct issues for missing/extra files

- [ ] Basic error reporting
  - **Test**: Generate issues and display them
  - **Validation**: Readable error output to console

### Phase 2: Advanced Features
- [ ] Recursive macro expansion
  - **Test**: Macro with self-reference `surface: { "...": "#basic" }`
  - **Validation**: Fully expanded without infinite loop

- [ ] Rule execution system
  - **Test**: Apply rules from specs.ts
  - **Validation**: Rules execute and return messages

- [ ] Wildcard matching
  - **Test**: Use `"..."` pattern in spec
  - **Validation**: Matches any directory name

- [ ] Optional directory support
  - **Test**: Use `"tests?"` in spec
  - **Validation**: Passes with or without directory

### Phase 3: Enhanced UX
- [ ] Colored terminal output
  - **Test**: Run and visually verify colors
  - **Validation**: ✅ green, ❌ red in terminal

- [ ] Clear error formatting
  - **Test**: Generate various error types
  - **Validation**: Consistent, readable format

### Phase 4: Performance & Polish
- [ ] Parallel validation
  - **Test**: Large directory structure
  - **Validation**: Faster than sequential version

- [ ] Caching for repeated validations
  - **Test**: Run same validation twice
  - **Validation**: Second run is faster

- [ ] Integration with CI/CD pipelines
  - **Test**: Run in GitHub Actions
  - **Validation**: Proper exit codes, parseable output

## Testing Strategy

### Unit Tests
- Spec parser edge cases
- Macro expansion logic
- Individual validation rules
- Error formatting

### Integration Tests
- Complete validation flows
- Complex nested structures
- Macro and rule combinations
- Auto-fix scenarios

### Test Cases
```typescript
// Test fixtures structure
fixtures/
  valid-structure/      // Fully compliant structure
  missing-required/     // Missing required elements
  extra-files/          // Contains unexpected files
  complex-macros/       // Tests macro expansion
  rule-violations/      // Tests rule validation
  optional-dirs/        // Tests optional directory handling
```

## Example Output

### Default Console Output
```
Validating ./my-project against specs.ts...

✓ src/domain/business/user/mod.ts
✓ src/domain/business/user/unit.test.ts
✗ src/domain/data/repository/unit.test.ts
  Error: tests here should be named 'unit.nop.test.ts' to indicate they are no-ops
✗ src/_root/index.ts
  Error: _root is deprecated, use bootstrap.ts instead
⚠ src/utils/helpers.ts
  Warning: Unexpected file (not in specification)

Validation complete: 2 errors, 1 warning
```

### IssueResponse Return Format
```typescript
// Successful validation
{
  name: "validate-structure: ./my-project",
  issues: [],
  message: "All validations passed"
}

// Validation with issues
{
  name: "validate-structure: ./my-project",
  issues: [
    {
      issue: "tests here should be named 'unit.nop.test.ts' to indicate they are no-ops",
      location: "src/domain/data/repository/unit.test.ts"
    },
    {
      issue: "_root is deprecated, use bootstrap.ts instead",
      location: "src/_root/index.ts"
    },
    {
      issue: "Unexpected file (not in specification)",
      location: "src/utils/helpers.ts"
    }
  ],
  message: "Found 3 validation issue(s)"
}
```

### JSON Output (with --json flag)
```json
{
  "name": "validate-structure: ./my-project",
  "issues": [
    {
      "issue": "tests here should be named 'unit.nop.test.ts' to indicate they are no-ops",
      "location": "src/domain/data/repository/unit.test.ts"
    },
    {
      "issue": "_root is deprecated, use bootstrap.ts instead",
      "location": "src/_root/index.ts"
    }
  ],
  "message": "Found 2 validation issue(s)",
  "statistics": {
    "filesChecked": 156,
    "directoriesChecked": 42,
    "issuesFound": 2
  }
}
```

## Dependencies

- **Deno**: Runtime and standard library
- No external dependencies required

## File Structure

```
validate.ts         # Main validation script with import.meta.main
my-spec.ts          # Specification file exporting structure and macros
utils/
  mod.ts            # Shared types (IssueResponse, Issue, Spec, Rule)
```

## Success Criteria

- [ ] Accurately validates against all DSL features
  - **Test**: Run against all DSL syntax examples
  - **Validation**: Each feature works as documented

- [ ] Clear, actionable error messages
  - **Test**: Review all error messages
  - **Validation**: User knows how to fix each issue

- [ ] Performance: < 1 second for typical project
  - **Test**: Run on 1000-file project
  - **Validation**: Completes in under 1 second

- [ ] 100% compatibility with existing spec format
  - **Test**: Use existing specs.ts file
  - **Validation**: No changes needed to spec format

- [ ] Comprehensive test coverage
  - **Test**: Run coverage tool
  - **Validation**: >90% code coverage

- [ ] Developer-friendly CLI experience
  - **Test**: Run various command variations
  - **Validation**: Intuitive, helpful output