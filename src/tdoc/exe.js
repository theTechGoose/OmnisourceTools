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

// deno:https://deno.land/std@0.224.0/path/windows/_util.ts
function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z;
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

// deno:https://deno.land/std@0.224.0/path/posix/_util.ts
function isPosixPathSeparator2(code) {
  return code === CHAR_FORWARD_SLASH;
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

// deno:https://deno.land/std@0.224.0/path/join.ts
function join3(...paths) {
  return isWindows ? join(...paths) : join2(...paths);
}

// mod.ts
var badgeConfig = {
  "@lib/recordings": "![pill](https://img.shields.io/badge/Lib-Recordings-FF746C)<br>",
  "@lib/transcription": "![pill](https://img.shields.io/badge/Lib-Transcription-26c6da)<br>"
};
function stripImportsAndDecoratorCalls(source) {
  let out = source;
  const importRegex = /^\s*import\s*(?:type\s+)?(?:\s*\{[\s\S]*?\}|\s+[\w$]+|\s*\*\s+as\s+[\w$]+|\s+[\w$]+\s*,\s*\{[\s\S]*?\})\s*from\s*["'][^"']+["']\s*;?\s*(?:\/\/[^\n]*)?\s*$/gm;
  out = out.split(importRegex).join("");
  const decoratorRegex = /^\s*@[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\s*\([^()\n]*\))?\s*$/gm;
  out = out.split(decoratorRegex).join("");
  return out;
}
async function concat(entry, outPath) {
  const command = new Deno.Command("deno", {
    args: [
      "info",
      "--json",
      entry
    ],
    stdout: "piped",
    stderr: "inherit"
  });
  const { stdout } = await command.output();
  const raw = new TextDecoder().decode(stdout);
  const graph = JSON.parse(raw);
  const bySpec = new Map(graph.modules.map((m) => [
    m.specifier,
    m
  ]));
  const visited = /* @__PURE__ */ new Set();
  const order = [];
  const includedFiles = [];
  function visit(spec) {
    if (!spec || visited.has(spec)) return;
    visited.add(spec);
    const m = bySpec.get(spec);
    if (!m) return;
    for (const d of m.dependencies ?? []) {
      const child = d.code?.specifier ?? d.type?.specifier ?? d.maybeCode?.specifier ?? d.specifier;
      visit(child);
    }
    order.push(spec);
  }
  for (const r of graph.roots ?? []) visit(r);
  if (order.length === 0 && graph.modules?.[0]) {
    visit(graph.modules[0].specifier);
  }
  const includeRemote = Deno.env.get("INCLUDE_REMOTE") === "1";
  const includeJs = Deno.env.get("INCLUDE_JS") === "1";
  const mediaOk = /* @__PURE__ */ new Set([
    "TypeScript",
    "TSX",
    ...includeJs ? [
      "JavaScript",
      "JSX"
    ] : []
  ]);
  let out = "";
  for (const spec of order) {
    const m = bySpec.get(spec);
    if (!m) continue;
    const isFile = (m.local ?? "").startsWith("/");
    if (!isFile && !includeRemote) continue;
    if (!m.mediaType || !mediaOk.has(m.mediaType)) continue;
    try {
      if (!m.local) continue;
      const src = await Deno.readTextFile(m.local);
      if (isFile) {
        includedFiles.push(m.local);
      }
      out += `
// =============================================
`;
      out += `// Source: ${spec}
`;
      out += `// Local:  ${m.local}
`;
      out += `// Media:  ${m.mediaType}
`;
      out += `// =============================================

`;
      out += src + "\n";
    } catch {
    }
    out = stripImportsAndDecoratorCalls(out);
  }
  const removedImports = out.split("\n").map((line) => line.includes("import") ? "" : line).filter(Boolean).join("\n");
  let withBadges = removedImports;
  let totalReplacements = 0;
  for (const [pattern, replacement] of Object.entries(badgeConfig)) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = withBadges.match(regex) || [];
    withBadges = withBadges.replace(regex, replacement);
    totalReplacements += matches.length;
  }
  await Deno.writeTextFile(outPath, withBadges);
  console.log(`\u2713 Generated concat.ts at: ${outPath}`);
  if (totalReplacements > 0) {
    console.log(`Replaced ${totalReplacements} badge patterns`);
  }
  return includedFiles;
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
  const buildDocs = async () => {
    const outts2 = join3(tmpdir, "concat.ts");
    let includedFiles = await concat(entry, outts2);
    watchedFiles = includedFiles;
    return outts2;
  };
  const outts = await buildDocs();
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
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
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
  
  // Initialize mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ 
      startOnLoad: true,
      theme: theme === 'dark' ? 'dark' : 'default'
    });
    // Re-render any mermaid diagrams that were injected
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    });
  }
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
  const extractEntrypoints = async (concatPath) => {
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
    let readmeContent = await extractReadmeFromComment(outts);
    const entrypointBlocks = await extractEntrypoints(outts);
    const tdCommand = new Deno.Command("sh", {
      args: [
        "-c",
        `cd ${tmpdir} && npx -p varvara-typedoc-theme -p typedoc-plugin-mermaid typedoc --plugin varvara-typedoc-theme --plugin typedoc-plugin-mermaid --theme varvara-css --name "${docsTitle}" --out typedoc concat.ts --customFooterHtml "\xA9 Rafa 2025" --categorizeByGroup true --defaultCategory "Data" --readme none`
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
      console.log(`Watching ${watchedFiles.length} files from the bundle...`);
      const watcher = Deno.watchFs(watchedFiles, {
        signal
      });
      try {
        for await (const event of watcher) {
          const relevantChange = event.paths.some((path) => watchedFiles.includes(path));
          if (!relevantChange) continue;
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
        const oldFileCount = watchedFiles.length;
        await buildDocs();
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
