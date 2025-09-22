// deno run --allow-run --allow-read deno_check.ts

import { Issue, IssueResponse } from "@/domain/data/types.ts";

/**
 * Run `deno check` on all .ts files under the given root directory.
 * Returns a list of issues in the format { issue, location }.
 */
export async function runDenoCheck(root = "src"): Promise<IssueResponse> {
  const issues: Issue[] = [];

  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      const out = await runDenoCheck(path);
      issues.push(...out.issues);
    } else if (entry.isFile && path.endsWith(".ts")) {
      const cmd = new Deno.Command("deno", {
        args: ["check", path],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await cmd.output();
      const out = new TextDecoder().decode(stdout);
      const err = new TextDecoder().decode(stderr);

      if (code !== 0) {
        // Parse diagnostics: lines typically look like
        // error: TS2322 [ERROR]: Type 'string' is not assignable to type 'number'.
        // at file:///.../foo.ts:10:5
        const lines = (out + "\n" + err)
          .split("\n")
          .filter((l) => l.trim().length > 0);

        let currentFile = path;
        for (const line of lines) {
          const fileMatch = line.match(/at (file:\/\/.*):(\d+):(\d+)/);
          if (fileMatch) {
            currentFile = fileMatch[1].replace("file://", "");
            issues.push({
              issue: "Type check error",
              location: `${currentFile}:${fileMatch[2]}`,
            });
          } else if (line.startsWith("error:") || line.includes("[ERROR]")) {
            issues.push({
              issue: line.trim(),
              location: currentFile,
            });
          }
        }
      }
    }
  }

  return {
    name: "deno check",
    issues,
    message: "",
  };
}
