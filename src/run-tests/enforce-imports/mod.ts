import { Issue, IssueResponse } from "../utils/mod.ts";
// deno run --allow-run enforce_imports.ts
// ^ needs --allow-run because we invoke `grep`.

export function parseGrepOutput(grepOutput: string, issueType: string): Issue[] {
  return grepOutput
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^(.*?):(\d+):(.*)$/);
      if (!match) {
        return {
          issue: `Unrecognized grep output format: ${line}`,
          location: "unknown",
        };
      }
      const [, file, lineNum, content] = match;
      return {
        issue: `${issueType}: ${content.trim()}`,
        location: `${file}:${lineNum}`,
      };
    });
}

/**
 * Checks for various import rule violations:
 * 1. Invalid relative imports with "../"
 * 2. Repository imports that should use @ prefix
 * 3. npm: imports that should use # prefix in import map
 * 4. node: imports that should be bare (no prefix) in import map
 * 5. External packages that aren't pinned to specific versions
 */
export async function enforceImportRules(
  root = "src",
): Promise<IssueResponse> {
  const name = "enforce-imports";
  const allIssues: Issue[] = [];

  // 1. Check for invalid relative imports (../)
  const relativeImports = await findRelativeImports(root);
  allIssues.push(...relativeImports);

  // 2. Check for repo imports that should use @ prefix
  const repoImports = await findInvalidRepoImports(root);
  allIssues.push(...repoImports);

  // 3. Check for npm: imports that don't use # prefix
  const npmImports = await findInvalidNpmImports(root);
  allIssues.push(...npmImports);

  // 4. Check for node: imports that use prefix (should be bare)
  const nodeImports = await findInvalidNodeImports(root);
  allIssues.push(...nodeImports);

  // 5. Check for unpinned external package versions
  const unpinnedVersions = await findUnpinnedVersions(root);
  allIssues.push(...unpinnedVersions);

  return {
    name,
    issues: allIssues,
    message: allIssues.length === 0 ? "All import rules are followed" : "",
  };
}

/**
 * Finds relative imports with "../"
 */
async function findRelativeImports(root: string): Promise<Issue[]> {
  // Pattern matches: import statements with "../" (allowing whitespace)
  const args = ["-rn", `--include=*.ts`, String.raw`^\s*import .*['"]\.\.\/`, root];

  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code === 1) return []; // no matches

  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  if (code !== 0) {
    return [{
      issue: `grep failed (exit ${code}): ${err.trim() || "unknown error"}`,
      location: root,
    }];
  }

  return parseGrepOutput(out, "Invalid relative import found");
}

/**
 * Finds repository imports that should use @ prefix
 * Looks for imports from ./src/, src/, or ./ that don't use @ or other valid prefixes
 */
async function findInvalidRepoImports(root: string): Promise<Issue[]> {
  // Pattern matches import statements from ./src or src or local ./ paths (excluding ./mod.ts patterns)
  // These should be using @ prefixed paths from import map
  const patterns = [
    // Direct ./src/ imports (with optional whitespace)
    String.raw`^\s*import .*['"]\.\/src\/`,
    // Direct src/ imports (with optional whitespace)
    String.raw`^\s*import .*['"]src\/`,
    // Local ./ imports with subdirectories (with optional whitespace)
    String.raw`^\s*import .*['"]\.\/.*\/.*['"]`,
  ];

  const allIssues: Issue[] = [];

  for (const pattern of patterns) {
    const args = ["-rn", `--include=*.ts`, pattern, root];

    const cmd = new Deno.Command("grep", {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await cmd.output();

    if (code === 0) {
      const out = new TextDecoder().decode(stdout);
      // Filter out valid local file imports like ./mod.ts, ./test.ts
      const lines = out.split("\n").filter(line => {
        // Allow direct file imports in same directory
        if (line.match(/^.*:.*:\s*import .*['"]\.\/[^\/]+\.ts['"]/)) {
          return false;
        }
        return line.trim().length > 0;
      });
      if (lines.length > 0) {
        const issues = parseGrepOutput(lines.join("\n"), "Repository import should use @ prefix from import map");
        allIssues.push(...issues);
      }
    }
  }

  return allIssues;
}

/**
 * Finds npm: imports that don't use # prefix in import map
 * npm: imports should be mapped with # prefix (e.g., "#class-validator": "npm:class-validator")
 */
async function findInvalidNpmImports(root: string): Promise<Issue[]> {
  // Look for direct npm: imports in code (with optional whitespace)
  const pattern = String.raw`^\s*import .*['"]npm:`;

  const args = ["-rn", `--include=*.ts`, pattern, root];

  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await cmd.output();

  if (code === 1) return []; // no matches

  if (code === 0) {
    const out = new TextDecoder().decode(stdout);
    return parseGrepOutput(out, "npm: imports should use # prefix from import map (e.g., import '#class-validator')");
  }

  return [];
}

/**
 * Finds node: imports that use prefix (should be bare)
 * node: imports should be mapped with bare names (e.g., "fs": "node:fs")
 */
async function findInvalidNodeImports(root: string): Promise<Issue[]> {
  // Look for direct node: imports in code (with optional whitespace)
  const pattern = String.raw`^\s*import .*['"]node:`;

  const args = ["-rn", `--include=*.ts`, pattern, root];

  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await cmd.output();

  if (code === 1) return []; // no matches

  if (code === 0) {
    const out = new TextDecoder().decode(stdout);
    return parseGrepOutput(out, "node: imports should use bare names from import map (e.g., import 'fs' not 'node:fs')");
  }

  return [];
}

/**
 * Finds external package imports with unpinned versions (using ^, ~, or ranges) or no version
 */
async function findUnpinnedVersions(root: string): Promise<Issue[]> {
  const allIssues: Issue[] = [];

  // Check for deno.json or deno.jsonc files
  const configPatterns = [
    String.raw`^\s*".*":\s*".*[\^~]`, // Matches versions with ^ or ~
    String.raw`^\s*".*":\s*".*\*`, // Matches versions with *
    String.raw`^\s*".*":\s*"(npm|jsr|https?):.*@[\^~]`, // Direct version specs with ^ or ~
    String.raw`^\s*".*":\s*"(npm|jsr):.*@\*`, // Direct version specs with *
    String.raw`^\s*".*":\s*"(npm|jsr):`, // npm/jsr packages (we'll check for version later)
  ];

  // Look for deno config files
  const configFiles = ["deno.json", "deno.jsonc"];
  for (const configFile of configFiles) {
    const configPath = `${root}/${configFile}`;

    // Check if file exists
    try {
      await Deno.stat(configPath);
    } catch {
      continue; // File doesn't exist, skip
    }

    for (const pattern of configPatterns) {
      const args = ["-nE", pattern, configPath];

      const cmd = new Deno.Command("grep", {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout } = await cmd.output();

      if (code === 0) {
        const out = new TextDecoder().decode(stdout);
        const lines = out.split("\n").filter(line => {
          // Filter out non-import lines and comments
          if (line.includes("//") || !line.trim()) return false;
          // Check if this is in the imports section (simple heuristic)
          return true;
        });

        for (const line of lines) {
          const match = line.match(/^(\d+):(.*)/);
          if (match) {
            const [, lineNum, content] = match;

            // Determine the issue type based on the pattern that matched
            let issueMessage = "";

            // Check if this is an unversioned npm/jsr package
            if (pattern === String.raw`^\s*".*":\s*"(npm|jsr):`) {
              // Only flag if there's no @version (@ followed by a number)
              if (!content.match(/@[\d]/)) {
                issueMessage = `External package must have a version specified: ${content.trim()}`;
              }
            } else {
              // For other patterns (^, ~, *)
              issueMessage = `External package version should be pinned (remove ^, ~, or *): ${content.trim()}`;
            }

            if (issueMessage) {
              allIssues.push({
                issue: issueMessage,
                location: `${configPath}:${lineNum}`,
              });
            }
          }
        }
      }
    }
  }

  // Also check for direct imports in TypeScript files with version ranges or no version
  const tsPatterns = [
    String.raw`^\s*import .*['"]https?://.*@[\^~]`, // URL imports with ^ or ~
    String.raw`^\s*import .*['"]https?://.*@\*`, // URL imports with *
    String.raw`^\s*import .*['"]https?://deno\.land/(std|x)/[^@]*['"]`, // deno.land imports without @ version
    String.raw`^\s*import .*['"]https?://esm\.sh/[^@?]*['"]`, // esm.sh imports without @ version
  ];

  for (const pattern of tsPatterns) {
    const args = ["-rnE", `--include=*.ts`, pattern, root];

    const cmd = new Deno.Command("grep", {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await cmd.output();

    if (code === 0) {
      const out = new TextDecoder().decode(stdout);
      let issueType = "External package version should be pinned (remove ^, ~, or *)";

      // Check if this pattern is for unversioned imports
      if (pattern.includes("[^@]*['")) {
        issueType = "External package must have a version specified";
      }

      const issues = parseGrepOutput(out, issueType);
      allIssues.push(...issues);
    }
  }

  return allIssues;
}

/**
 * Backward compatibility - calls the new enforceImportRules function
 */
export async function findInvalidRelativeImports(
  root = "src",
): Promise<IssueResponse> {
  return enforceImportRules(root);
}

/** Example CLI usage */
if (import.meta.main) {
  const root = Deno.args[0] ?? "src";
  const result = await enforceImportRules(root);
  if (result.issues.length === 0) {
    console.log("✅ All import rules are followed correctly:");
    console.log("  - No invalid relative imports (../)");
    console.log("  - Repository imports use @ prefix from import map");
    console.log("  - npm: imports use # prefix from import map");
    console.log("  - node: imports use bare names from import map");
    console.log("  - External packages are pinned to specific versions");
  } else {
    console.log("❌ Found import rule violations:");
    for (const i of result.issues) {
      console.log(`  ${i.location} -> ${i.issue}`);
    }
    // Non-zero exit to make it CI-friendly
    Deno.exit(2);
  }
}