import { dirname, join } from "@std/path";

export type Issue = { issue: string; location: string };
export type Spec = string | string[] | { [name: string]: Spec };
export type IssueResponse = { name: string; issues: Issue[]; message?: string };
export type Rule = (path: string) => Promise<string | null> | string | null;

export async function getRoot(passedRoot = "."): Promise<string> {
  const absRoot = join(Deno.cwd(), passedRoot);
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