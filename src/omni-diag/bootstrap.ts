import { enforceStructure } from "@/domain/data/enforce-dirs/mod.ts";
import { runDenoCheck } from "@/domain/data/enforce-check/mod.ts";
import { findInvalidRelativeImports } from "@/domain/data/enforce-imports/mod.ts";
import { runDenoLint } from "@/domain/data/enforce-lint/mod.ts";
import { runDenoTest } from "@/domain/data/enforce-test/mod.ts";
import { Issue, getRoot } from "@/domain/data/types.ts";

async function main() {
  // Parse command line arguments
  const args = Deno.args.filter((arg) => !arg.startsWith("--"));
  const flags = Deno.args.filter((arg) => arg.startsWith("--"));
  const watchMode = flags.includes("--watch") || flags.includes("-w");

  if (args.length === 0) {
    console.error(
      "Usage: omni-diag [--watch|-w] <dir1> [dir2] [file.test.ts] ...",
    );
    console.error("Example: omni-diag src tests/integration");
    console.error("Example: omni-diag --watch src");
    console.error("Example: omni-diag src/myfile.test.ts");
    Deno.exit(1);
  }

  if (watchMode) {
    console.log(`🔍 Watch mode enabled. Watching: ${args.join(", ")}...`);
    console.log("Press Ctrl+C to exit.\n");
    console.log("📋 Running initial checks...\n");
    await runChecks(args);
    await watchFiles(args);
  } else {
    console.log(`Running checks on: ${args.join(", ")}...`);
    const exitCode = await runChecks(args);
    Deno.exit(exitCode);
  }
}

function logErrs(name: string, errs: Issue[], message: string) {
  if (!errs.length) {
    console.log(`\n✅✅✅✅✅ No ${name} issues found.✅✅✅✅✅\n`);
    return 0;
  }
  console.log(
    `\n=================❌ ${errs.length} ${name} issues found=================\n`,
  );
  let i = 0;
  for (const e of errs) {
    console.log(`Issue ${++i}: location: ${e.location}`);
    console.log(`${e.issue}`);
    console.log("------------------------------------------------------------");
  }

  console.log(message);

  console.log(
    `=======================END ${name.toLocaleUpperCase()}==========================`,
  );
  return errs.length;
}

async function runChecks(args: string[]): Promise<number> {
  // Get the root directory from deno.json for structure enforcement
  const firstArg = args[0] || ".";
  const root = await getRoot(firstArg);

  // Run structure enforcement once from the root
  const structureErrs = await enforceStructure(root);

  // Log structure errors first since they're often the root cause
  let errorCount = logErrs(
    structureErrs.name,
    structureErrs.issues,
    structureErrs.message || "",
  );

  const allErrs: any[] = [];

  // Run other checks on each specified path
  for (const path of args) {
    const checkErrs$ = runDenoCheck(path);
    const importErrs$ = findInvalidRelativeImports(path);
    const lintErrs$ = runDenoLint(path);
    const testErrs$ = runDenoTest(path);
    const errs = await Promise.all([
      testErrs$,
      checkErrs$,
      importErrs$,
      lintErrs$,
    ]);
    allErrs.push(...errs);
  }

  const errs = allErrs;

  // Log other errors
  for (const e of errs) {
    errorCount += logErrs(e.name, e.issues, e.message);
  }

  const envFileMsg = errs[0]?.message || "";
  const envMsg = `Note: this only works for unit tests. ${envFileMsg}, for integration, e2e, and nop.test.ts files, please run them separately`;

  if (errorCount > 0) {
    console.log(
      `❌ Total issues found: ${errorCount}. Please fix the above issues. ${envMsg}`,
    );
    return 1;
  } else {
    console.log(`🎉 All checks passed! 🎉${envMsg}`);
    return 0;
  }
}

async function watchFiles(paths: string[]) {
  const watcher = Deno.watchFs(paths, { recursive: true });

  console.log("\n👀 Watching for changes...\n");

  let debounceTimer: number | null = null;

  for await (const event of watcher) {
    // Check if any path is relevant (TypeScript files or any directory change)
    const relevantPaths = event.paths.filter((path) => {
      // Skip node_modules and .git
      if (path.includes("node_modules") || path.includes(".git")) {
        return false;
      }

      // Include TypeScript files
      if (path.endsWith(".ts")) {
        return true;
      }

      // Include directory changes (create, remove)
      if (event.kind === "create" || event.kind === "remove") {
        return true;
      }

      return false;
    });

    if (relevantPaths.length === 0) continue;

    // Debounce rapid file changes
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      console.clear();
      const runId = Math.random().toString(36).substring(2, 8);
      console.log(`\n🔄 File change detected: ${event.kind}`);
      console.log(`📁 Files: ${relevantPaths.join(", ")}\n`);
      console.log(`Re-running checks... ${runId}\n`);

      await runChecks(paths);
      console.log("\n👀 Watching for changes...\n");

      debounceTimer = null;
    }, 300);
  }
}

if (import.meta.main) {
  await main();
}