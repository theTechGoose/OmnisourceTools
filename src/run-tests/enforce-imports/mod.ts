import { Issue, IssueResponse } from "../utils/mod.ts";
// deno run --allow-run find_bad_imports.ts
// ^ needs --allow-run because we invoke `grep`.

export function parseGrepOutput(grepOutput: string): Issue[] {
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
        issue: `Invalid relative import found: ${content.trim()}`,
        location: `${file}:${lineNum}`,
      };
    });
}

/**
 * Runs: grep -rn --include="*.ts" "import .*['\"]\.\.\/" <root>
 * Returns parsed issues. If no matches are found, returns [].
 *
 * Note: Requires `grep` to be available (works on macOS/Linux).
 */
export async function findInvalidRelativeImports(
  root = "src",
): Promise<IssueResponse> {
  const name = "enforce-imports";
  // Pattern matches: import ... "../" or "../../" etc.
  // Pass the pattern as one arg (no shell), so no need to escape for a shell.
  const args = ["-rn", `--include=*.ts`, String.raw`import .*['"]\.\.\/`, root];

  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  // grep exits with:
  // 0 -> matches found
  // 1 -> no matches
  // >1 -> error
  if (code === 1) return { name, issues: [], message: "" }; // no matches

  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  if (code !== 0) {
    // Surface grep's error message as an Issue for visibility
    return {
      name,
      issues: [
        {
          issue: `grep failed (exit ${code}): ${err.trim() || "unknown error"}`,
          location: root,
        },
      ],
      message: "",
    };
  }

  return {
    name,
    issues: parseGrepOutput(out),
    message: "",
  };
}

/** Example CLI usage */
if (import.meta.main) {
  const root = Deno.args[0] ?? "src";
  const result = await findInvalidRelativeImports(root);
  if (result.issues.length === 0) {
    console.log("✅ No invalid relative imports (with `..`) found.");
  } else {
    for (const i of result.issues) {
      console.log(`${i.location} -> ${i.issue}`);
    }
    // Non-zero exit to make it CI-friendly
    Deno.exit(2);
  }
}
