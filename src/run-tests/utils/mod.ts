import { dirname, join } from "node:path";

export type Issue = { issue: string; location: string };
export type Spec = string | string[] | { [name: string]: Spec };
export type IssueResponse = { name: string; issues: Issue[]; message?: any };
export type Rule = (path: string) => Promise<string | null> | string | null;

// deno-lint-ignore-file no-explicit-any

export async function getRoot(passedRoot = ".") {
  const absRoot = passedRoot.startsWith("/") ? passedRoot : join(Deno.cwd(), passedRoot);
  const rootCandidate = await findNearestDenoJson(absRoot);
  const root = dirname(rootCandidate ?? absRoot);
  if (!root) {
    throw new Error("Could not find deno.json in any parent directory");
  }
  return root;
}

export async function getEnvFile(_root: string) {
  const root = (await findGitRoot(_root)) ?? _root;
  if (!root) {
    throw new Error("Could not find git root");
  }
  return join(root, "env", "local");
}
/**
 * Find the nearest parent deno.json file starting from `startDir`.
 *
 * @param startDir Directory to start searching from (default is current working directory).
 * @returns Absolute path to deno.json if found, otherwise null.
 */
async function findNearestDenoJson(
  startDir: string = Deno.cwd(),
): Promise<string | null> {
  let currentDir = startDir;

  while (true) {
    const denoJsonPath = join(currentDir, "deno.json");
    try {
      const stat = await Deno.stat(denoJsonPath);
      if (stat.isFile) {
        return denoJsonPath;
      }
    } catch {
      // File not found, keep going up
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

// deno run --allow-read find_git_root.ts

/**
 * Walk up from the given startDir until a `.git` folder is found.
 * Returns the absolute path to the Git root, or null if none found.
 */
async function findGitRoot(startDir = Deno.cwd()): Promise<string | null> {
  let dir = startDir;

  while (true) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isDirectory && entry.name === ".git") {
          return dir;
        }
      }
    } catch {
      // ignore permission errors etc.
    }

    const parent = new URL("..", `file://${dir}/`).pathname;
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

/** Example CLI usage */
if (import.meta.main) {
  console.log((await findGitRoot()) ?? "❌ No Git root found");
}
