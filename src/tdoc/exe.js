#!/usr/bin/env deno run --no-check -A
// deno:https://deno.land/std@0.224.0/path/_common/assert_path.ts
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
  }
}

// deno:https://deno.land/std@0.224.0/path/_common/constants.ts
var CHAR_UPPERCASE_A = 65;
var CHAR_LOWERCASE_A = 97;
var CHAR_UPPERCASE_Z = 90;
var CHAR_LOWERCASE_Z = 122;
var CHAR_DOT = 46;
var CHAR_FORWARD_SLASH = 47;
var CHAR_BACKWARD_SLASH = 92;
var CHAR_COLON = 58;

// deno:https://deno.land/std@0.224.0/path/_common/strip_trailing_separators.ts
function stripTrailingSeparators(segment, isSep) {
  if (segment.length <= 1) {
    return segment;
  }
  let end = segment.length;
  for (let i = segment.length - 1; i > 0; i--) {
    if (isSep(segment.charCodeAt(i))) {
      end = i;
    } else {
      break;
    }
  }
  return segment.slice(0, end);
}

// deno:https://deno.land/std@0.224.0/path/windows/_util.ts
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}
function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z;
}

// deno:https://deno.land/std@0.224.0/path/_common/dirname.ts
function assertArg(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://deno.land/std@0.224.0/path/windows/dirname.ts
function dirname(path) {
  assertArg(path);
  const len = path.length;
  let rootEnd = -1;
  let end = -1;
  let matchedSlash = true;
  let offset = 0;
  const code = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      rootEnd = offset = 1;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j === len) {
              return path;
            }
            if (j !== last) {
              rootEnd = offset = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        rootEnd = offset = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
        }
      }
    }
  } else if (isPathSeparator(code)) {
    return path;
  }
  for (let i = len - 1; i >= offset; --i) {
    if (isPathSeparator(path.charCodeAt(i))) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }
  if (end === -1) {
    if (rootEnd === -1) return ".";
    else end = rootEnd;
  }
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator);
}

// deno:https://deno.land/std@0.224.0/path/_common/from_file_url.ts
function assertArg3(url) {
  url = url instanceof URL ? url : new URL(url);
  if (url.protocol !== "file:") {
    throw new TypeError("Must be a file URL.");
  }
  return url;
}

// deno:https://deno.land/std@0.224.0/path/windows/from_file_url.ts
function fromFileUrl(url) {
  url = assertArg3(url);
  let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
  if (url.hostname !== "") {
    path = `\\\\${url.hostname}${path}`;
  }
  return path;
}

// deno:https://deno.land/std@0.224.0/assert/assertion_error.ts
var AssertionError = class extends Error {
  /** Constructs a new instance. */
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }
};

// deno:https://deno.land/std@0.224.0/assert/assert.ts
function assert(expr, msg = "") {
  if (!expr) {
    throw new AssertionError(msg);
  }
}

// deno:https://deno.land/std@0.224.0/path/_common/normalize.ts
function assertArg4(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://deno.land/std@0.224.0/path/_common/normalize_string.ts
function normalizeString(path, allowAboveRoot, separator, isPathSeparator2) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (isPathSeparator2(code)) break;
    else code = CHAR_FORWARD_SLASH;
    if (isPathSeparator2(code)) {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += `${separator}..`;
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

// deno:https://deno.land/std@0.224.0/path/windows/normalize.ts
function normalize(path) {
  assertArg4(path);
  const len = path.length;
  let rootEnd = 0;
  let device;
  let isAbsolute3 = false;
  const code = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      isAbsolute3 = true;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          const firstPart = path.slice(last, j);
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j === len) {
              return `\\\\${firstPart}\\${path.slice(last)}\\`;
            } else if (j !== last) {
              device = `\\\\${firstPart}\\${path.slice(last, j)}`;
              rootEnd = j;
            }
          }
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        device = path.slice(0, 2);
        rootEnd = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) {
            isAbsolute3 = true;
            rootEnd = 3;
          }
        }
      }
    }
  } else if (isPathSeparator(code)) {
    return "\\";
  }
  let tail;
  if (rootEnd < len) {
    tail = normalizeString(path.slice(rootEnd), !isAbsolute3, "\\", isPathSeparator);
  } else {
    tail = "";
  }
  if (tail.length === 0 && !isAbsolute3) tail = ".";
  if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
    tail += "\\";
  }
  if (device === void 0) {
    if (isAbsolute3) {
      if (tail.length > 0) return `\\${tail}`;
      else return "\\";
    } else if (tail.length > 0) {
      return tail;
    } else {
      return "";
    }
  } else if (isAbsolute3) {
    if (tail.length > 0) return `${device}\\${tail}`;
    else return `${device}\\`;
  } else if (tail.length > 0) {
    return device + tail;
  } else {
    return device;
  }
}

// deno:https://deno.land/std@0.224.0/path/windows/join.ts
function join(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  let firstPart = null;
  for (let i = 0; i < paths.length; ++i) {
    const path = paths[i];
    assertPath(path);
    if (path.length > 0) {
      if (joined === void 0) joined = firstPart = path;
      else joined += `\\${path}`;
    }
  }
  if (joined === void 0) return ".";
  let needsReplace = true;
  let slashCount = 0;
  assert(firstPart !== null);
  if (isPathSeparator(firstPart.charCodeAt(0))) {
    ++slashCount;
    const firstLen = firstPart.length;
    if (firstLen > 1) {
      if (isPathSeparator(firstPart.charCodeAt(1))) {
        ++slashCount;
        if (firstLen > 2) {
          if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
          else {
            needsReplace = false;
          }
        }
      }
    }
  }
  if (needsReplace) {
    for (; slashCount < joined.length; ++slashCount) {
      if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
    }
    if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
  }
  return normalize(joined);
}

// deno:https://deno.land/std@0.224.0/path/windows/resolve.ts
function resolve(...pathSegments) {
  let resolvedDevice = "";
  let resolvedTail = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1; i--) {
    let path;
    const { Deno: Deno2 } = globalThis;
    if (i >= 0) {
      path = pathSegments[i];
    } else if (!resolvedDevice) {
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a drive-letter-less path without a CWD.");
      }
      path = Deno2.cwd();
    } else {
      if (typeof Deno2?.env?.get !== "function" || typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a CWD.");
      }
      path = Deno2.cwd();
      if (path === void 0 || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
        path = `${resolvedDevice}\\`;
      }
    }
    assertPath(path);
    const len = path.length;
    if (len === 0) continue;
    let rootEnd = 0;
    let device = "";
    let isAbsolute3 = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
      if (isPathSeparator(code)) {
        isAbsolute3 = true;
        if (isPathSeparator(path.charCodeAt(1))) {
          let j = 2;
          let last = j;
          for (; j < len; ++j) {
            if (isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            const firstPart = path.slice(last, j);
            last = j;
            for (; j < len; ++j) {
              if (!isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j < len && j !== last) {
              last = j;
              for (; j < len; ++j) {
                if (isPathSeparator(path.charCodeAt(j))) break;
              }
              if (j === len) {
                device = `\\\\${firstPart}\\${path.slice(last)}`;
                rootEnd = j;
              } else if (j !== last) {
                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                rootEnd = j;
              }
            }
          }
        } else {
          rootEnd = 1;
        }
      } else if (isWindowsDeviceRoot(code)) {
        if (path.charCodeAt(1) === CHAR_COLON) {
          device = path.slice(0, 2);
          rootEnd = 2;
          if (len > 2) {
            if (isPathSeparator(path.charCodeAt(2))) {
              isAbsolute3 = true;
              rootEnd = 3;
            }
          }
        }
      }
    } else if (isPathSeparator(code)) {
      rootEnd = 1;
      isAbsolute3 = true;
    }
    if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
      continue;
    }
    if (resolvedDevice.length === 0 && device.length > 0) {
      resolvedDevice = device;
    }
    if (!resolvedAbsolute) {
      resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
      resolvedAbsolute = isAbsolute3;
    }
    if (resolvedAbsolute && resolvedDevice.length > 0) break;
  }
  resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
  return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}

// deno:https://deno.land/std@0.224.0/path/posix/_util.ts
function isPosixPathSeparator2(code) {
  return code === CHAR_FORWARD_SLASH;
}

// deno:https://deno.land/std@0.224.0/path/posix/dirname.ts
function dirname2(path) {
  assertArg(path);
  let end = -1;
  let matchedNonSeparator = false;
  for (let i = path.length - 1; i >= 1; --i) {
    if (isPosixPathSeparator2(path.charCodeAt(i))) {
      if (matchedNonSeparator) {
        end = i;
        break;
      }
    } else {
      matchedNonSeparator = true;
    }
  }
  if (end === -1) {
    return isPosixPathSeparator2(path.charCodeAt(0)) ? "/" : ".";
  }
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator2);
}

// deno:https://deno.land/std@0.224.0/path/posix/from_file_url.ts
function fromFileUrl2(url) {
  url = assertArg3(url);
  return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}

// deno:https://deno.land/std@0.224.0/path/posix/normalize.ts
function normalize2(path) {
  assertArg4(path);
  const isAbsolute3 = isPosixPathSeparator2(path.charCodeAt(0));
  const trailingSeparator = isPosixPathSeparator2(path.charCodeAt(path.length - 1));
  path = normalizeString(path, !isAbsolute3, "/", isPosixPathSeparator2);
  if (path.length === 0 && !isAbsolute3) path = ".";
  if (path.length > 0 && trailingSeparator) path += "/";
  if (isAbsolute3) return `/${path}`;
  return path;
}

// deno:https://deno.land/std@0.224.0/path/posix/join.ts
function join2(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  for (let i = 0; i < paths.length; ++i) {
    const path = paths[i];
    assertPath(path);
    if (path.length > 0) {
      if (!joined) joined = path;
      else joined += `/${path}`;
    }
  }
  if (!joined) return ".";
  return normalize2(joined);
}

// deno:https://deno.land/std@0.224.0/path/posix/resolve.ts
function resolve2(...pathSegments) {
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    let path;
    if (i >= 0) path = pathSegments[i];
    else {
      const { Deno: Deno2 } = globalThis;
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a CWD.");
      }
      path = Deno2.cwd();
    }
    assertPath(path);
    if (path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isPosixPathSeparator2(path.charCodeAt(0));
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator2);
  if (resolvedAbsolute) {
    if (resolvedPath.length > 0) return `/${resolvedPath}`;
    else return "/";
  } else if (resolvedPath.length > 0) return resolvedPath;
  else return ".";
}

// deno:https://deno.land/std@0.224.0/path/_os.ts
var osType = (() => {
  const { Deno: Deno2 } = globalThis;
  if (typeof Deno2?.build?.os === "string") {
    return Deno2.build.os;
  }
  const { navigator } = globalThis;
  if (navigator?.appVersion?.includes?.("Win")) {
    return "windows";
  }
  return "linux";
})();
var isWindows = osType === "windows";

// deno:https://deno.land/std@0.224.0/path/dirname.ts
function dirname3(path) {
  return isWindows ? dirname(path) : dirname2(path);
}

// deno:https://deno.land/std@0.224.0/path/from_file_url.ts
function fromFileUrl3(url) {
  return isWindows ? fromFileUrl(url) : fromFileUrl2(url);
}

// deno:https://deno.land/std@0.224.0/path/join.ts
function join3(...paths) {
  return isWindows ? join(...paths) : join2(...paths);
}

// deno:https://deno.land/std@0.224.0/path/resolve.ts
function resolve3(...pathSegments) {
  return isWindows ? resolve(...pathSegments) : resolve2(...pathSegments);
}

// src/tdoc/mod.ts
async function findNearestDenoConfig(startPath) {
  let dir = (await Deno.stat(startPath)).isDirectory ? resolve3(startPath) : dirname3(resolve3(startPath));
  while (true) {
    const jsonPath = join3(dir, "deno.json");
    const jsoncPath = join3(dir, "deno.jsonc");
    if (await exists(jsonPath)) return jsonPath;
    if (await exists(jsoncPath)) return jsoncPath;
    const parent = dirname3(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
async function loadImportMap(configPath) {
  try {
    let content = await Deno.readTextFile(configPath);
    if (configPath.endsWith(".jsonc")) {
      content = content.replace(/\/\/.*$/gm, "");
      content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    }
    const config = JSON.parse(content);
    return config.imports || null;
  } catch {
    return null;
  }
}
function resolveImportMapAlias(specifier, importMap, basePath) {
  if (!importMap) return specifier;
  if (importMap[specifier]) {
    const resolved = importMap[specifier];
    if (resolved.startsWith("./") || resolved.startsWith("../")) {
      return resolve3(basePath, resolved);
    }
    return resolved;
  }
  for (const [key, value] of Object.entries(importMap)) {
    if (key.endsWith("/") && specifier.startsWith(key)) {
      const resolved = value + specifier.slice(key.length);
      if (resolved.startsWith("./") || resolved.startsWith("../")) {
        return resolve3(basePath, resolved);
      }
      return resolved;
    }
  }
  return specifier;
}
async function exists(path) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}
async function getGitRoot() {
  const cmd = new Deno.Command("git", {
    args: [
      "rev-parse",
      "--show-toplevel"
    ],
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(`git rev-parse failed: ${new TextDecoder().decode(stderr)}`);
  }
  return resolve3(new TextDecoder().decode(stdout).trim());
}
async function getLocalTsDeps(entryTsFile) {
  const denoExe = Deno.execPath();
  const entryAbs = resolve3(entryTsFile);
  const rootAbs = await getGitRoot();
  const cmd = new Deno.Command(denoExe, {
    args: [
      "info",
      "--json",
      entryAbs
    ],
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(new TextDecoder().decode(stderr));
  }
  const info = JSON.parse(new TextDecoder().decode(stdout));
  const modules = info.modules ?? [];
  const isTsLike = (p) => /\.(mts|cts|ts|tsx)$/i.test(p);
  const results = /* @__PURE__ */ new Set();
  for (const m of modules) {
    if (!m.local || !m.local.startsWith("file://")) continue;
    const localPath = fromFileUrl3(m.local);
    if (!localPath.startsWith(rootAbs + "/") && localPath !== rootAbs) continue;
    if (localPath.includes("/node_modules/")) continue;
    if (!isTsLike(localPath)) continue;
    if (localPath === entryAbs) continue;
    try {
      const st = await Deno.stat(localPath);
      if (!st.isFile) continue;
      results.add(localPath);
    } catch {
    }
  }
  return [
    ...results
  ].sort();
}
function addBadges(text, badgeConfig) {
  let withBadges = text;
  let totalReplacements = 0;
  for (const [tag, config] of Object.entries(badgeConfig)) {
    const tagName = tag.split("/").pop() || tag;
    let replacement;
    if (config.type === "full") {
      replacement = config.content;
    } else {
      const color = config.color || "007ec6";
      const content = config.content.replace(/-/g, "--").replace(/_/g, "__").replace(/ /g, "_");
      const label = tagName.replace(/-/g, "--").replace(/_/g, "__").replace(/ /g, "_");
      replacement = `![pill](https://img.shields.io/badge/${content}-${label}-${color})<br>`;
    }
    const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = withBadges.match(regex) || [];
    withBadges = withBadges.replace(regex, replacement);
    totalReplacements += matches.length;
  }
  return withBadges;
}
function extractImports(code) {
  const imports = /* @__PURE__ */ new Map();
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
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(code)) !== null) {
      if (pattern.source.includes('import\\s+["')) {
        const moduleSpec2 = match[1];
        if (!moduleSpec2.startsWith(".") && !moduleSpec2.startsWith("/")) {
          if (!imports.has(moduleSpec2)) {
            imports.set(moduleSpec2, /* @__PURE__ */ new Set());
          }
          imports.get(moduleSpec2).add("__side_effect__");
        }
        continue;
      }
      const [, imported, moduleSpec] = match;
      if (moduleSpec.startsWith(".") || moduleSpec.startsWith("/")) continue;
      if (!imports.has(moduleSpec)) {
        imports.set(moduleSpec, /* @__PURE__ */ new Set());
      }
      if (imported.includes(",")) {
        imported.split(",").forEach((imp) => {
          const cleaned = imp.trim();
          if (cleaned) {
            imports.get(moduleSpec).add(cleaned);
          }
        });
      } else {
        imports.get(moduleSpec).add(imported.trim());
      }
    }
  }
  return imports;
}
function generateVerboseStubs(allImports) {
  let stubs = `// ============================================
// Type stubs for external dependencies
// ============================================

`;
  const generatedStubs = /* @__PURE__ */ new Set();
  for (const [module, items] of allImports) {
    if (items.has("__side_effect__")) {
      continue;
    }
    if (!module.startsWith("npm:") && !module.startsWith("jsr:") && !module.startsWith("https://") && !module.startsWith("#")) continue;
    const itemsToStub = [];
    for (const item of items) {
      if (item === "__side_effect__") continue;
      if (!generatedStubs.has(item)) {
        itemsToStub.push(item);
        generatedStubs.add(item);
      }
    }
    if (itemsToStub.length === 0) continue;
    stubs += `// Stubs for ${module}
`;
    for (const item of itemsToStub) {
      const isLikelyType = isTypeIdentifier(item);
      if (isLikelyType) {
        stubs += `type ${item} = any;
`;
      } else {
        stubs += `declare const ${item}: any;
`;
      }
    }
    stubs += "\n";
  }
  return stubs;
}
function isTypeIdentifier(name) {
  if (name === name.toUpperCase() && name.includes("_")) {
    return false;
  }
  if (name.includes("Schema") || name.includes("Type")) {
    return true;
  }
  const firstLetterUppercase = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
  if (name.includes("Error") && firstLetterUppercase) {
    return true;
  }
  return firstLetterUppercase;
}
function removeImports(code) {
  let result = code;
  result = result.replace(/^import\s+["'][^"']+["'];?\s*$/gm, "");
  result = result.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}
function removeDecorators(code) {
  const lines = code.split("\n");
  const result = [];
  let inDecorator = false;
  let parenDepth = 0;
  let inJSDoc = false;
  for (const line of lines) {
    if (line.trim().startsWith("/**")) {
      result.push(line);
      if (line.includes("*/")) {
        continue;
      }
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
    const decoratorMatch = line.match(/^\s*@[\w]+/);
    if (decoratorMatch && !inDecorator) {
      const afterDecorator = line.slice(decoratorMatch[0].length);
      if (afterDecorator.includes("(")) {
        parenDepth = 0;
        for (const char of afterDecorator) {
          if (char === "(") parenDepth++;
          else if (char === ")") parenDepth--;
        }
        if (parenDepth > 0) {
          inDecorator = true;
        }
      }
      continue;
    } else if (inDecorator) {
      for (const char of line) {
        if (char === "(") parenDepth++;
        else if (char === ")") parenDepth--;
      }
      if (parenDepth === 0) {
        inDecorator = false;
      }
      continue;
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}
function transformReExports(code) {
  let result = code;
  result = result.replace(/^export\s+(\{[^}]+\})\s+from\s+["'][^"']+["'];?\s*$/gm, "// [Removed re-export]");
  result = result.replace(/^export\s+type\s+(\{[^}]+\})\s+from\s+["'][^"']+["'];?\s*$/gm, "// [Removed type re-export]");
  result = result.replace(/^export\s+\*(?:\s+as\s+\w+)?\s+from\s+["'][^"']+["'];?\s*$/gm, "// [Removed: export * from module]");
  return result;
}
function generateDenoGlobals() {
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
async function concat(entry) {
  const configPath = await findNearestDenoConfig(entry);
  const importMap = configPath ? await loadImportMap(configPath) : null;
  const configDir = configPath ? dirname3(configPath) : dirname3(resolve3(entry));
  let resolvedEntry = entry;
  if (importMap && !entry.startsWith("./") && !entry.startsWith("/")) {
    resolvedEntry = resolveImportMapAlias(entry, importMap, configDir);
  }
  const cmd = new Deno.Command("deno", {
    args: [
      "info",
      "--json",
      resolvedEntry
    ],
    stdout: "piped",
    stderr: "inherit"
  });
  const { stdout } = await cmd.output();
  const info = JSON.parse(new TextDecoder().decode(stdout));
  let rootAbs;
  try {
    rootAbs = await getGitRoot();
  } catch {
    rootAbs = dirname3(resolve3(resolvedEntry));
  }
  const localFiles = [];
  const externalImports = /* @__PURE__ */ new Map();
  const processedFiles = /* @__PURE__ */ new Set();
  let content = "";
  const resolvedEntryPath = resolve3(resolvedEntry);
  const modules = (info.modules || []).slice();
  let entryModule = null;
  const otherModules = [];
  for (const module of modules) {
    if (module.local) {
      const localPath = module.local.startsWith("file://") ? fromFileUrl3(module.local) : module.local;
      if (localPath === resolvedEntryPath) {
        entryModule = module;
      } else {
        otherModules.push(module);
      }
    } else {
      otherModules.push(module);
    }
  }
  const orderedModules = entryModule ? [
    entryModule,
    ...otherModules.reverse()
  ] : otherModules.reverse();
  for (const module of orderedModules) {
    if (module.local) {
      const localPath = module.local.startsWith("file://") ? fromFileUrl3(module.local) : module.local;
      if (processedFiles.has(localPath)) continue;
      processedFiles.add(localPath);
      const isInProject = localPath.startsWith(rootAbs + "/") || localPath === rootAbs;
      const isNotNodeModules = !localPath.includes("/node_modules/");
      const isTsFile = localPath.endsWith(".ts") || localPath.endsWith(".tsx");
      if (isInProject && isNotNodeModules && isTsFile) {
        localFiles.push(localPath);
        try {
          let fileContent = await Deno.readTextFile(localPath);
          const fileImports = extractImports(fileContent);
          for (const [module2, items] of fileImports) {
            if (!externalImports.has(module2)) {
              externalImports.set(module2, /* @__PURE__ */ new Set());
            }
            items.forEach((item) => externalImports.get(module2).add(item));
          }
          fileContent = removeImports(fileContent);
          fileContent = removeDecorators(fileContent);
          fileContent = transformReExports(fileContent);
          const hasCode = fileContent.match(/(?:export|class|interface|type|const|function|enum)\s+\w+/);
          const hasJSDoc = fileContent.includes("/**");
          if (!hasCode && !hasJSDoc) {
            console.log(`Note: File contains only imports/comments, may have limited documentation: ${localPath}`);
          }
          content += `
// ============================================
`;
          content += `// Source: ${localPath}
`;
          content += `// ============================================

`;
          content += fileContent;
        } catch (e) {
          console.warn(`Skipping file ${localPath}: ${e.message}`);
          continue;
        }
      }
    }
  }
  return {
    content,
    files: localFiles,
    externalImports
  };
}
async function writeTsConfig(tmpDir, includePath = "concat.ts") {
  const entrypoint = join3(tmpDir, includePath);
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      lib: [
        "ES2022",
        "DOM"
      ],
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      noEmit: true,
      skipLibCheck: true
    },
    include: [
      entrypoint
    ]
  };
  const filePath = `${tmpDir}/tsconfig.json`;
  await Deno.writeTextFile(filePath, JSON.stringify(config, null, 2));
  return {
    filePath,
    entrypoint
  };
}
async function findGitRoot(startPath) {
  let currentPath = resolve3(startPath);
  while (currentPath !== "/") {
    try {
      const gitPath = join3(currentPath, ".git");
      const stat = await Deno.stat(gitPath);
      if (stat.isDirectory) {
        return currentPath;
      }
    } catch {
    }
    const parentPath = dirname3(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return null;
}
var cachedBadgeConfig = null;
var badgeConfigPath = null;
async function loadBadgeConfig(workingDir) {
  if (cachedBadgeConfig !== null) {
    return cachedBadgeConfig;
  }
  const defaultBadgeConfig = {
    "@lib/recordings": {
      content: "Lib-Recordings",
      color: "FF746C",
      type: "pill"
    },
    "@lib/transcription": {
      content: "Lib-Transcription",
      color: "26c6da",
      type: "pill"
    }
  };
  const gitRoot = await findGitRoot(workingDir);
  if (gitRoot) {
    badgeConfigPath = join3(gitRoot, "lib-tags.json");
    try {
      const configContent = await Deno.readTextFile(badgeConfigPath);
      cachedBadgeConfig = JSON.parse(configContent);
      console.log(`\u2713 Loaded badge config from: ${badgeConfigPath}`);
      return cachedBadgeConfig;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log(`\u2139 Using default badge config (no lib-tags.json found at git root)`);
      } else {
        console.warn(`\u26A0 Error loading lib-tags.json: ${error.message}`);
      }
    }
  }
  cachedBadgeConfig = defaultBadgeConfig;
  return cachedBadgeConfig;
}
async function processHtmlFiles(dir, customCssContent, customJsContent) {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join3(dir, entry.name);
    if (entry.isDirectory) {
      await processHtmlFiles(fullPath, customCssContent, customJsContent);
    } else if (entry.name.endsWith(".html")) {
      let content = await Deno.readTextFile(fullPath);
      content = content.replace("</head>", customCssContent + customJsContent + "</head>");
      await Deno.writeTextFile(fullPath, content);
      console.log(`\u2713 Modified HTML: ${fullPath}`);
    }
  }
}
function startWebSocketServer(port) {
  const clients = /* @__PURE__ */ new Set();
  const server = Deno.serve({
    port,
    hostname: "127.0.0.1"
  }, (req) => {
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
    return new Response("WebSocket server for hot reload", {
      status: 200
    });
  });
  server.notify = () => {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send("reload");
      }
    }
  };
  return server;
}
if (import.meta.main) {
  const checkAndInstallDeps = async () => {
    try {
      const checkCmd = new Deno.Command("npx", {
        args: [
          "typedoc",
          "--version"
        ],
        stdout: "null",
        stderr: "null"
      });
      const result = await checkCmd.output();
      if (!result.success) {
        console.log("Installing TypeDoc and varvara-typedoc-theme...");
        const installCmd = new Deno.Command("npm", {
          args: [
            "install",
            "-g",
            "typedoc",
            "varvara-typedoc-theme"
          ],
          stdout: "inherit",
          stderr: "inherit"
        });
        await installCmd.output();
      }
    } catch {
      console.log("Installing TypeDoc and varvara-typedoc-theme...");
      const installCmd = new Deno.Command("npm", {
        args: [
          "install",
          "-g",
          "typedoc",
          "varvara-typedoc-theme"
        ],
        stdout: "inherit",
        stderr: "inherit"
      });
      await installCmd.output();
    }
    try {
      const checkTheme = new Deno.Command("npm", {
        args: [
          "list",
          "-g",
          "varvara-typedoc-theme"
        ],
        stdout: "null",
        stderr: "null"
      });
      const themeResult = await checkTheme.output();
      if (!themeResult.success) {
        console.log("Installing varvara-typedoc-theme...");
        const installCmd = new Deno.Command("npm", {
          args: [
            "install",
            "-g",
            "varvara-typedoc-theme"
          ],
          stdout: "inherit",
          stderr: "inherit"
        });
        await installCmd.output();
      }
    } catch {
    }
  };
  await checkAndInstallDeps();
  const shouldWait = !Deno.args.includes("--no-wait");
  const watchMode = Deno.args.includes("--watch");
  const filteredArgs = Deno.args.filter((arg) => arg !== "--no-wait" && arg !== "--watch");
  const entry = filteredArgs[0] ?? "./design.ts";
  const tmpdir = "/tmp/tdoc";
  const docsOutputDir = join3(tmpdir, "typedoc");
  try {
  } catch {
  }
  await Deno.mkdir(tmpdir, {
    recursive: true
  });
  await Deno.mkdir(docsOutputDir, {
    recursive: true
  });
  console.log(`Using directory structure: ${tmpdir}`);
  let watchedFiles = [];
  const buildDocs = async (badgeConfig2) => {
    const outts2 = join3(tmpdir, "concat.ts");
    const { content, files, externalImports } = await concat(entry);
    const stubs = generateVerboseStubs(externalImports);
    const denoGlobals = generateDenoGlobals();
    let finalContent = content + denoGlobals + stubs;
    finalContent = addBadges(finalContent, badgeConfig2);
    await Deno.writeTextFile(outts2, finalContent);
    const resolvedEntryPath = resolve3(entry);
    watchedFiles = [
      .../* @__PURE__ */ new Set([
        resolvedEntryPath,
        ...files
      ])
    ];
    return outts2;
  };
  const workingDir = dirname3(resolve3(entry));
  const badgeConfig = await loadBadgeConfig(workingDir);
  const outts = await buildDocs(badgeConfig);
  const cwd = Deno.cwd();
  const parentFolderName = cwd.split("/").filter(Boolean).pop() || "Docs";
  const titleCase = parentFolderName.split(/[-_]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  const docsTitle = `${titleCase} Docs`;
  const wsPort = watchMode ? Math.floor(Math.random() * 1e4) + 4e4 : 0;
  const hotReloadScript = watchMode ? `
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
  ` : "";
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
<\/script>`;
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
  content: "\xA9 Rafa 2025";
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
  const extractReadmeFromComment = async (filePath) => {
    try {
      const content = await Deno.readTextFile(filePath);
      const packageDocMatch = content.match(/\/\*\*\s*\n\s*\*\s*@packageDocumentation[\s\S]*?\*\//);
      if (packageDocMatch) {
        let docContent = packageDocMatch[0];
        docContent = docContent.replace(/\/\*\*\s*\n/, "").replace(/\s*\*\//, "").replace(/\s*\*\s*@packageDocumentation\s*\n/, "").split("\n").map((line) => {
          const cleaned = line.replace(/^\s*\*\s?/, "");
          return cleaned;
        }).join("\n").trim();
        docContent = docContent.replace(/```mermaid[\s\S]*?```/g, (match) => {
          const lines = match.split("\n");
          const mermaidStart = lines[0];
          const mermaidEnd = "```";
          const mermaidContent = lines.slice(1, -1).filter((line) => line.trim() !== "").map((line) => line.trim()).join("\n");
          return `${mermaidStart}
${mermaidContent}
${mermaidEnd}`;
        });
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
  const extractEntrypoints = async (concatPath, badgeConfig2) => {
    const content = await Deno.readTextFile(concatPath);
    const lines = content.split("\n");
    const entrypointBlocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith("/**")) {
        let commentLines = [
          line
        ];
        let isEntrypoint = false;
        let j = i + 1;
        while (j < lines.length && !lines[j].includes("*/")) {
          commentLines.push(lines[j]);
          if (lines[j].includes("@entrypoint")) {
            isEntrypoint = true;
          }
          j++;
        }
        if (j < lines.length) {
          commentLines.push(lines[j]);
          j++;
        }
        if (isEntrypoint) {
          let entityLines = [
            ...commentLines
          ];
          let braceCount = 0;
          let foundBrace = false;
          while (j < lines.length) {
            const nextLine = lines[j];
            entityLines.push(nextLine);
            if (nextLine.includes("{")) {
              foundBrace = true;
              braceCount += (nextLine.match(/{/g) || []).length;
            }
            if (nextLine.includes("}")) {
              braceCount -= (nextLine.match(/}/g) || []).length;
              if (foundBrace && braceCount === 0) {
                j++;
                break;
              }
            }
            if (!foundBrace && nextLine.includes(";") && !nextLine.includes("{")) {
              j++;
              break;
            }
            j++;
          }
          entrypointBlocks.push(entityLines.join("\n"));
        }
        i = j;
      } else {
        i++;
      }
    }
    console.log(`\u2713 Found ${entrypointBlocks.length} entrypoints in concat.ts`);
    return entrypointBlocks;
  };
  const rebuildAndProcess = async () => {
    let readmeContent = null;
    const entrypointBlocks = await extractEntrypoints(outts, badgeConfig);
    const { filePath, entrypoint } = await writeTsConfig(tmpdir);
    const tdCommand = new Deno.Command("sh", {
      args: [
        "-c",
        `cd ${tmpdir} && npx -p varvara-typedoc-theme -p typedoc-plugin-mermaid typedoc --plugin varvara-typedoc-theme --plugin typedoc-plugin-mermaid --theme varvara-css --name "${docsTitle}" --out typedoc ${entrypoint} --tsconfig ${filePath} --customFooterHtml "\xA9 Rafa 2025" --categorizeByGroup true --groupOrder "*" --defaultCategory "Core" --includeVersion --excludePrivate --excludeProtected --excludeInternal`
      ],
      stdout: "inherit",
      stderr: "inherit"
    });
    const tdStatus = await tdCommand.output();
    if (!tdStatus.success) {
      console.error("TypeDoc failed");
      return false;
    }
    console.log(`\u2713 TypeDoc generated HTML files in: ${docsOutputDir}`);
    if (readmeContent) {
      const indexPath = join3(docsOutputDir, "index.html");
      let indexContent = await Deno.readTextFile(indexPath);
      let readmeHtml = readmeContent.replace(/```mermaid\n([\s\S]*?)\n```/g, (match, content) => {
        return `<div class="mermaid">${content}</div>`;
      }).replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>').replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>").replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>").replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>").replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>").replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>").replace(/\*\*(.+?)\*\*/gm, "<strong>$1</strong>").replace(/^\s*-\s+(.+)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>").replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g, function(match) {
        return match.includes("1.") ? "<ol>" + match + "</ol>" : "<ul>" + match + "</ul>";
      }).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>").replace(/<p>(<h\d>)/g, "$1").replace(/(<\/h\d>)<\/p>/g, "$1").replace(/<p>(<ul>|<ol>|<div class="mermaid">|<pre>)/g, "$1").replace(/(<\/ul>|<\/ol>|<\/div>|<\/pre>)<\/p>/g, "$1");
      const contentMatch = indexContent.match(/<div class="col-content">/);
      if (contentMatch) {
        const insertPos = contentMatch.index + contentMatch[0].length;
        const readmeSection = `
          <div class="tsd-panel tsd-typography">
            ${readmeHtml}
          </div>
        `;
        indexContent = indexContent.slice(0, insertPos) + readmeSection + indexContent.slice(insertPos);
        await Deno.writeTextFile(indexPath, indexContent);
        console.log(`\u2713 Injected README into: ${indexPath}`);
      }
    }
    await processHtmlFiles(docsOutputDir, customCssContent, customJsContent);
    if (entrypointBlocks && entrypointBlocks.length > 0) {
      console.log(`\u2713 Processing ${entrypointBlocks.length} entrypoints for HTML injection`);
      const indexPath = join3(docsOutputDir, "index.html");
      let indexContent = await Deno.readTextFile(indexPath);
      let entrypointsHtml = `
        <h1>Entrypoints</h1>
        <ul>
      `;
      for (const block of entrypointBlocks) {
        const nameMatch = block.match(/(?:interface|class|type)\s+(\w+)/);
        const entityName = nameMatch ? nameMatch[1] : "";
        entrypointsHtml += `
            <li><a href="interfaces/${entityName}.html">${entityName}</a></li>
        `;
      }
      entrypointsHtml += `
          </ul>`;
      let insertionPoint = -1;
      let insertBefore = "";
      const readmePanelStart = indexContent.indexOf('<div class="tsd-panel tsd-typography">');
      if (readmePanelStart > -1) {
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
              insertionPoint = i + 6;
              insertBefore = "after README panel";
              break;
            }
          }
          i++;
        }
      }
      if (insertionPoint === -1) {
        const footerIndex = indexContent.indexOf("<footer");
        if (footerIndex > -1) {
          insertionPoint = footerIndex;
          insertBefore = "<footer";
        }
      }
      if (insertionPoint > -1) {
        indexContent = indexContent.slice(0, insertionPoint) + entrypointsHtml + indexContent.slice(insertionPoint);
        await Deno.writeTextFile(indexPath, indexContent);
        console.log(`\u2713 Injected entrypoints section with syntax highlighting before ${insertBefore}`);
      } else {
        console.log(`\u26A0 Could not find suitable location to inject entrypoints`);
      }
    }
    return true;
  };
  const buildSuccess = await rebuildAndProcess();
  if (!buildSuccess) {
    Deno.exit(1);
  }
  let wsServer = null;
  if (watchMode) {
    wsServer = startWebSocketServer(wsPort);
    console.log(`WebSocket server for hot reload running on port ${wsPort}`);
  }
  const listener = Deno.listen({
    port: 0
  });
  const port = listener.addr.port;
  listener.close();
  const serverCommand = new Deno.Command("python3", {
    args: [
      "-m",
      "http.server",
      String(port)
    ],
    cwd: docsOutputDir,
    stdout: "null",
    stderr: "null"
  });
  const server = serverCommand.spawn();
  const url = `http://127.0.0.1:${port}/index.html`;
  console.log(`Docs served at ${url}`);
  if (watchMode) {
    console.log("Watching for changes... Press Ctrl+C to stop.");
  }
  try {
    const openCommand = new Deno.Command("open", {
      args: [
        url
      ]
    });
    await openCommand.output();
  } catch {
    try {
      const xdgOpenCommand = new Deno.Command("xdg-open", {
        args: [
          url
        ]
      });
      await xdgOpenCommand.output();
    } catch {
      console.log("Open this URL manually:", url);
    }
  }
  if (watchMode) {
    let debounceTimer;
    let watcherController = null;
    const startWatcher = async () => {
      if (watcherController) {
        watcherController.abort();
      }
      watcherController = new AbortController();
      const { signal } = watcherController;
      const allWatchedFiles = [
        ...watchedFiles
      ];
      if (badgeConfigPath && await exists(badgeConfigPath)) {
        allWatchedFiles.push(badgeConfigPath);
      }
      console.log(`Watching ${allWatchedFiles.length} files (${watchedFiles.length} from bundle${badgeConfigPath ? " + lib-tags.json" : ""})...`);
      const watcher = Deno.watchFs(allWatchedFiles, {
        signal
      });
      try {
        for await (const event of watcher) {
          const relevantChange = event.paths.some((path) => allWatchedFiles.includes(path));
          if (!relevantChange) continue;
          const badgeConfigChanged = badgeConfigPath && event.paths.includes(badgeConfigPath);
          if (badgeConfigChanged) {
            cachedBadgeConfig = null;
            console.log("Badge configuration changed");
          }
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            rebuild();
            debounceTimer = void 0;
          }, 500);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        throw e;
      }
    };
    const rebuild = async () => {
      console.log("\nFiles changed, rebuilding...");
      try {
        if (cachedBadgeConfig === null) {
          const newBadgeConfig = await loadBadgeConfig(workingDir);
          Object.assign(badgeConfig, newBadgeConfig);
        }
        const oldFileCount = watchedFiles.length;
        const newOutts = await buildDocs(badgeConfig);
        const success = await rebuildAndProcess();
        if (success) {
          console.log("Rebuild complete, reloading browser...");
          if (wsServer?.notify) {
            wsServer.notify();
          }
          if (watchedFiles.length !== oldFileCount) {
            console.log(`File dependencies changed (${oldFileCount} \u2192 ${watchedFiles.length}), updating watcher...`);
            startWatcher();
          }
        } else {
          console.error("Rebuild failed, skipping reload");
        }
      } catch (error) {
        console.error("Error during rebuild:", error);
      }
    };
    startWatcher();
    await new Promise(() => {
    });
  } else {
    if (shouldWait) {
      console.log("Press Enter to close and clean up\u2026");
      const buffer = new Uint8Array(1);
      await Deno.stdin.read(buffer);
    } else {
      console.log("Server running in background mode. Kill process to stop.");
      await new Promise(() => {
      });
    }
  }
  console.log("\nCleaning up...");
  try {
    server.kill("SIGTERM");
    console.log("Stopped HTTP server");
  } catch {
  }
  if (wsServer) {
    await wsServer.shutdown();
    console.log("Stopped WebSocket server");
  }
  try {
    console.log(`Removed debug directory: ${tmpdir}`);
  } catch (e) {
    console.error(`Failed to remove ${tmpdir}:`, e);
  }
  console.log("Cleanup complete.");
}
export {
  findNearestDenoConfig,
  getGitRoot,
  getLocalTsDeps,
  loadImportMap,
  resolveImportMapAlias,
  writeTsConfig
};
