// deno run --allow-run --allow-read deno_check.ts

import { Issue, IssueResponse } from "../utils/mod.ts";

/**
 * Run `deno check` on the given root directory.
 * Returns a list of issues in the format { issue, location }.
 */
export async function runDenoCheck(root = "src"): Promise<IssueResponse> {
  const issues: Issue[] = [];

  // Run deno check on the entire directory
  const cmd = new Deno.Command("deno", {
    args: ["check", "."],
    cwd: root, // Run from the target directory
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  if (code !== 0) {
    // Parse diagnostics from stderr
    const lines = err.split("\n").filter((l) => l.trim().length > 0);

    let currentError = "";
    let currentLocation = "";

    for (const line of lines) {
      // Skip warning lines
      if (line.includes("[33mWarning") || line.includes("Warning")) {
        continue;
      }

      // Match error line like: "error: Relative import path..."
      if (line.includes("error:") || line.includes("[31merror")) {
        // Clean ANSI codes and extract error message
        currentError = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/^.*?error:\s*/, "").trim();
      }

      // Match location line like: "at file:///path/to/file.ts:17:29"
      const locationMatch = line.match(/at\s+(file:\/\/[^:]+):(\d+):(\d+)/);
      if (locationMatch) {
        currentLocation = `${locationMatch[1].replace("file://", "")}:${locationMatch[2]}:${locationMatch[3]}`;

        // When we have both error and location, push the issue
        if (currentError && currentLocation) {
          issues.push({
            issue: currentError,
            location: currentLocation,
          });
          currentError = "";
          currentLocation = "";
        }
      }

      // Also match TypeScript errors like "TS2322 [ERROR]: Type 'string' is not assignable..."
      const tsErrorMatch = line.match(/TS\d+\s*\[ERROR\]:\s*(.+)/);
      if (tsErrorMatch) {
        currentError = tsErrorMatch[1].trim();
      }
    }

    // If we have an error without location, add it with the root as location
    if (currentError && !currentLocation) {
      issues.push({
        issue: currentError,
        location: root,
      });
    }
  }

  return {
    name: "deno check",
    issues,
    message: "",
  };
}
