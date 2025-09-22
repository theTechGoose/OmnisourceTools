# Contributing to OmnisourceTools

## Code Quality Standards

All contributions must pass the omni-diag diagnostic tool checks before submission. This tool enforces our code quality and architectural standards.

## Project Structure

We follow a clean architecture pattern with specific module types:

### Module Structure Types

#### 1. **Basic Pattern**

Simple modules with straightforward structure:

```
basic-module/
├── mod.ts           # Main module export
├── test.ts          # Unit tests (required)
└── surface/         # Optional submodules following same pattern
    └── ...
```

#### 2. **Polymorphic Pattern**

Modules with multiple implementations of a base interface:

```
polymorphic-module/
├── base.ts          # Base interface/abstract class
├── mod.ts           # Module exports
├── test.ts          # Tests for base functionality
└── implementations/
    ├── impl-one/
    │   ├── mod.ts
    │   └── test.ts
    └── impl-two/
        ├── mod.ts
        └── test.ts
```

#### 3. **Developed Pattern**

Fully structured modules following clean architecture:

```
developed-project/
├── bootstrap.ts     # Entry point only
├── deno.json       # Module configuration
├── design.ts       # Design documentation
├── dto.ts       # Design documentation
<...module-name>
    ├── domain/
    │   ├── business/   # Pure logic patterns
    │   │   └── pattern/
    │   │       ├── mod.ts
    │   │       └── test.ts
    │   └── data/       # I/O operations
    │       └── feature/
    │           ├── mod.ts
    │           └── test.ts
    └── routes/         # HTTP endpoints (optional)
```

#### 4. **Undeveloped Pattern**

Modules in early stages that can use any pattern:

```
undeveloped-project/
├── bootstrap.ts     # Entry point only
├── deno.json       # Module configuration
├── design.ts       # Design documentation
├── dto.ts       # Design documentation
├── domain/
│   ├── business/   # Pure logic patterns
│   │   └── pattern/
│   │       ├── mod.ts
│   │       └── test.ts
│   └── data/       # I/O operations
│       └── feature/
│           ├── mod.ts
│           └── test.ts
└── routes/         # HTTP endpoints (optional)
```

### Test File Types

#### test.ts - Standard Unit Tests

Regular unit tests that must pass:

```typescript
Deno.test("Feature should work", () => {
  assertEquals(feature(), expected);
});
```

#### nop.test.ts - No-Operation Tests

Tests that are not intended to be run by cicd

Use nop.test.ts when:

- Making tests in data or examples

### Choosing the Right Pattern

- **Basic**: For simple, self-contained functionality
- **Polymorphic**: When you have multiple implementations of the same interface
- **Developed**: For complex modules requiring clean architecture separation
- **Undeveloped**: For new modules that will evolve as requirements clarify

### Architectural Rules

1. **NO utility folders**: Do not create `utils/`, `helpers/`, or `common/` folders
2. **NO services at root**: Services belong in appropriate domain layers
3. **NO scripts folder**: Scripts should be tasks in deno.json
4. **Domain separation** - Understanding the difference:

#### domain/business/ - Pure Business Logic

- **What it contains**: Basic, reusable patterns and pure functions
- **Characteristics**:
  - NO side effects (no I/O, no database, no network calls)
  - Fully testable with simple unit tests
  - Can be tested without mocks or stubs
  - Examples: Result pattern, validation rules, calculation functions, business rules
- **Why**: These are the core business concepts that never change regardless of infrastructure

#### domain/data/ - Data & I/O Operations

- **What it contains**: All operations that interact with the outside world
- **Characteristics**:
  - File system operations (reading/writing files)
  - Network calls (HTTP requests, API calls)
  - Database operations
  - Command execution (running external programs)
  - External service integrations
- **Why**: These operations are infrastructure-dependent and may need mocking in tests

### File and Folder Naming Conventions

**ALL files and folders must use kebab-case**:

- ✅ `user-auth/`, `enforce-dirs/`, `diagnostic-analyzer.ts`
- ❌ `userAuth/`, `enforce_dirs/`, `DiagnosticAnalyzer.ts`

Standard file names:

- Use `mod.ts` for module exports
- Use `test.ts` for unit tests
- Always include `.ts` extension in imports

## Code Standards

### TypeScript Requirements

- No use of `any` without `deno-lint-ignore` comment
- Validate data at boundaries using DTOs

### Private Constructors with Static Factory Methods

**Why we use this pattern:**

1. **Controlled instantiation**: Prevents direct `new ClassName()` calls, giving us control over object creation
2. **Validation before creation**: Factory methods can validate inputs and return errors without throwing
3. **Singleton capability**: Can return cached instances when appropriate
4. **Future flexibility**: Can change implementation without breaking API
5. **Better testing**: Can mock or substitute implementations easily

**Implementation pattern:**

```typescript
// ✅ CORRECT: Private constructor with static factory
export class DiagnosticAnalyzer {
  private constructor() {} // Private: can't be called externally

  static create(): DiagnosticAnalyzer {
    // Can add validation, caching, or setup logic here
    return new DiagnosticAnalyzer();
  }

  // Alternative: factory that can fail
  static fromConfig(config: Config): Result<DiagnosticAnalyzer, Error> {
    if (!isValidConfig(config)) {
      return ResultPattern.err(new Error("Invalid configuration"));
    }
    return ResultPattern.ok(new DiagnosticAnalyzer());
  }
}

// Usage
const analyzer = DiagnosticAnalyzer.create();

// ❌ WRONG: Public constructor
export class BadExample {
  constructor() {} // Public: anyone can create instances without control
}
```

This pattern ensures:

- Classes can evolve without breaking changes
- Object creation is always valid
- Implementation details are hidden
- Testing is simplified through controlled instantiation

### Import Rules

- Always include `.ts` extension in imports
- No relative imports beyond 2 levels (`../../`)
- Prefer absolute imports from module root

### Testing

Every module in `domain/` must have corresponding tests:

```typescript
// domain/business/example/mod.ts
export class Example {
  private constructor() {}

  static create(): Example {
    return new Example();
  }
}

// domain/business/example/test.ts
import { assertEquals } from "@std/assert";
import { Example } from "./mod.ts";

Deno.test("Example - create instance", () => {
  const example = Example.create();
  assertExists(example);
});
```

## Common Mistakes to Avoid

- ❌ Creating utility functions outside domain layers
- ❌ Mixing business logic with I/O operations
- ❌ Skipping tests for new modules
- ❌ Using relative imports beyond two levels
- ❌ Forgetting `.ts` extensions in imports
- ❌ Creating services or DTOs at module root level

