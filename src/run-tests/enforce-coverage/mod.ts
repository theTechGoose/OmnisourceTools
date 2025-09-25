import { Issue, IssueResponse } from "../utils/mod.ts";
import { walk } from "https://deno.land/std@0.190.0/fs/walk.ts";

/**
 * Check test files for minimum coverage (more than 10 lines).
 * Returns issues for test files with insufficient coverage.
 */
export async function checkTestCoverage(root = "."): Promise<IssueResponse> {
  const issues: Issue[] = [];

  try {
    // Walk through all files looking for test files
    for await (const entry of walk(root, {
      exts: ["ts"],
      match: [/\.test\.ts$/],
      skip: [/node_modules/, /\.git/],
    })) {
      if (entry.isFile) {
        try {
          const content = await Deno.readTextFile(entry.path);
          const lines = content.split("\n");

          // Count non-empty, non-comment lines
          let meaningfulLines = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and comment-only lines
            if (trimmed && !trimmed.startsWith("//")) {
              meaningfulLines++;
            }
          }

          if (meaningfulLines <= 10) {
            issues.push({
              issue: "test coverage too low",
              location: entry.path,
            });
          }
        } catch (err) {
          // Skip files we can't read
          console.error(`Could not read ${entry.path}: ${err}`);
        }
      }
    }
  } catch (err) {
    issues.push({
      issue: `Failed to check test coverage: ${err}`,
      location: root,
    });
  }

  return {
    name: "test coverage",
    issues,
    message: "",
  };
}