// deno run --allow-run deno_lint.ts

import { Issue, IssueResponse } from "../utils/mod.ts";

/**
 * Run `deno lint --json` on the given root.
 * Returns lint issues in { issue, location } format.
 */
export async function runDenoLint(root = "src"): Promise<IssueResponse> {
  const name = "deno lint";
  const cmd = new Deno.Command("deno", {
    args: ["lint", "--json", root],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  if (code !== 0 && !out.trim()) {
    // If linting failed unexpectedly (not just lint errors), surface that.
    return {
      name,
      issues: [
        {
          issue: `deno lint failed (exit ${code}): ${err.trim() || "unknown error"}`,
          location: root,
        },
      ],
      message: "",
    };
  }

  let results: any;
  try {
    results = JSON.parse(out);
  } catch (_) {
    return {
      name,
      issues: [
        {
          issue: `Failed to parse deno lint output: ${out || err}`,
          location: root,
        },
      ],
      message: "",
    };
  }

  const issues: Issue[] = [];
  if (Array.isArray(results)) {
    for (const file of results) {
      for (const d of file.diagnostics ?? []) {
        issues.push({
          issue: `[${d.code}] ${d.message}`,
          location: `${file.filePath}:${d.range.start.line + 1}:${d.range.start.col + 1}`,
        });
      }
    }
  }

  return {
    name,
    issues,
    message: "",
  };
}
