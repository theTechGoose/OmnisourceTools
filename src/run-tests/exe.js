#!/usr/bin/env deno run -A
// enforce-dirs/specs.ts
var structure = {
  src: [
    "#developed",
    "#undeveloped"
  ],
  deno: "json",
  design: "ts",
  tests: [
    "#developedTests",
    "#undevelopedTests"
  ]
};
var macros = {
  basic: {
    surface: {
      "...": "#basic"
    },
    mod: "ts",
    unit: [
      "test.ts",
      "nop.test.ts"
    ]
  },
  polymorphic: {
    implementations: {
      "...": "#basic"
    },
    base: "ts",
    unit: "test.ts",
    mod: "ts"
  },
  folder: {
    "...": [
      "json",
      "mp3"
    ]
  },
  developed: {
    bootstrap: [
      "ts"
    ],
    "...": {
      domain: {
        business: {
          "...": [
            "#polymorphic",
            "#basic"
          ]
        },
        data: {
          "...": [
            "#polymorphic",
            "#basic",
            "@nopTests"
          ]
        }
      },
      routes: {
        "...": {
          internals: {
            "...": "#basic"
          },
          entry: "ts"
        }
      },
      dto: {
        "...": "#basic"
      },
      mod: "ts"
    }
  },
  undeveloped: {
    bootstrap: [
      "ts"
    ],
    domain: {
      business: {
        "...": [
          "#polymorphic",
          "#basic"
        ]
      },
      data: {
        "...": [
          "#polymorphic",
          "#basic",
          "@nopTests"
        ]
      }
    },
    routes: {
      "...": {
        internals: {
          "...": "#basic"
        },
        entry: "ts"
      }
    },
    dto: {
      "...": "#basic"
    }
  },
  developedTests: {
    examples: {
      "...": [
        "#basic",
        "@nopTests"
      ],
      artifacts: [
        "#folder"
      ]
    },
    "e2e?": {
      surface: {
        "...": [
          "e2e.ts"
        ]
      },
      artifacts: {
        "...": [
          "json",
          "mp3",
          "#folder"
        ]
      }
    },
    integration: {
      surface: {
        "...": [
          "integration.ts"
        ]
      },
      artifacts: {
        "...": [
          "json",
          "mp3",
          "#folder"
        ]
      }
    },
    fixtures: {
      "...": [
        "json",
        "mp3",
        "#folder"
      ]
    }
  },
  undevelopedTests: {
    examples: {
      "...": [
        "#basic",
        "@nopTests"
      ],
      artifacts: [
        "#folder"
      ]
    },
    "integration?": {
      surface: {
        "...": [
          "integration.ts"
        ]
      },
      artifacts: {
        "...": [
          "json",
          "mp3",
          "#folder"
        ]
      }
    }
  }
};
var rules = {
  noRoot: (p) => {
    if (!p.startsWith("_root")) return null;
    return `_root is depricated, use bootstrap.ts instead`;
  },
  nopTests: async (p) => {
    const testFile = pathJoin(p, "unit.test.ts");
    const nopTestFile = pathJoin(p, "unit.nop.test.ts");
    try {
      const hasUnitTest = (await Deno.stat(testFile)).isFile;
      if (hasUnitTest) {
        return `tests here should be named 'unit.nop.test.ts' to indicate they are no-ops.`;
      }
    } catch {
    }
    return null;
  }
};
function pathJoin(...parts) {
  return parts.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}

// enforce-dirs/validate.ts
function expandMacrosWithDepth(spec, macroDefinitions, currentMacro, depth) {
  if (depth > 10) {
    return spec;
  }
  if (typeof spec === "string") {
    if (spec.startsWith("#")) {
      const macroName = spec.substring(1);
      if (macroName === currentMacro) {
        return spec;
      }
      if (!macroDefinitions[macroName]) {
        throw new Error(`Macro not found: #${macroName}`);
      }
      return expandMacrosWithDepth(macroDefinitions[macroName], macroDefinitions, macroName, depth + 1);
    }
    if (spec.startsWith("@")) {
      return spec;
    }
    return spec;
  }
  if (Array.isArray(spec)) {
    const expanded = spec.map((item) => expandMacrosWithDepth(item, macroDefinitions, currentMacro, depth));
    return expanded;
  }
  if (typeof spec === "object" && spec !== null) {
    const expanded = {};
    for (const [key, value] of Object.entries(spec)) {
      expanded[key] = expandMacrosWithDepth(value, macroDefinitions, currentMacro, depth);
    }
    return expanded;
  }
  return spec;
}
function expandMacros(spec, macroDefinitions) {
  return expandMacrosWithDepth(spec, macroDefinitions, null, 0);
}
async function scanDirectory(path) {
  const name = path.split("/").pop() || "";
  try {
    const stat = await Deno.stat(path);
    if (stat.isFile) {
      const parts = name.split(".");
      const extension = parts.length > 1 ? parts.slice(1).join(".") : void 0;
      return {
        type: "file",
        name: parts[0],
        extension
      };
    }
    if (stat.isDirectory) {
      const children = /* @__PURE__ */ new Map();
      const ignoredDirs = [
        "node_modules",
        ".git",
        "dist",
        ".cache"
      ];
      if (ignoredDirs.includes(name)) {
        return {
          type: "directory",
          name,
          children
        };
      }
      for await (const entry of Deno.readDir(path)) {
        const childPath = `${path}/${entry.name}`;
        const child = await scanDirectory(childPath);
        children.set(entry.name, child);
      }
      return {
        type: "directory",
        name,
        children
      };
    }
    return {
      type: "file",
      name
    };
  } catch (error) {
    return {
      type: "file",
      name
    };
  }
}
function matchesFileExtension(node, extension) {
  if (node.type !== "file") return false;
  if (extension.includes(".")) {
    const expectedParts = extension.split(".");
    const actualName = node.name + (node.extension ? "." + node.extension : "");
    return actualName.endsWith("." + extension);
  }
  return node.extension === extension;
}
async function validateNode(spec, actual, path, issues, ruleDefinitions, originalSpec) {
  if (typeof spec === "string" && spec.startsWith("@")) {
    const ruleName = spec.substring(1);
    if (ruleDefinitions[ruleName]) {
      const result = await ruleDefinitions[ruleName](path);
      if (result) {
        issues.push({
          issue: result,
          location: path
        });
      }
    }
    return;
  }
  if (typeof spec === "string") {
    if (!actual) {
      issues.push({
        issue: `Expected file with extension .${spec}`,
        location: path
      });
    } else if (!matchesFileExtension(actual, spec)) {
      if (actual.type === "directory") {
        issues.push({
          issue: `Expected file with extension .${spec}, but found directory`,
          location: path
        });
      } else {
        issues.push({
          issue: `Expected file with extension .${spec}, but found .${actual.extension || "no extension"}`,
          location: path
        });
      }
    }
    return;
  }
  if (Array.isArray(spec)) {
    let matched = false;
    const tempIssues = [];
    const origArray = originalSpec && Array.isArray(originalSpec) ? originalSpec : spec;
    for (let i = 0; i < spec.length; i++) {
      const subSpec = spec[i];
      const origSubSpec = origArray[i];
      const subIssues = [];
      await validateNode(subSpec, actual, path, subIssues, ruleDefinitions, origSubSpec);
      if (subIssues.length === 0) {
        matched = true;
        break;
      }
      tempIssues.push(...subIssues);
    }
    if (!matched) {
      const specDescriptions = origArray.map((s, index) => {
        if (typeof s === "string") {
          if (s.startsWith("@")) return `rule:${s.substring(1)}`;
          if (s.startsWith("#")) return `macro:${s.substring(1)}`;
          return `.${s}`;
        }
        if (typeof s === "object" && !Array.isArray(s)) {
          const keys = Object.keys(s).filter((k) => k !== "...");
          if (keys.length > 0) {
            const childDescriptions = keys.slice(0, 3).map((k) => {
              const childSpec = s[k];
              const keyName = k.replace("?", "");
              if (Array.isArray(childSpec) && childSpec.length === 1 && typeof childSpec[0] === "string" && !childSpec[0].startsWith("#") && !childSpec[0].startsWith("@")) {
                return `${keyName}.${childSpec[0]}`;
              } else if (typeof childSpec === "string" && !childSpec.startsWith("#") && !childSpec.startsWith("@")) {
                return `${keyName}.${childSpec}`;
              }
              return keyName;
            });
            return `directory containing [${childDescriptions.join(", ")}${keys.length > 3 ? ", ..." : ""}]`;
          }
        }
        return `directory`;
      });
      if (!actual) {
        issues.push({
          issue: `Expected one of: ${specDescriptions.join(", ")}`,
          location: path
        });
      } else {
        issues.push({
          issue: `Does not match any of: ${specDescriptions.join(", ")}`,
          location: path
        });
      }
    }
    return;
  }
  if (typeof spec === "object" && spec !== null) {
    if (!actual) {
      issues.push({
        issue: `Expected directory`,
        location: path
      });
      return;
    }
    if (actual.type !== "directory") {
      issues.push({
        issue: `Expected directory, but found file`,
        location: path
      });
      return;
    }
    const children = actual.children || /* @__PURE__ */ new Map();
    const processedChildren = /* @__PURE__ */ new Set();
    for (const [key, childSpec] of Object.entries(spec)) {
      if (key === "...") {
        for (const [childName, childNode] of children) {
          if (!processedChildren.has(childName)) {
            await validateNode(childSpec, childNode, `${path}/${childName}`, issues, ruleDefinitions, childSpec);
            processedChildren.add(childName);
          }
        }
      } else if (key.endsWith("?")) {
        const dirName = key.slice(0, -1);
        let childNode = children.get(dirName);
        let usedName = dirName;
        if (!childNode && typeof childSpec === "string" && !childSpec.startsWith("#") && !childSpec.startsWith("@")) {
          const withExt = `${dirName}.${childSpec}`;
          childNode = children.get(withExt);
          if (childNode) {
            usedName = withExt;
          }
        }
        if (childNode) {
          await validateNode(childSpec, childNode, `${path}/${dirName}`, issues, ruleDefinitions, childSpec);
          processedChildren.add(usedName);
        }
      } else {
        let childNode = children.get(key);
        let usedName = key;
        if (!childNode && typeof childSpec === "string" && !childSpec.startsWith("#") && !childSpec.startsWith("@")) {
          const withExt = `${key}.${childSpec}`;
          childNode = children.get(withExt);
          if (childNode) {
            usedName = withExt;
          }
        }
        await validateNode(childSpec, childNode, `${path}/${key}`, issues, ruleDefinitions, childSpec);
        if (childNode) {
          processedChildren.add(usedName);
        }
      }
    }
    if (!spec["..."]) {
      for (const [childName, childNode] of children) {
        if (!processedChildren.has(childName)) {
          let matchesOptional = false;
          for (const key of Object.keys(spec)) {
            if (key.endsWith("?") && key.slice(0, -1) === childName) {
              matchesOptional = true;
              break;
            }
          }
          if (!matchesOptional) {
            issues.push({
              issue: `Unexpected ${childNode.type}`,
              location: `${path}/${childName}`
            });
          }
        }
      }
    }
  }
}
async function validateStructure(targetDir = ".") {
  try {
    const expandedSpec = expandMacros(structure, macros);
    const actualStructure = await scanDirectory(targetDir);
    const issues = [];
    if (actualStructure.type === "directory" && actualStructure.children) {
      if (typeof expandedSpec === "object" && !Array.isArray(expandedSpec)) {
        const processedChildren = /* @__PURE__ */ new Set();
        for (const [key, childSpec] of Object.entries(expandedSpec)) {
          if (key === "...") {
            for (const [childName, childNode] of actualStructure.children) {
              if (!processedChildren.has(childName)) {
                await validateNode(childSpec, childNode, `${targetDir}/${childName}`, issues, rules || {}, structure["..."]);
                processedChildren.add(childName);
              }
            }
          } else if (key.endsWith("?")) {
            const dirName = key.slice(0, -1);
            let childNode = actualStructure.children.get(dirName);
            if (!childNode && typeof childSpec === "string") {
              const withExt = `${dirName}.${childSpec}`;
              childNode = actualStructure.children.get(withExt);
              if (childNode) {
                processedChildren.add(withExt);
              }
            } else if (childNode) {
              processedChildren.add(dirName);
            }
            if (childNode) {
              await validateNode(childSpec, childNode, `${targetDir}/${dirName}`, issues, rules || {}, structure[key]);
            }
          } else {
            let childNode = actualStructure.children.get(key);
            let actualKey = key;
            if (!childNode && typeof childSpec === "string") {
              const withExt = `${key}.${childSpec}`;
              childNode = actualStructure.children.get(withExt);
              if (childNode) {
                actualKey = withExt;
                processedChildren.add(withExt);
              }
            } else if (childNode) {
              processedChildren.add(key);
            }
            await validateNode(childSpec, childNode, `${targetDir}/${key}`, issues, rules || {}, structure[key]);
          }
        }
        const specKeys = Object.keys(expandedSpec);
        const hasWildcard = specKeys.includes("...");
        if (!hasWildcard) {
          for (const [childName] of actualStructure.children) {
            if (!processedChildren.has(childName)) {
              const childNode = actualStructure.children.get(childName);
              issues.push({
                issue: `Unexpected ${childNode.type}`,
                location: `${targetDir}/${childName}`
              });
            }
          }
        }
      } else {
        await validateNode(expandedSpec, actualStructure, targetDir, issues, rules || {}, structure);
      }
    } else {
      await validateNode(expandedSpec, actualStructure, targetDir, issues, rules || {}, structure);
    }
    return {
      name: `validate-structure: ${targetDir}`,
      issues,
      message: issues.length === 0 ? "All validations passed" : `Found ${issues.length} validation issue(s)`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: `validate-structure: ${targetDir}`,
      issues: [
        {
          issue: errorMessage,
          location: targetDir
        }
      ],
      message: `Validation failed: ${errorMessage}`
    };
  }
}
if (false) {
  const targetDir = Deno.args[0] || ".";
  const result = await validateStructure(targetDir);
  if (result.issues.length === 0) {
    console.log("\u2705", result.message);
    Deno.exit(0);
  } else {
    for (const issue of result.issues) {
      console.log(`\u274C ${issue.location}: ${issue.issue}`);
    }
    console.log(`
${result.message}`);
    Deno.exit(1);
  }
}

// enforce-dirs/mod.ts
async function enforceStructure(rootDir) {
  try {
    const result = await validateStructure(rootDir);
    return {
      ...result,
      name: "structure",
      message: result.message || "Directory structure validation complete"
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: "structure",
      issues: [
        {
          issue: `Structure validation error: ${errorMessage}`,
          location: rootDir
        }
      ],
      message: `Failed to validate directory structure: ${errorMessage}`
    };
  }
}

// enforce-check/mod.ts
async function runDenoCheck(root = "src") {
  const issues = [];
  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      const out = await runDenoCheck(path);
      issues.push(...out.issues);
    } else if (entry.isFile && path.endsWith(".ts")) {
      const cmd = new Deno.Command("deno", {
        args: [
          "check",
          path
        ],
        stdout: "piped",
        stderr: "piped"
      });
      const { code, stdout, stderr } = await cmd.output();
      const out = new TextDecoder().decode(stdout);
      const err = new TextDecoder().decode(stderr);
      if (code !== 0) {
        const lines = (out + "\n" + err).split("\n").filter((l) => l.trim().length > 0);
        let currentFile = path;
        for (const line of lines) {
          const fileMatch = line.match(/at (file:\/\/.*):(\d+):(\d+)/);
          if (fileMatch) {
            currentFile = fileMatch[1].replace("file://", "");
            issues.push({
              issue: "Type check error",
              location: `${currentFile}:${fileMatch[2]}`
            });
          } else if (line.startsWith("error:") || line.includes("[ERROR]")) {
            issues.push({
              issue: line.trim(),
              location: currentFile
            });
          }
        }
      }
    }
  }
  return {
    name: "deno check",
    issues,
    message: ""
  };
}

// enforce-imports/mod.ts
function parseGrepOutput(grepOutput) {
  return grepOutput.split("\n").filter((line) => line.trim().length > 0).map((line) => {
    const match = line.match(/^(.*?):(\d+):(.*)$/);
    if (!match) {
      return {
        issue: `Unrecognized grep output format: ${line}`,
        location: "unknown"
      };
    }
    const [, file, lineNum, content] = match;
    return {
      issue: `Invalid relative import found: ${content.trim()}`,
      location: `${file}:${lineNum}`
    };
  });
}
async function findInvalidRelativeImports(root = "src") {
  const name = "enforce-imports";
  const args = [
    "-rn",
    `--include=*.ts`,
    String.raw`import .*['"]\.\.\/`,
    root
  ];
  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code === 1) return {
    name,
    issues: [],
    message: ""
  };
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  if (code !== 0) {
    return {
      name,
      issues: [
        {
          issue: `grep failed (exit ${code}): ${err.trim() || "unknown error"}`,
          location: root
        }
      ],
      message: ""
    };
  }
  return {
    name,
    issues: parseGrepOutput(out),
    message: ""
  };
}
if (false) {
  const root = Deno.args[0] ?? "src";
  const result = await findInvalidRelativeImports(root);
  if (result.issues.length === 0) {
    console.log("\u2705 No invalid relative imports (with `..`) found.");
  } else {
    for (const i of result.issues) {
      console.log(`${i.location} -> ${i.issue}`);
    }
    Deno.exit(2);
  }
}

// enforce-lint/mod.ts
async function runDenoLint(root = "src") {
  const name = "deno lint";
  const cmd = new Deno.Command("deno", {
    args: [
      "lint",
      "--json",
      root
    ],
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  if (code !== 0 && !out.trim()) {
    return {
      name,
      issues: [
        {
          issue: `deno lint failed (exit ${code}): ${err.trim() || "unknown error"}`,
          location: root
        }
      ],
      message: ""
    };
  }
  let results;
  try {
    results = JSON.parse(out);
  } catch (_) {
    return {
      name,
      issues: [
        {
          issue: `Failed to parse deno lint output: ${out || err}`,
          location: root
        }
      ],
      message: ""
    };
  }
  const issues = [];
  if (Array.isArray(results)) {
    for (const file of results) {
      for (const d of file.diagnostics ?? []) {
        issues.push({
          issue: `[${d.code}] ${d.message}`,
          location: `${file.filePath}:${d.range.start.line + 1}:${d.range.start.col + 1}`
        });
      }
    }
  }
  return {
    name,
    issues,
    message: ""
  };
}

// utils/mod.ts
import { dirname, join } from "node:path";
async function getRoot(passedRoot = ".") {
  const absRoot = join(Deno.cwd(), passedRoot);
  const rootCandidate = await findNearestDenoJson(absRoot);
  const root = dirname(rootCandidate ?? absRoot);
  if (!root) {
    throw new Error("Could not find deno.json in any parent directory");
  }
  return root;
}
async function getEnvFile(_root) {
  const root = await findGitRoot(_root) ?? _root;
  if (!root) {
    throw new Error("Could not find git root");
  }
  return join(root, "env", "local");
}
async function findNearestDenoJson(startDir = Deno.cwd()) {
  let currentDir = startDir;
  while (true) {
    const denoJsonPath = join(currentDir, "deno.json");
    try {
      const stat = await Deno.stat(denoJsonPath);
      if (stat.isFile) {
        return denoJsonPath;
      }
    } catch {
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return null;
}
async function findGitRoot(startDir = Deno.cwd()) {
  let dir = startDir;
  while (true) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isDirectory && entry.name === ".git") {
          return dir;
        }
      }
    } catch {
    }
    const parent = new URL("..", `file://${dir}/`).pathname;
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
if (false) {
  console.log(await findGitRoot() ?? "\u274C No Git root found");
}

// enforce-test/mod.ts
async function runDenoTest(root = "src") {
  const name = "deno test";
  const path = await import("node:path");
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
      absoluteRoot
    ],
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  const issues = [];
  if (code !== 0) {
    const failuresMatch = out.match(/FAILURES\s*(?:\x1b\[0m)?\s*\n+([\s\S]*?)(?:\n\n|\n$)/);
    if (failuresMatch) {
      const failuresSection = failuresMatch[1];
      const failurePattern = /^(.+?)\s*(?:\x1b\[.*?m)?=>\s*(.+?):(\d+):(\d+)(?:\x1b\[.*?m)?$/gm;
      let match;
      while ((match = failurePattern.exec(failuresSection)) !== null) {
        let [, testName, filePath, line, column] = match;
        testName = testName.replace(/\x1b\[.*?m/g, "").trim();
        filePath = filePath.replace(/\x1b\[.*?m/g, "").trim();
        const absolutePath = filePath.startsWith("/") ? filePath : path.resolve(absoluteRoot, filePath);
        const cleanTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const errorPattern = new RegExp(`${cleanTestName}[\\s\\S]*?(?:\\x1b\\[.*?m)?error(?:\\x1b\\[.*?m)?:\\s*(.+?)(?:\\n|$)`, "m");
        const errorMatch = out.match(errorPattern);
        const errorMessage = errorMatch ? errorMatch[1].replace(/\x1b\[.*?m/g, "").trim() : `Test failed: ${testName}`;
        issues.push({
          issue: errorMessage,
          location: `${absolutePath}:${line}:${column}`
        });
      }
    }
    const failedTestPattern = /^(.+?)\s+\.\.\.\s+.*FAILED.*$/gm;
    const processedTests = /* @__PURE__ */ new Set();
    let failedMatch;
    while ((failedMatch = failedTestPattern.exec(out)) !== null) {
      const testName = failedMatch[1].trim();
      if (!issues.some((i) => i.issue.includes(testName))) {
        const runningPattern = new RegExp(`running \\d+ tests? from (.+?)\\n[\\s\\S]*?${testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m");
        const runningMatch = out.match(runningPattern);
        let location = runningMatch ? runningMatch[1] : absoluteRoot;
        location = location.replace(/\x1b\[.*?m/g, "").trim();
        const absolutePath = location.startsWith("/") ? location : path.resolve(absoluteRoot, location);
        if (!processedTests.has(testName)) {
          issues.push({
            issue: `Test failed: ${testName}`,
            location: absolutePath
          });
          processedTests.add(testName);
        }
      }
    }
  }
  if (err && err.length > 0) {
    const cleanErr = err.replace(/^.*Warning.*--env-file.*\n/gm, "");
    if (cleanErr.includes("error:")) {
      const errorPattern = /error:\s*(.+?)(?:\n|$)/g;
      let errorMatch;
      while ((errorMatch = errorPattern.exec(cleanErr)) !== null) {
        const errorMsg = errorMatch[1].trim();
        if (errorMsg !== "Test failed") {
          const filePattern = /at\s+(.+?):(\d+):(\d+)/;
          const fileMatch = cleanErr.match(filePattern);
          const location = fileMatch ? `${fileMatch[1]}:${fileMatch[2]}:${fileMatch[3]}` : absoluteRoot;
          issues.push({
            issue: errorMsg,
            location
          });
        }
      }
    }
  }
  return {
    name,
    issues,
    message: `Note: envfile located at: ${envFile ?? "none"}, please do not copy secrets, just reference the file`
  };
}

// bootstrap.ts
async function main() {
  const args = Deno.args.filter((arg) => !arg.startsWith("--"));
  const flags = Deno.args.filter((arg) => arg.startsWith("--"));
  const watchMode = flags.includes("--watch") || flags.includes("-w");
  if (args.length === 0) {
    console.error("Usage: run-tests [--watch|-w] <dir1> [dir2] [file.test.ts] ...");
    console.error("Example: run-tests src tests/integration");
    console.error("Example: run-tests --watch src");
    console.error("Example: run-tests src/myfile.test.ts");
    Deno.exit(1);
  }
  if (watchMode) {
    console.log(`\u{1F50D} Watch mode enabled. Watching: ${args.join(", ")}...`);
    console.log("Press Ctrl+C to exit.\n");
    console.log("\u{1F4CB} Running initial checks...\n");
    await runChecks(args);
    await watchFiles(args);
  } else {
    console.log(`Running checks on: ${args.join(", ")}...`);
    const exitCode = await runChecks(args);
    Deno.exit(exitCode);
  }
}
function logErrs(name, errs, message) {
  if (!errs.length) {
    console.log(`
\u2705\u2705\u2705\u2705\u2705 No ${name} issues found.\u2705\u2705\u2705\u2705\u2705
`);
    return 0;
  }
  console.log(`
=================\u274C ${errs.length} ${name} issues found=================
`);
  let i = 0;
  for (const e of errs) {
    console.log(`Issue ${++i}: location: ${e.location}`);
    console.log(`${e.issue}`);
    console.log("------------------------------------------------------------");
  }
  console.log(message);
  console.log(`=======================END ${name.toLocaleUpperCase()}==========================`);
  return errs.length;
}
async function runChecks(args) {
  const root = await getRoot(args[0]);
  const structureErrs = await enforceStructure(root);
  let errorCount = logErrs(structureErrs.name, structureErrs.issues, structureErrs.message);
  const allErrs = [];
  for (const path of args) {
    const checkErrs$ = runDenoCheck(path);
    const importErrs$ = findInvalidRelativeImports(path);
    const lintErrs$ = runDenoLint(path);
    const testErrs$ = runDenoTest(path);
    const errs2 = await Promise.all([
      testErrs$,
      checkErrs$,
      importErrs$,
      lintErrs$
    ]);
    allErrs.push(...errs2);
  }
  const errs = allErrs;
  for (const e of errs) {
    errorCount += logErrs(e.name, e.issues, e.message);
  }
  const envFileMsg = errs[0].message;
  const envMsg = `Note: this only works for unit tests. ${envFileMsg}, for integration, e2e, and nop.test.ts files, please run them separately`;
  if (errorCount > 0) {
    console.log(`\u274C Total issues found: ${errorCount}. Please fix the above issues. ${envMsg}`);
    return 0;
  } else {
    console.log(`\u{1F389} All checks passed! \u{1F389}${envMsg}`);
    return 0;
  }
}
async function watchFiles(paths) {
  const watcher = Deno.watchFs(paths, {
    recursive: true
  });
  console.log("\n\u{1F440} Watching for changes...\n");
  let debounceTimer = null;
  for await (const event of watcher) {
    const relevantPaths = event.paths.filter((path) => {
      if (path.includes("node_modules") || path.includes(".git")) {
        return false;
      }
      if (path.endsWith(".ts")) {
        return true;
      }
      if (event.kind === "create" || event.kind === "remove") {
        return true;
      }
      return false;
    });
    if (relevantPaths.length === 0) continue;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      console.clear();
      const runId = Math.random().toString(36).substring(2, 8);
      console.log(`
\u{1F504} File change detected: ${event.kind}`);
      console.log(`\u{1F4C1} Files: ${relevantPaths.join(", ")}
`);
      console.log(`Re-running checks... ${runId}
`);
      await runChecks(paths);
      console.log("\n\u{1F440} Watching for changes...\n");
      debounceTimer = null;
    }, 300);
  }
}
if (import.meta.main) {
  await main();
}
