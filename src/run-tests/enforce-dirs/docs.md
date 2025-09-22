# File System Structure DSL Documentation

This document describes the Domain-Specific Language (DSL) for defining and enforcing file system structures.

## DSL Overview

The DSL provides a declarative way to specify file system structures with reusable patterns, validation rules, and flexible matching capabilities.

## Core Concepts

### 1. Spec Type
A `Spec` is the fundamental building block that describes a directory or file structure. It can be:
- A string literal (file extension like `"ts"`, `"json"`)
- An array of specs
- An object where keys are paths and values are specs

### 2. Structure Definition
The main structure is defined as a `Spec` object at the root level:

```typescript
const structure: Spec = {
  directoryName: spec,
  fileName: "extension",
  // ...
}
```

## DSL Syntax

### File Specifications

#### Single File Extension
```typescript
"ts"        // Represents a .ts file
"json"      // Represents a .json file
```

#### Multiple File Types
```typescript
["ts", "json", "mp3"]  // Multiple allowed file extensions
```

### Directory Specifications

#### Named Directories
```typescript
{
  src: spec,          // Directory named 'src'
  tests: spec,        // Directory named 'tests'
}
```

#### Wildcard Directories
```typescript
{
  "...": spec        // Matches any directory name
}
```

#### Optional Directories
```typescript
{
  "e2e?": spec       // Optional directory (may or may not exist)
}
```

### Macro System

Macros are reusable patterns defined separately and referenced using the `#` prefix.

#### Defining Macros
```typescript
const macros: Macros = {
  macroName: {
    // Spec definition
  }
}
```

#### Referencing Macros
```typescript
"#macroName"                    // Single macro reference
["#macro1", "#macro2"]          // Multiple macro references
```

#### Recursive Macros
Macros can reference themselves for recursive structures:
```typescript
{
  basic: {
    surface: {
      "...": "#basic"    // Recursive reference
    }
  }
}
```

### Rule System

Rules provide validation logic and are referenced using the `@` prefix.

#### Defining Rules
```typescript
const rules: Rules = {
  ruleName: (path: string) => {
    // Validation logic
    // Return null if valid
    // Return error message if invalid
  }
}
```

Rules can be:
- **Synchronous**: `(path: string) => string | null`
- **Asynchronous**: `async (path: string) => Promise<string | null>`

#### Applying Rules
```typescript
"@ruleName"                     // Apply a single rule
["#macro", "@rule"]            // Combine macros and rules
```

## Complete DSL Grammar

```
Spec ::=
  | string                      // File extension
  | Array<Spec>                 // Multiple specs
  | { [key: string]: Spec }     // Directory structure

MacroReference ::= "#" + macroName
RuleReference ::= "@" + ruleName

DirectoryKey ::=
  | literalName                 // Exact directory name
  | literalName + "?"           // Optional directory
  | "..."                       // Wildcard (any name)

SpecValue ::=
  | Spec
  | MacroReference
  | RuleReference
  | Array<Spec | MacroReference | RuleReference>
```

## Examples

### Basic File Structure
```typescript
{
  config: "json",               // config.json file
  main: "ts",                   // main.ts file
  assets: ["png", "jpg"]        // Multiple image formats
}
```

### Nested Directory Structure
```typescript
{
  src: {
    components: {
      "...": "tsx"              // Any .tsx files in any subdirectory
    }
  }
}
```

### Using Macros for DRY Patterns
```typescript
const macros = {
  module: {
    mod: "ts",
    test: "ts",
    types: "d.ts"
  }
};

const structure = {
  "...": "#module"              // Apply module pattern to any directory
};
```

### Validation Rules
```typescript
const rules = {
  noDeprecated: (path) => {
    if (path.includes("deprecated")) {
      return "Deprecated paths are not allowed";
    }
    return null;
  }
};

const structure = {
  src: ["#basic", "@noDeprecated"]
};
```

### Complex Composition
```typescript
{
  src: {
    "...": {                    // Any subdirectory
      domain: ["#polymorphic", "#basic"],
      api: {
        "...": ["ts", "@validateApi"]
      }
    }
  },
  "tests?": "#testSuite"       // Optional tests directory
}
```

## Special Behaviors

### Array Semantics
When an array is used as a spec value, it means ANY of the items in the array are valid options:
- For file extensions: any of the listed extensions are valid
- For macros: any of the listed macro patterns can match
- For rules: any of the listed rules can apply
- Mixed arrays: any of the specs, macros, or rules in the array are acceptable

### Wildcard Matching
The `"..."` key matches any directory name at that level, allowing for flexible, dynamic structures.

### Optional Directories
Directories suffixed with `?` are optional - the structure is valid whether they exist or not.

### Rule Execution
- Rules receive the full path being validated
- Rules can be async for file system operations
- Return `null` for valid paths, error message for invalid

## Type Definitions

```typescript
type Spec = string | Spec[] | { [key: string]: Spec };
type Macros = Record<string, Spec>;
type Rule = (path: string) => string | null | Promise<string | null>;
type Rules = Record<string, Rule>;
```