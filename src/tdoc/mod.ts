/**
 * Complete one-shot replacement for `deno_concat_ts` and `tdocs`.
 * Now with file watching and hot reload support.
 *
 * Usage:
 *   deno run --allow-run --allow-read --allow-write --allow-env --allow-net --allow-signal tdocs.ts [entry.ts]
 *
 * Options:
 *   --watch        Enable file watching and auto-rebuild
 *   --no-wait      Run in background mode
 */

import {
  fromFileUrl,
  join,
  resolve,
  dirname,
} from "https://deno.land/std@0.224.0/path/mod.ts";

export async function findNearestDenoConfig(
  startPath: string,
): Promise<string | null> {
  let dir = (await Deno.stat(startPath)).isDirectory
    ? resolve(startPath)
    : dirname(resolve(startPath));

  while (true) {
    const jsonPath = join(dir, "deno.json");
    const jsoncPath = join(dir, "deno.jsonc");

    if (await exists(jsonPath)) return jsonPath;
    if (await exists(jsoncPath)) return jsoncPath;

    const parent = dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }
  return null;
}

/**
 * Load import map from deno.json/deno.jsonc
 */
export async function loadImportMap(
  configPath: string,
): Promise<Record<string, string> | null> {
  try {
    let content = await Deno.readTextFile(configPath);

    // Remove comments if it's a .jsonc file
    if (configPath.endsWith(".jsonc")) {
      // Remove single-line comments
      content = content.replace(/\/\/.*$/gm, "");
      // Remove multi-line comments
      content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    }

    const config = JSON.parse(content);
    return config.imports || null;
  } catch {
    return null;
  }
}

/**
 * Resolve an import specifier using the import map
 */
export function resolveImportMapAlias(
  specifier: string,
  importMap: Record<string, string> | null,
  basePath: string,
): string {
  if (!importMap) return specifier;

  // Direct match
  if (importMap[specifier]) {
    const resolved = importMap[specifier];
    // If it's a relative path, resolve it relative to the config file directory
    if (resolved.startsWith("./") || resolved.startsWith("../")) {
      return resolve(basePath, resolved);
    }
    return resolved;
  }

  // Check for prefix matches (e.g., "@dto/" matches "@dto/mod.ts")
  for (const [key, value] of Object.entries(importMap)) {
    if (key.endsWith("/") && specifier.startsWith(key)) {
      const resolved = value + specifier.slice(key.length);
      // If it's a relative path, resolve it relative to the config file directory
      if (resolved.startsWith("./") || resolved.startsWith("../")) {
        return resolve(basePath, resolved);
      }
      return resolved;
    }
  }

  return specifier;
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

export async function getGitRoot(): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(
      `git rev-parse failed: ${new TextDecoder().decode(stderr)}`,
    );
  }

  return resolve(new TextDecoder().decode(stdout).trim());
}

export async function getLocalTsDeps(entryTsFile: string): Promise<string[]> {
  const denoExe = Deno.execPath();
  const entryAbs = resolve(entryTsFile);

  const rootAbs = await getGitRoot();

  const cmd = new Deno.Command(denoExe, {
    args: ["info", "--json", entryAbs],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(new TextDecoder().decode(stderr));
  }

  const info = JSON.parse(new TextDecoder().decode(stdout));
  // `info.modules` is an array of { specifier, local?, kind, ... }
  const modules: Array<{ local?: string }> = info.modules ?? [];

  const isTsLike = (p: string) => /\.(mts|cts|ts|tsx)$/i.test(p);

  const results = new Set<string>();

  for (const m of modules) {
    if (!m.local || !m.local.startsWith("file://")) continue;

    const localPath = fromFileUrl(m.local);

    // Keep only files inside the project root
    if (!localPath.startsWith(rootAbs + "/") && localPath !== rootAbs) continue;

    // Exclude node_modules
    if (localPath.includes("/node_modules/")) continue;

    // Keep only TS-like files
    if (!isTsLike(localPath)) continue;

    // Skip the entry file itself if you only want *dependencies*
    if (localPath === entryAbs) continue;

    // Ensure it exists (avoid stray cache references)
    try {
      const st = await Deno.stat(localPath);
      if (!st.isFile) continue;
      results.add(localPath);
    } catch {
      // ignore missing
    }
  }

  return [...results].sort();
}

function addBadges(text: string, badgeConfig: BadgeConfigMap): string {
  let withBadges = text;
  let totalReplacements = 0;

  for (const [tag, config] of Object.entries(badgeConfig)) {
    // Extract tag name from the tag (e.g., "@lib/recordings" -> "recordings")
    const tagName = tag.split("/").pop() || tag;

    let replacement: string;
    if (config.type === "full") {
      // For "full" type, just replace with the content
      replacement = config.content;
    } else {
      // For "pill" type (default), generate a shield.io badge
      const color = config.color || "007ec6"; // Default blue if no color specified
      const content = config.content
        .replace(/-/g, "--")
        .replace(/_/g, "__")
        .replace(/ /g, "_");
      const label = tagName
        .replace(/-/g, "--")
        .replace(/_/g, "__")
        .replace(/ /g, "_");
      replacement = `![pill](https://img.shields.io/badge/${content}-${label}-${color})<br>`;
    }

    // Simple string replacement - replace all occurrences of the tag
    const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = withBadges.match(regex) || [];
    withBadges = withBadges.replace(regex, replacement);
    totalReplacements += matches.length;
  }
  return withBadges;
}

async function copyToClipboard(text: string) {
  //@ts-ignore
  const p = Deno.run({
    cmd: ["pbcopy"], // macOS
    stdin: "piped",
  });
  await p.stdin!.write(new TextEncoder().encode(text));
  p.stdin!.close();
  await p.status();
}

/**
 * Extract imports from TypeScript code to generate stubs
 */
function extractImports(code: string): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();

  // IMPORTANT: Process these patterns in order
  const patterns = [
    // Side effect imports: import "..."
    /import\s+["']([^"']+)["']/g,
    // Type imports: import type { X } from "..."
    /import\s+type\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/g,
    // Named imports: import { X, Y } from "..."
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/g,
    // Default imports: import X from "..."
    /import\s+(\w+)\s+from\s+["']([^"']+)["']/g,
    // Namespace imports: import * as X from "..."
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    while ((match = pattern.exec(code)) !== null) {
      // Handle side effect imports differently
      if (pattern.source.includes('import\\s+["')) {
        const moduleSpec = match[1];
        // Skip local imports but include alias imports
        if (!moduleSpec.startsWith(".") && !moduleSpec.startsWith("/")) {
          if (!imports.has(moduleSpec)) {
            imports.set(moduleSpec, new Set());
          }
          imports.get(moduleSpec)!.add("__side_effect__");
        }
        continue;
      }

      const [, imported, moduleSpec] = match;

      // Skip local imports (start with . or /) but include alias imports (start with @)
      if (moduleSpec.startsWith(".") || moduleSpec.startsWith("/")) continue;

      if (!imports.has(moduleSpec)) {
        imports.set(moduleSpec, new Set());
      }

      // Handle comma-separated imports
      if (imported.includes(",")) {
        imported.split(",").forEach((imp) => {
          const cleaned = imp.trim();
          if (cleaned) {
            imports.get(moduleSpec)!.add(cleaned);
          }
        });
      } else {
        imports.get(moduleSpec)!.add(imported.trim());
      }
    }
  }

  return imports;
}

/**
 * Generate verbose stubs for external dependencies
 */
function generateVerboseStubs(allImports: Map<string, Set<string>>): string {
  let stubs = `// ============================================
// Type stubs for external dependencies
// ============================================\n\n`;

  // Track globally to prevent duplicates across modules
  const generatedStubs = new Set<string>();

  for (const [module, items] of allImports) {
    // Skip side effect imports
    if (items.has("__side_effect__")) {
      continue;
    }

    // Only process external modules (npm:, jsr:, https://, #)
    if (
      !module.startsWith("npm:") &&
      !module.startsWith("jsr:") &&
      !module.startsWith("https://") &&
      !module.startsWith("#")
    )
      continue;

    const itemsToStub = [];
    for (const item of items) {
      // Skip side effect marker
      if (item === "__side_effect__") continue;
      if (!generatedStubs.has(item)) {
        itemsToStub.push(item);
        generatedStubs.add(item);
      }
    }

    if (itemsToStub.length === 0) continue;

    stubs += `// Stubs for ${module}\n`;

    for (const item of itemsToStub) {
      // Simple heuristic: uppercase first letter likely means type
      const isLikelyType = isTypeIdentifier(item);

      if (isLikelyType) {
        stubs += `type ${item} = any;\n`;
      } else {
        stubs += `declare const ${item}: any;\n`;
      }
    }
    stubs += "\n";
  }

  return stubs;
}

/**
 * Improved type detection heuristic
 */
function isTypeIdentifier(name: string): boolean {
  // Check for SCREAMING_CASE constants (e.g., MAX_VALUE)
  if (name === name.toUpperCase() && name.includes("_")) {
    return false; // These are constants, not types
  }

  // Check for type-related keywords (always types)
  if (name.includes("Schema") || name.includes("Type")) {
    return true;
  }

  // Check if first letter is uppercase
  const firstLetterUppercase =
    name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();

  // Special case: "Error" at the end with uppercase start usually means type
  if (name.includes("Error") && firstLetterUppercase) {
    return true;
  }

  return firstLetterUppercase;
}

/**
 * Remove imports from TypeScript code
 */
function removeImports(code: string): string {
  let result = code;

  // Remove all import statements, including:
  // - Side effect imports: import "..."
  // - Regular imports: import ... from "..."
  // - Type imports: import type ... from "..."
  // But NOT dynamic imports (await import()) or import.meta

  // First, handle side effect imports
  result = result.replace(/^import\s+["'][^"']+["'];?\s*$/gm, "");

  // Then handle all other imports with 'from' clause
  result = result.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");

  // Clean up excessive newlines left behind
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

/**
 * Remove decorators from TypeScript code while preserving JSDoc comments
 */
function removeDecorators(code: string): string {
  // Remove all @ decorators (both with and without arguments)
  // But preserve JSDoc comments and their @ tags

  const lines = code.split("\n");
  const result = [];
  let inDecorator = false;
  let parenDepth = 0;
  let inJSDoc = false;

  for (const line of lines) {
    // Check if we're entering or in a JSDoc comment
    if (line.trim().startsWith("/**")) {
      result.push(line);
      // Check if it's a single-line JSDoc comment
      if (line.includes("*/")) {
        // Single-line JSDoc, don't enter JSDoc mode
        continue;
      }
      // Multi-line JSDoc, enter JSDoc mode
      inJSDoc = true;
      continue;
    }

    if (inJSDoc) {
      result.push(line);
      if (line.includes("*/")) {
        inJSDoc = false;
      }
      continue;
    }

    // Check if line starts with a decorator (not in JSDoc)
    const decoratorMatch = line.match(/^\s*@[\w]+/);

    if (decoratorMatch && !inDecorator) {
      // Starting a decorator - always skip the line
      const afterDecorator = line.slice(decoratorMatch[0].length);

      if (afterDecorator.includes("(")) {
        // Decorator has parentheses, need to check if it completes on same line
        parenDepth = 0;

        // Count parentheses in the rest of the line
        for (const char of afterDecorator) {
          if (char === "(") parenDepth++;
          else if (char === ")") parenDepth--;
        }

        if (parenDepth > 0) {
          // Decorator continues on next line
          inDecorator = true;
        }
      }
      // Always skip decorator lines
      continue;
    } else if (inDecorator) {
      // We're inside a multiline decorator, count parentheses
      for (const char of line) {
        if (char === "(") parenDepth++;
        else if (char === ")") parenDepth--;
      }

      if (parenDepth === 0) {
        // Decorator is complete
        inDecorator = false;
      }
      continue;
    } else {
      // Regular line, keep it
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Transform re-exports to work without external modules
 */
function transformReExports(code: string): string {
  let result = code;

  // Remove ALL re-exports since we've already concatenated the files
  // This includes both local and external re-exports

  // Remove: export { x } from "any"
  result = result.replace(
    /^export\s+(\{[^}]+\})\s+from\s+["'][^"']+["'];?\s*$/gm,
    "// [Removed re-export]",
  );

  // Remove: export type { x } from "any"
  result = result.replace(
    /^export\s+type\s+(\{[^}]+\})\s+from\s+["'][^"']+["'];?\s*$/gm,
    "// [Removed type re-export]",
  );

  // Remove: export * from "any"
  result = result.replace(
    /^export\s+\*(?:\s+as\s+\w+)?\s+from\s+["'][^"']+["'];?\s*$/gm,
    "// [Removed: export * from module]",
  );

  return result;
}

/**
 * Generate Deno namespace declarations
 */
function generateDenoGlobals(): string {
  // EXPERIMENTAL VALIDATION: Confirmed these cause TypeScript errors if redefined:
  // ❌ Response, Request, WebSocket, URL, URLSearchParams, Headers, FormData
  // ❌ File, Blob, crypto, console
  // ✅ Only define Deno namespace and import global

  return `// ============================================
// Deno namespace declarations
// ============================================

declare namespace Deno {
  // File system
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string, options?: { append?: boolean }): Promise<void>;
  export function readDir(path: string): AsyncIterable<any>;
  export function stat(path: string): Promise<any>;
  export function lstat(path: string): Promise<any>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function makeTempDir(): Promise<string>;

  // Process
  export const args: string[];
  export const env: {
    get(key: string): string | undefined;
  };
  export const execPath: () => string;
  export function exit(code?: number): never;

  // Commands
  export const Command: any;

  // Errors
  export const errors: {
    NotFound: any;
  };

  // IO
  export const stdin: {
    read(buffer: Uint8Array): Promise<number | null>;
  };

  // Server (without conflicting with DOM)
  export function serve(options: any, handler: any): any;
  export function upgradeWebSocket(req: any): any;
}
`;
}

/**
 * Concatenate TypeScript files with import removal and stub generation
 */
async function concat(entry: string): Promise<{
  content: string;
  files: string[];
  externalImports: Map<string, Set<string>>;
}> {
  // Load import map if deno.json exists
  const configPath = await findNearestDenoConfig(entry);
  const importMap = configPath ? await loadImportMap(configPath) : null;
  const configDir = configPath ? dirname(configPath) : dirname(resolve(entry));

  // First, resolve the entry file if it uses an import alias
  let resolvedEntry = entry;
  if (importMap && !entry.startsWith("./") && !entry.startsWith("/")) {
    resolvedEntry = resolveImportMapAlias(entry, importMap, configDir);
  }

  const cmd = new Deno.Command("deno", {
    args: ["info", "--json", resolvedEntry],
    stdout: "piped",
    stderr: "inherit",
  });

  const { stdout } = await cmd.output();
  const info = JSON.parse(new TextDecoder().decode(stdout));

  // Try to get git root, but if not in a git repo, use the entry file's directory as root
  let rootAbs: string;
  try {
    rootAbs = await getGitRoot();
  } catch {
    // Not in git repo, use directory of entry file
    rootAbs = dirname(resolve(resolvedEntry));
  }
  const localFiles: string[] = [];
  const externalImports = new Map<string, Set<string>>();
  const processedFiles = new Set<string>(); // EXPERIMENTAL: Avoid duplicate processing
  let content = "";

  // Get the resolved entry file path for comparison
  const resolvedEntryPath = resolve(resolvedEntry);

  // Process modules - entry file first, then dependencies
  const modules = (info.modules || []).slice();

  // Find the entry file module
  let entryModule = null;
  const otherModules = [];

  for (const module of modules) {
    if (module.local) {
      const localPath = module.local.startsWith("file://")
        ? fromFileUrl(module.local)
        : module.local;

      if (localPath === resolvedEntryPath) {
        entryModule = module;
      } else {
        otherModules.push(module);
      }
    } else {
      otherModules.push(module);
    }
  }

  // Process entry file first, then other modules in reverse order (dependencies first)
  const orderedModules = entryModule
    ? [entryModule, ...otherModules.reverse()]
    : otherModules.reverse();

  for (const module of orderedModules) {
    // Process local files
    if (module.local) {
      // Handle both file:// URLs and direct paths
      const localPath = module.local.startsWith("file://")
        ? fromFileUrl(module.local)
        : module.local;

      // EXPERIMENTAL: Skip if already processed
      if (processedFiles.has(localPath)) continue;
      processedFiles.add(localPath);

      // Check if it's a local project file
      const isInProject =
        localPath.startsWith(rootAbs + "/") || localPath === rootAbs;
      const isNotNodeModules = !localPath.includes("/node_modules/");
      const isTsFile = localPath.endsWith(".ts") || localPath.endsWith(".tsx");

      if (isInProject && isNotNodeModules && isTsFile) {
        localFiles.push(localPath);

        try {
          // Read and process file
          let fileContent = await Deno.readTextFile(localPath);

          // Extract imports before removing them
          const fileImports = extractImports(fileContent);
          for (const [module, items] of fileImports) {
            if (!externalImports.has(module)) {
              externalImports.set(module, new Set());
            }
            items.forEach((item) => externalImports.get(module)!.add(item));
          }

          // Process content - preserve JSDoc while removing imports/decorators
          fileContent = removeImports(fileContent);
          fileContent = removeDecorators(fileContent);
          fileContent = transformReExports(fileContent);

          // Check if file has meaningful content (don't strip JSDoc!)
          // Only look for actual code, not comments
          const hasCode = fileContent.match(
            /(?:export|class|interface|type|const|function|enum)\s+\w+/,
          );
          const hasJSDoc = fileContent.includes("/**");

          // Include file if it has code OR JSDoc documentation
          if (!hasCode && !hasJSDoc) {
            console.log(
              `Note: File contains only imports/comments, may have limited documentation: ${localPath}`,
            );
            // Still include the file header for reference
          }

          content += `\n// ============================================\n`;
          content += `// Source: ${localPath}\n`;
          content += `// ============================================\n\n`;
          content += fileContent;
        } catch (e) {
          console.warn(`Skipping file ${localPath}: ${e.message}`);
          continue; // Skip but continue processing
        }
      }
    }
  }

  return { content, files: localFiles, externalImports };
}

export async function writeTsConfig(
  tmpDir: string,
  includePath = "concat.ts",
): Promise<{ filePath: string; entrypoint: string }> {
  const entrypoint = join(tmpDir, includePath);
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      lib: ["ES2022", "DOM"],
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: [entrypoint],
  };

  const filePath = `${tmpDir}/tsconfig.json`;
  await Deno.writeTextFile(filePath, JSON.stringify(config, null, 2));
  return { filePath, entrypoint };
}

// Find git root directory
async function findGitRoot(startPath: string): Promise<string | null> {
  let currentPath = resolve(startPath);

  while (currentPath !== "/") {
    try {
      const gitPath = join(currentPath, ".git");
      const stat = await Deno.stat(gitPath);
      if (stat.isDirectory) {
        return currentPath;
      }
    } catch {
      // .git doesn't exist here, continue
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      break; // Reached root
    }
    currentPath = parentPath;
  }

  return null;
}

// Type definitions for badge configuration
interface BadgeConfig {
  content: string;
  color?: string;
  type?: "pill" | "full";
}

type BadgeConfigMap = Record<string, BadgeConfig>;

// Cache for badge config to avoid repeated file reads
let cachedBadgeConfig: BadgeConfigMap | null = null;
let badgeConfigPath: string | null = null;
let badgeConfigWatcher: Deno.FsWatcher | null = null;

// Load badge configuration from lib-tags.json or use defaults
async function loadBadgeConfig(workingDir: string): Promise<BadgeConfigMap> {
  // If we already have cached config, return it
  if (cachedBadgeConfig !== null) {
    return cachedBadgeConfig;
  }

  // Default badge configuration
  const defaultBadgeConfig: BadgeConfigMap = {
    "@lib/recordings": {
      content: "Lib-Recordings",
      color: "FF746C",
      type: "pill",
    },
    "@lib/transcription": {
      content: "Lib-Transcription",
      color: "26c6da",
      type: "pill",
    },
  };

  // Try to find git root and load lib-tags.json
  const gitRoot = await findGitRoot(workingDir);
  if (gitRoot) {
    badgeConfigPath = join(gitRoot, "lib-tags.json");

    try {
      const configContent = await Deno.readTextFile(badgeConfigPath);
      cachedBadgeConfig = JSON.parse(configContent);
      console.log(`✓ Loaded badge config from: ${badgeConfigPath}`);
      return cachedBadgeConfig;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log(
          `ℹ Using default badge config (no lib-tags.json found at git root)`,
        );
      } else {
        console.warn(`⚠ Error loading lib-tags.json: ${error.message}`);
      }
    }
  }

  // Use default config
  cachedBadgeConfig = defaultBadgeConfig;
  return cachedBadgeConfig;
}

// Watch badge config file for changes
async function watchBadgeConfig(onUpdate: () => void) {
  if (!badgeConfigPath) return;

  // Close existing watcher if any
  if (badgeConfigWatcher) {
    try {
      badgeConfigWatcher.close();
    } catch {
      // Ignore errors when closing
    }
  }

  try {
    badgeConfigWatcher = Deno.watchFs(badgeConfigPath);
    console.log(`👁 Watching badge config: ${badgeConfigPath}`);

    for await (const event of badgeConfigWatcher) {
      if (event.kind === "modify" || event.kind === "create") {
        // Clear cache to force reload
        cachedBadgeConfig = null;
        console.log(`🔄 Badge config changed, reloading...`);

        // Reload the config
        const workingDir = dirname(badgeConfigPath);
        await loadBadgeConfig(workingDir);

        // Trigger update callback
        onUpdate();
      }
    }
  } catch (error) {
    console.warn(`⚠ Could not watch badge config: ${error.message}`);
  }
}

// Recursively find and inject custom CSS/JS into all HTML files
async function processHtmlFiles(
  dir: string,
  customCssContent: string,
  customJsContent: string,
) {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      await processHtmlFiles(fullPath, customCssContent, customJsContent);
    } else if (entry.name.endsWith(".html")) {
      let content = await Deno.readTextFile(fullPath);

      // Add custom CSS and JS before closing head tag (in one replacement to avoid double injection)
      content = content.replace(
        "</head>",
        customCssContent + customJsContent + "</head>",
      );

      await Deno.writeTextFile(fullPath, content);
      console.log(`✓ Modified HTML: ${fullPath}`);
    }
  }
}

// WebSocket server for hot reload
function startWebSocketServer(port: number): Deno.HttpServer<Deno.NetAddr> {
  const clients = new Set<WebSocket>();

  const server = Deno.serve({ port, hostname: "127.0.0.1" }, (req) => {
    if (req.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = () => {
        clients.add(socket);
      };

      socket.onclose = () => {
        clients.delete(socket);
      };

      return response;
    }

    return new Response("WebSocket server for hot reload", { status: 200 });
  });

  // Return server with attached notify function
  (server as any).notify = () => {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send("reload");
      }
    }
  };

  return server;
}

// ---------- main ----------
if (import.meta.main) {
  // Check and install dependencies if needed
  const checkAndInstallDeps = async () => {
    // Check if typedoc is available
    try {
      const checkCmd = new Deno.Command("npx", {
        args: ["typedoc", "--version"],
        stdout: "null",
        stderr: "null",
      });
      const result = await checkCmd.output();

      if (!result.success) {
        console.log("Installing TypeDoc and varvara-typedoc-theme...");
        const installCmd = new Deno.Command("npm", {
          args: ["install", "-g", "typedoc", "varvara-typedoc-theme"],
          stdout: "inherit",
          stderr: "inherit",
        });
        await installCmd.output();
      }
    } catch {
      console.log("Installing TypeDoc and varvara-typedoc-theme...");
      const installCmd = new Deno.Command("npm", {
        args: ["install", "-g", "typedoc", "varvara-typedoc-theme"],
        stdout: "inherit",
        stderr: "inherit",
      });
      await installCmd.output();
    }

    // Check if varvara theme is available
    try {
      const checkTheme = new Deno.Command("npm", {
        args: ["list", "-g", "varvara-typedoc-theme"],
        stdout: "null",
        stderr: "null",
      });
      const themeResult = await checkTheme.output();

      if (!themeResult.success) {
        console.log("Installing varvara-typedoc-theme...");
        const installCmd = new Deno.Command("npm", {
          args: ["install", "-g", "varvara-typedoc-theme"],
          stdout: "inherit",
          stderr: "inherit",
        });
        await installCmd.output();
      }
    } catch {
      // Silent fail, will try to use it anyway
    }
  };

  await checkAndInstallDeps();

  // Check for flags before processing other args
  const shouldWait = !Deno.args.includes("--no-wait");
  const watchMode = Deno.args.includes("--watch");
  const filteredArgs = Deno.args.filter(
    (arg) => arg !== "--no-wait" && arg !== "--watch",
  );

  const entry = filteredArgs[0] ?? "./design.ts";
  // Use /tmp/tdoc as the base directory
  const tmpdir = "/tmp/tdoc";
  const docsOutputDir = join(tmpdir, "typedoc");

  // Ensure the directory exists and is clean
  try {
    // await Deno.remove(tmpdir, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
  await Deno.mkdir(tmpdir, { recursive: true });
  await Deno.mkdir(docsOutputDir, { recursive: true });
  console.log(`Using directory structure: ${tmpdir}`);

  // Track included files for watching
  let watchedFiles: string[] = [];

  // Function to build documentation
  const buildDocs = async (badgeConfig: Record<string, string>) => {
    const outts = join(tmpdir, "concat.ts");

    // Get concatenated content and metadata
    const { content, files, externalImports } = await concat(entry);

    // Generate stubs for external dependencies
    const stubs = generateVerboseStubs(externalImports);

    // Generate Deno globals
    const denoGlobals = generateDenoGlobals();

    // Combine everything - entry file first, then globals and stubs
    let finalContent = content + denoGlobals + stubs;

    // Apply badge replacements
    finalContent = addBadges(finalContent, badgeConfig);

    // Write final output
    await Deno.writeTextFile(outts, finalContent);

    // Update watched files (include entry file)
    watchedFiles = [...files, entry];

    return outts;
  };

  // Load badge configuration
  const workingDir = dirname(resolve(entry));
  const badgeConfig = await loadBadgeConfig(workingDir);

  const outts = await buildDocs(badgeConfig);

  // Get parent folder name for the title and convert to title case
  const cwd = Deno.cwd();
  const parentFolderName = cwd.split("/").filter(Boolean).pop() || "Docs";
  const titleCase = parentFolderName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  const docsTitle = `${titleCase} Docs`;

  // Add custom JS to set dark theme as default and enable hot reload
  const wsPort = watchMode ? Math.floor(Math.random() * 10000) + 40000 : 0;
  const hotReloadScript = watchMode
    ? `
    // Hot reload functionality
    (function() {
      const ws = new WebSocket('ws://127.0.0.1:${wsPort}');
      ws.onmessage = function(event) {
        if (event.data === 'reload') {
          window.location.reload();
        }
      };
      ws.onclose = function() {
        // Try to reconnect after 2 seconds
        setTimeout(function() {
          window.location.reload();
        }, 2000);
      };
    })();
  `
    : "";

  const customJsContent = `
<script>
(function() {
  // Check if user has a saved preference
  const savedTheme = localStorage.getItem('tsd-theme');

  // If no saved preference, set to dark
  if (!savedTheme) {
    localStorage.setItem('tsd-theme', 'dark');
    document.documentElement.dataset.theme = 'dark';
  }

  // Apply the theme immediately to prevent flash
  const theme = localStorage.getItem('tsd-theme') || 'dark';
  document.documentElement.dataset.theme = theme;

  // Collapse all navigation sections on page load
  document.addEventListener('DOMContentLoaded', function() {
    // Find all navigation sections that can be collapsed
    const navSections = document.querySelectorAll('.tsd-navigation.primary ul li');
    navSections.forEach(function(section) {
      // Check if this section has children (is collapsible)
      const hasChildren = section.querySelector('ul');
      if (hasChildren) {
        // Remove the 'current' and 'expanded' classes to collapse it
        section.classList.remove('current', 'tsd-is-current');
        // Add a class to indicate it's collapsed (if not already)
        if (!section.classList.contains('tsd-is-collapsed')) {
          // TypeDoc uses different classes in different versions
          // Try to find the toggle button and simulate a click to properly collapse
          const details = section.querySelector('details');
          if (details && details.open) {
            details.open = false;
          }
        }
      }
    });

    // For newer TypeDoc versions that use details/summary
    const allDetails = document.querySelectorAll('.tsd-index-panel details, .tsd-navigation details');
    allDetails.forEach(function(detail) {
      detail.open = false;
    });
  });
  ${hotReloadScript}
})();
</script>`;

  // Add custom CSS to completely replace footer content and show categories
  const customCssContent = `
<style>
/* Hide ALL original footer content */
footer .tsd-generator {
  display: none !important;
}
footer p {
  display: none !important;
}
footer .container > * {
  display: none !important;
}
/* Add custom copyright */
footer .container {
  padding: 2rem;
  text-align: center;
}
footer .container::after {
  content: "© Rafa 2025";
  display: block;
  font-size: 0.875rem;
}
/* Show both README and module structure */
.col-content > .tsd-panel.tsd-typography {
  margin-bottom: 2rem;
}
/* Ensure categories section is visible and styled properly */
.col-content > .tsd-panel-group {
  display: block !important;
  margin-top: 2rem;
}
.col-content > .tsd-panel-group .tsd-panel {
  margin-bottom: 1rem;
}
/* Style the category headers */
.tsd-panel h2, .tsd-panel h3 {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
}
/* Ensure proper spacing for nested groups */
.tsd-panel-group .tsd-panel-group {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid var(--color-panel-divider);
}
</style>`;

  // Function to extract README from first comment block
  const extractReadmeFromComment = async (
    filePath: string,
  ): Promise<string | null> => {
    try {
      const content = await Deno.readTextFile(filePath);

      // Look for @packageDocumentation comment block - match only the specific block
      const packageDocMatch = content.match(
        /\/\*\*\s*\n\s*\*\s*@packageDocumentation[\s\S]*?\*\//,
      );
      if (packageDocMatch) {
        let docContent = packageDocMatch[0];

        // Remove the comment markers and @packageDocumentation tag
        docContent = docContent
          .replace(/\/\*\*\s*\n/, "") // Remove opening /**
          .replace(/\s*\*\//, "") // Remove closing */
          .replace(/\s*\*\s*@packageDocumentation\s*\n/, "") // Remove @packageDocumentation line
          .split("\n")
          .map((line) => {
            // Remove leading * and spaces, but preserve content structure
            const cleaned = line.replace(/^\s*\*\s?/, "");
            return cleaned;
          })
          .join("\n")
          .trim();

        // Fix mermaid blocks by removing empty lines and cleaning up formatting
        docContent = docContent.replace(/```mermaid[\s\S]*?```/g, (match) => {
          // Extract the mermaid content
          const lines = match.split("\n");
          const mermaidStart = lines[0];
          const mermaidEnd = "```";

          // Filter out empty lines and clean up the content
          const mermaidContent = lines
            .slice(1, -1) // Remove the ```mermaid and ``` lines
            .filter((line) => line.trim() !== "") // Remove empty lines
            .map((line) => line.trim()) // Trim whitespace from each line
            .join("\n");

          // Rebuild the mermaid block without extra spacing
          return `${mermaidStart}\n${mermaidContent}\n${mermaidEnd}`;
        });

        // Stop at the closing of the comment or at @example if present
        const exampleIndex = docContent.indexOf("@example");
        if (exampleIndex > 0) {
          docContent = docContent.substring(0, exampleIndex).trim();
        }

        return docContent;
      }

      return null;
    } catch {
      return null;
    }
  };

  // Function to extract entrypoints WITHOUT removing them from the file
  const extractEntrypoints = async (
    concatPath: string,
    badgeConfig: BadgeConfigMap,
  ) => {
    const content = await Deno.readTextFile(concatPath);
    const lines = content.split("\n");

    const entrypointBlocks: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Check if this is the start of a JSDoc comment
      if (line.trim().startsWith("/**")) {
        let commentLines = [line];
        let isEntrypoint = false;
        let j = i + 1;

        // Read the entire comment
        while (j < lines.length && !lines[j].includes("*/")) {
          commentLines.push(lines[j]);
          if (lines[j].includes("@entrypoint")) {
            isEntrypoint = true;
          }
          j++;
        }

        // Add the closing comment line
        if (j < lines.length) {
          commentLines.push(lines[j]);
          j++;
        }

        if (isEntrypoint) {
          // This is an entrypoint, capture the entire entity
          let entityLines = [...commentLines];
          let braceCount = 0;
          let foundBrace = false;

          // Now capture the entity definition
          while (j < lines.length) {
            const nextLine = lines[j];
            entityLines.push(nextLine);

            // Count braces
            if (nextLine.includes("{")) {
              foundBrace = true;
              braceCount += (nextLine.match(/{/g) || []).length;
            }
            if (nextLine.includes("}")) {
              braceCount -= (nextLine.match(/}/g) || []).length;
              if (foundBrace && braceCount === 0) {
                // We've closed all braces, stop here
                j++;
                break;
              }
            }

            // For simple type declarations without braces
            if (
              !foundBrace &&
              nextLine.includes(";") &&
              !nextLine.includes("{")
            ) {
              j++;
              break;
            }

            j++;
          }

          entrypointBlocks.push(entityLines.join("\n"));
        }

        i = j; // Continue from where we left off
      } else {
        i++;
      }
    }

    console.log(`✓ Found ${entrypointBlocks.length} entrypoints in concat.ts`);

    return entrypointBlocks;
  };

  // Function to rebuild and process HTML
  const rebuildAndProcess = async () => {
    // Skip README extraction since TypeDoc now handles @packageDocumentation properly
    // This prevents duplicate rendering of content like mermaid diagrams
    let readmeContent = null;

    // Extract entrypoints without removing them from concat.ts
    const entrypointBlocks = await extractEntrypoints(outts, badgeConfig);

    // Store entrypoints for later HTML injection (don't add to README markdown)
    // We'll inject them as proper HTML after TypeDoc processes everything

    // Run typedoc on the modified concat.ts (without entrypoints)
    //   \
    const { filePath, entrypoint } = await writeTsConfig(tmpdir);

    const tdCommand = new Deno.Command("sh", {
      args: [
        "-c",
        `cd ${tmpdir} && npx -p varvara-typedoc-theme -p typedoc-plugin-mermaid typedoc --plugin varvara-typedoc-theme --plugin typedoc-plugin-mermaid --theme varvara-css --name "${docsTitle}" --out typedoc ${entrypoint} --tsconfig ${filePath} --customFooterHtml "© Rafa 2025" --categorizeByGroup true --groupOrder "*" --defaultCategory "Core" --includeVersion --excludePrivate --excludeProtected --excludeInternal`,
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
    const tdStatus = await tdCommand.output();
    if (!tdStatus.success) {
      console.error("TypeDoc failed");
      return false;
    }
    console.log(`✓ TypeDoc generated HTML files in: ${docsOutputDir}`);

    // If we have README content, inject it into the index.html
    if (readmeContent) {
      const indexPath = join(docsOutputDir, "index.html");
      let indexContent = await Deno.readTextFile(indexPath);

      // Convert markdown to HTML with proper mermaid support
      let readmeHtml = readmeContent
        // First handle mermaid blocks specially
        .replace(/```mermaid\n([\s\S]*?)\n```/g, (match, content) => {
          // Use the same format that typedoc-plugin-mermaid expects
          return `<div class="mermaid">${content}</div>`;
        })
        // Then handle other code blocks
        .replace(
          /```(\w+)?\n([\s\S]*?)\n```/g,
          '<pre><code class="language-$1">$2</code></pre>',
        )
        // Headers
        .replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>")
        .replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>")
        .replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>")
        .replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>")
        .replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>")
        // Bold text
        .replace(/\*\*(.+?)\*\*/gm, "<strong>$1</strong>")
        // Lists
        .replace(/^\s*-\s+(.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
        // Numbered lists
        .replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>\n?)+/g, function (match) {
          // Check if this is a numbered list by looking at the original content
          return match.includes("1.")
            ? "<ol>" + match + "</ol>"
            : "<ul>" + match + "</ul>";
        })
        // Paragraphs
        .replace(/\n\n/g, "</p><p>")
        .replace(/^/, "<p>")
        .replace(/$/, "</p>")
        // Clean up paragraph tags around block elements
        .replace(/<p>(<h\d>)/g, "$1")
        .replace(/(<\/h\d>)<\/p>/g, "$1")
        .replace(/<p>(<ul>|<ol>|<div class="mermaid">|<pre>)/g, "$1")
        .replace(/(<\/ul>|<\/ol>|<\/div>|<\/pre>)<\/p>/g, "$1");

      // Find the col-content div and inject README at the beginning
      const contentMatch = indexContent.match(/<div class="col-content">/);
      if (contentMatch) {
        const insertPos = contentMatch.index! + contentMatch[0].length;
        const readmeSection = `
          <div class="tsd-panel tsd-typography">
            ${readmeHtml}
          </div>
        `;
        indexContent =
          indexContent.slice(0, insertPos) +
          readmeSection +
          indexContent.slice(insertPos);
        await Deno.writeTextFile(indexPath, indexContent);
        console.log(`✓ Injected README into: ${indexPath}`);
      }
    }

    // Process all HTML files with custom CSS and JS FIRST
    await processHtmlFiles(docsOutputDir, customCssContent, customJsContent);

    // Then inject entrypoints as proper HTML with syntax highlighting (after processHtmlFiles to avoid overwriting)
    if (entrypointBlocks && entrypointBlocks.length > 0) {
      console.log(
        `✓ Processing ${entrypointBlocks.length} entrypoints for HTML injection`,
      );
      const indexPath = join(docsOutputDir, "index.html");
      let indexContent = await Deno.readTextFile(indexPath);

      // Create a simple bulleted list of entrypoint links
      let entrypointsHtml = `
        <h1>Entrypoints</h1>
        <ul>
      `;

      for (const block of entrypointBlocks) {
        // Extract interface/class name from the block
        const nameMatch = block.match(/(?:interface|class|type)\s+(\w+)/);
        const entityName = nameMatch ? nameMatch[1] : "";

        // Create a simple list item with link
        entrypointsHtml += `
            <li><a href="interfaces/${entityName}.html">${entityName}</a></li>
        `;
      }

      entrypointsHtml += `
          </ul>`;

      // Find where to insert - right after the README content
      let insertionPoint = -1;
      let insertBefore = "";

      // Look for the closing of the README panel (class="tsd-panel tsd-typography")
      // We want to insert right after this closes
      const readmePanelStart = indexContent.indexOf(
        '<div class="tsd-panel tsd-typography">',
      );
      if (readmePanelStart > -1) {
        // Find the matching closing div for the README panel
        let divCount = 0;
        let i = readmePanelStart;
        let foundStart = false;

        while (i < indexContent.length) {
          if (indexContent.substr(i, 4) === "<div") {
            divCount++;
            foundStart = true;
          } else if (indexContent.substr(i, 6) === "</div>" && foundStart) {
            divCount--;
            if (divCount === 0) {
              // Found the closing div of the README panel
              insertionPoint = i + 6; // After </div>
              insertBefore = "after README panel";
              break;
            }
          }
          i++;
        }
      }

      // Fallback to footer if we couldn't find the README panel
      if (insertionPoint === -1) {
        const footerIndex = indexContent.indexOf("<footer");
        if (footerIndex > -1) {
          insertionPoint = footerIndex;
          insertBefore = "<footer";
        }
      }

      if (insertionPoint > -1) {
        indexContent =
          indexContent.slice(0, insertionPoint) +
          entrypointsHtml +
          indexContent.slice(insertionPoint);

        await Deno.writeTextFile(indexPath, indexContent);
        console.log(
          `✓ Injected entrypoints section with syntax highlighting before ${insertBefore}`,
        );
      } else {
        console.log(
          `⚠ Could not find suitable location to inject entrypoints`,
        );
      }
    }
    return true;
  };

  // Initial build
  const buildSuccess = await rebuildAndProcess();
  if (!buildSuccess) {
    // await Deno.remove(tmpdir, { recursive: true });
    Deno.exit(1);
  }

  // Start WebSocket server for hot reload if in watch mode
  let wsServer: any = null;
  if (watchMode) {
    wsServer = startWebSocketServer(wsPort);
    console.log(`WebSocket server for hot reload running on port ${wsPort}`);
  }

  // pick random port and serve
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const serverCommand = new Deno.Command("python3", {
    args: ["-m", "http.server", String(port)],
    cwd: docsOutputDir,
    stdout: "null",
    stderr: "null",
  });
  const server = serverCommand.spawn();

  const url = `http://127.0.0.1:${port}/index.html`;
  console.log(`Docs served at ${url}`);

  if (watchMode) {
    console.log("Watching for changes... Press Ctrl+C to stop.");
  }

  // Try to open in default browser
  try {
    const openCommand = new Deno.Command("open", {
      args: [url],
    });
    await openCommand.output();
  } catch {
    try {
      const xdgOpenCommand = new Deno.Command("xdg-open", {
        args: [url],
      });
      await xdgOpenCommand.output();
    } catch {
      console.log("Open this URL manually:", url);
    }
  }

  // Set up file watcher if in watch mode
  if (watchMode) {
    let debounceTimer: number | undefined;
    let watcherController: AbortController | null = null;

    // Set up badge config watcher
    await watchBadgeConfig(async () => {
      console.log("Badge configuration changed, reloading...");
      // Clear the cache
      cachedBadgeConfig = null;
      // Reload the badge config
      const newBadgeConfig = await loadBadgeConfig(workingDir);
      // Update the badgeConfig variable
      Object.assign(badgeConfig, newBadgeConfig);
      // Trigger rebuild
      const rebuild = async () => {
        console.log("\nBadge config changed, rebuilding...");
        try {
          // Re-concat the files (this will also update the watched files list)
          const oldFileCount = watchedFiles.length;
          const newOutts = await buildDocs(badgeConfig);

          // Rebuild documentation
          const success = await rebuildAndProcess();

          if (success) {
            // Send reload signal to browser
            if (wsServer) {
              wsServer.broadcast({ type: "reload" });
            }

            const newFileCount = watchedFiles.length;
            if (newFileCount !== oldFileCount) {
              console.log(
                `Bundle size changed: ${oldFileCount} → ${newFileCount} files`,
              );
              // Restart watcher with new file list
              await startWatcher();
            }
          }
        } catch (error) {
          console.error("Rebuild failed:", error);
        }
      };

      // Debounce the rebuild
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rebuild, 300);
    });

    const startWatcher = async () => {
      // Cancel previous watcher if exists
      if (watcherController) {
        watcherController.abort();
      }

      watcherController = new AbortController();
      const { signal } = watcherController;

      console.log(`Watching ${watchedFiles.length} files from the bundle...`);

      // Watch only the files that are included in the bundle
      //@ts-ignore: dooks
      const watcher = Deno.watchFs(watchedFiles, { signal });

      try {
        for await (const event of watcher) {
          // Check if any of the changed files are in our watched list
          const relevantChange = event.paths.some((path) =>
            watchedFiles.includes(path),
          );

          if (!relevantChange) continue;

          // Debounce rapid changes
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            rebuild();
            debounceTimer = undefined;
          }, 500);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          // Watcher was intentionally stopped
          return;
        }
        throw e;
      }
    };

    const rebuild = async () => {
      console.log("\nFiles changed, rebuilding...");
      try {
        // Re-concat the files (this will also update the watched files list)
        const oldFileCount = watchedFiles.length;
        const newOutts = await buildDocs(badgeConfig);

        // Rebuild documentation
        const success = await rebuildAndProcess();

        if (success) {
          console.log("Rebuild complete, reloading browser...");
          // Notify connected browsers to reload
          if (wsServer?.notify) {
            wsServer.notify();
          }

          // If the watched files list changed, restart the watcher
          if (watchedFiles.length !== oldFileCount) {
            console.log(
              `File dependencies changed (${oldFileCount} → ${watchedFiles.length}), updating watcher...`,
            );
            startWatcher();
          }
        } else {
          console.error("Rebuild failed, skipping reload");
        }
      } catch (error) {
        console.error("Error during rebuild:", error);
      }
    };

    // Start the initial watcher
    startWatcher();

    // Keep running until interrupted
    await new Promise(() => {});
  } else {
    // Use the shouldWait flag that was set earlier
    if (shouldWait) {
      console.log("Press Enter to close and clean up…");
      const buffer = new Uint8Array(1);
      await Deno.stdin.read(buffer);
    } else {
      console.log("Server running in background mode. Kill process to stop.");
      // Keep server running until process is terminated
      await new Promise(() => {});
    }
  }

  // Cleanup
  console.log("\nCleaning up...");
  try {
    server.kill("SIGTERM");
    console.log("Stopped HTTP server");
  } catch {
    // ignore
  }

  if (wsServer) {
    await wsServer.shutdown();
    console.log("Stopped WebSocket server");
  }

  // Clean up the fixed debug directory
  try {
    // await Deno.remove(tmpdir, { recursive: true });
    console.log(`Removed debug directory: ${tmpdir}`);
  } catch (e) {
    console.error(`Failed to remove ${tmpdir}:`, e);
  }
  console.log("Cleanup complete.");
}
