// deno run --allow-run deno_test.ts

import { getEnvFile, Issue, IssueResponse } from "../utils/mod.ts";

/**
 * Run `deno test -A` on the given root.
 * Returns test failures in { issue, location } format.
 */
export async function runDenoTest(root = "src"): Promise<IssueResponse> {
  const name = "deno test";
  const path = await import("node:path");

  // Resolve to absolute path if relative
  const absoluteRoot = root.startsWith("/") ? root : path.resolve(root);

  const envFile = await getEnvFile(absoluteRoot);
  const envFileArg = envFile ? `--env-file=${envFile}` : "";
  const excudeTestsDir = "--ignore=**/tests/**/*";
  const excludeDataDirs = "--ignore=**/data/**/*";
  const excludeNopDirs = "--ignore=**/*.nop.test.ts";
  const excludeDesignDir = "--ignore=**/design/**/*";
  const cmd = new Deno.Command("deno", {
    args: [
      "test",
      "-A",
      "--no-check",
      excludeDataDirs,
      excudeTestsDir,
      excludeDesignDir,
      excludeNopDirs,
      envFileArg,
      absoluteRoot,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  // parse out and err into this
  const issues = [] as Issue[];

  // Parse test failures from stdout
  if (code !== 0) {
    // Extract failure information from FAILURES section
    // Need to handle ANSI escape codes in the regex
    const failuresMatch = out.match(
      /FAILURES\s*(?:\x1b\[0m)?\s*\n+([\s\S]*?)(?:\n\n|\n$)/,
    );
    if (failuresMatch) {
      const failuresSection = failuresMatch[1];
      // Match pattern: "test name => path/to/file.ts:line:column"
      // Need to handle ANSI codes in the output
      const failurePattern =
        /^(.+?)\s*(?:\x1b\[.*?m)?=>\s*(.+?):(\d+):(\d+)(?:\x1b\[.*?m)?$/gm;
      let match;

      while ((match = failurePattern.exec(failuresSection)) !== null) {
        let [, testName, filePath, line, column] = match;
        // Strip ANSI codes from testName and filePath
        testName = testName.replace(/\x1b\[.*?m/g, "").trim();
        filePath = filePath.replace(/\x1b\[.*?m/g, "").trim();

        // Convert relative path to absolute path
        const absolutePath = filePath.startsWith("/")
          ? filePath
          : path.resolve(absoluteRoot, filePath);

        // Extract error details from ERRORS section if available
        // Need to escape ANSI codes in the pattern too
        const cleanTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const errorPattern = new RegExp(
          `${cleanTestName}[\\s\\S]*?(?:\\x1b\\[.*?m)?error(?:\\x1b\\[.*?m)?:\\s*(.+?)(?:\\n|$)`,
          "m",
        );
        const errorMatch = out.match(errorPattern);
        const errorMessage = errorMatch
          ? errorMatch[1].replace(/\x1b\[.*?m/g, "").trim()
          : `Test failed: ${testName}`;

        issues.push({
          issue: errorMessage,
          location: `${absolutePath}:${line}:${column}`,
        });
      }
    }

    // Also check for general test failures without FAILURES section
    // Pattern for failed tests in the output (e.g., "test name ... FAILED")
    const failedTestPattern = /^(.+?)\s+\.\.\.\s+.*FAILED.*$/gm;
    const processedTests = new Set<string>();

    let failedMatch;
    while ((failedMatch = failedTestPattern.exec(out)) !== null) {
      const testName = failedMatch[1].trim();
      // Skip if we already processed this test in FAILURES section
      if (!issues.some((i) => i.issue.includes(testName))) {
        // Try to find file location from running tests header
        const runningPattern = new RegExp(
          `running \\d+ tests? from (.+?)\\n[\\s\\S]*?${testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "m",
        );
        const runningMatch = out.match(runningPattern);
        let location = runningMatch ? runningMatch[1] : absoluteRoot;

        // Strip ANSI codes from location
        location = location.replace(/\x1b\[.*?m/g, "").trim();

        // Convert relative path to absolute path
        const absolutePath = location.startsWith("/")
          ? location
          : path.resolve(absoluteRoot, location);

        if (!processedTests.has(testName)) {
          issues.push({
            issue: `Test failed: ${testName}`,
            location: absolutePath,
          });
          processedTests.add(testName);
        }
      }
    }
  }

  // Parse any compilation/runtime errors from stderr
  if (err && err.length > 0) {
    // Skip env file warnings
    const cleanErr = err.replace(/^.*Warning.*--env-file.*\n/gm, "");

    if (cleanErr.includes("error:")) {
      // Extract error messages (skip "error: Test failed" which is generic)
      const errorPattern = /error:\s*(.+?)(?:\n|$)/g;
      let errorMatch;

      while ((errorMatch = errorPattern.exec(cleanErr)) !== null) {
        const errorMsg = errorMatch[1].trim();
        if (errorMsg !== "Test failed") {
          // Try to extract file location from error
          const filePattern = /at\s+(.+?):(\d+):(\d+)/;
          const fileMatch = cleanErr.match(filePattern);

          const location = fileMatch
            ? `${fileMatch[1]}:${fileMatch[2]}:${fileMatch[3]}`
            : absoluteRoot;

          issues.push({
            issue: errorMsg,
            location: location,
          });
        }
      }
    }
  }

  return {
    name,
    issues,
    message: `Note: envfile located at: ${envFile ?? "none"}, please do not copy secrets, just reference the file`,
  };
}
