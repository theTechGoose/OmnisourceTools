#!/usr/bin/env deno run -A
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
  ],
  "assets?": "#folder"
};
var macros = {
  basic: {
    "surface?": {
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
      "mp3",
      "html",
      "css"
    ]
  },
  developed: {
    bootstrap: "ts",
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
          "surface?": {
            "...": "#basic"
          },
          entry: "ts"
        }
      },
      "dto?": {
        "...": "#basic"
      },
      mod: "ts"
    }
  },
  undeveloped: {
    bootstrap: "ts",
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
    "routes?": {
      "...": {
        "surface?": {
          "...": "#basic"
        },
        entry: "ts"
      }
    },
    "dto?": {
      "...": "#basic"
    }
  },
  developedTests: {
    "examples?": {
      "...": [
        "#basic",
        "@nopTests"
      ],
      "artifacts?": [
        "#folder"
      ]
    },
    "e2e?": {
      surface: {
        "...": [
          "e2e.test.ts",
          "int.test.ts"
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
    "integration?": {
      surface: {
        "...": [
          "int.test.ts",
          "e2e.test.ts"
        ]
      },
      "artifacts?": {
        "...": [
          "json",
          "mp3",
          "#folder"
        ]
      },
      "fixtures?": {
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
          "int.test.ts",
          "e2e.test.ts"
        ]
      },
      "artifacts?": {
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
var DEBUG = Deno.env.get("DEBUG_VALIDATION") === "true";
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
async function scanDirectory(path3) {
  const name = path3.split("/").pop() || "";
  try {
    const stat = await Deno.stat(path3);
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
      for await (const entry of Deno.readDir(path3)) {
        const childPath = `${path3}/${entry.name}`;
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
async function validateNode(spec, actual, path3, issues, ruleDefinitions, originalSpec) {
  if (typeof spec === "string" && spec.startsWith("@")) {
    const ruleName = spec.substring(1);
    if (ruleDefinitions[ruleName]) {
      const result = await ruleDefinitions[ruleName](path3);
      if (result) {
        issues.push({
          issue: result,
          location: path3
        });
      }
    }
    return;
  }
  if (typeof spec === "string") {
    if (!actual) {
      issues.push({
        issue: `Expected file with extension .${spec}`,
        location: path3
      });
    } else if (!matchesFileExtension(actual, spec)) {
      if (actual.type === "directory") {
        issues.push({
          issue: `Expected file with extension .${spec}, but found directory`,
          location: path3
        });
      } else {
        issues.push({
          issue: `Expected file with extension .${spec}, but found .${actual.extension || "no extension"}`,
          location: path3
        });
      }
    }
    return;
  }
  if (Array.isArray(spec)) {
    let matched = false;
    const tempIssuesBySpec = [];
    const origArray = originalSpec && Array.isArray(originalSpec) ? originalSpec : spec;
    if (DEBUG && path3.includes("domain/business")) {
      console.log(`
=== DEBUG: Validating ${path3} ===`);
      console.log(`Actual type: ${actual ? actual.type : "undefined"}`);
      if (actual && actual.type === "directory" && actual.children) {
        console.log(`Actual children: ${Array.from(actual.children.keys()).join(", ")}`);
      }
      console.log(`Spec options: ${origArray.map((s) => typeof s === "string" ? s : "object").join(", ")}`);
    }
    for (let i = 0; i < spec.length; i++) {
      const subSpec = spec[i];
      const origSubSpec = origArray[i];
      const subIssues = [];
      if (DEBUG && path3.includes("domain/business")) {
        console.log(`
  Trying spec option ${i}: ${typeof origSubSpec === "string" ? origSubSpec : "object"}`);
        if (typeof subSpec === "object" && !Array.isArray(subSpec)) {
          console.log(`  Expanded spec keys: ${Object.keys(subSpec).join(", ")}`);
        }
      }
      await validateNode(subSpec, actual, path3, subIssues, ruleDefinitions, origSubSpec);
      if (DEBUG && path3.includes("domain/business")) {
        console.log(`  Result: ${subIssues.length} issues`);
        if (subIssues.length > 0) {
          console.log(`  First few issues: ${subIssues.slice(0, 3).map((i2) => i2.issue).join("; ")}`);
        }
      }
      if (subIssues.length === 0) {
        matched = true;
        break;
      }
      tempIssuesBySpec.push({
        spec: subSpec,
        origSpec: origSubSpec,
        issues: subIssues
      });
    }
    if (!matched) {
      let minIssues = Infinity;
      let closestIndex = 0;
      tempIssuesBySpec.forEach((item, index) => {
        if (item.issues.length < minIssues) {
          minIssues = item.issues.length;
          closestIndex = index;
        }
      });
      const closestSpec = origArray[closestIndex];
      const closestIssues = tempIssuesBySpec[closestIndex].issues;
      let mainDescription = "";
      if (typeof closestSpec === "string" && closestSpec.startsWith("#")) {
        const macroName = closestSpec.substring(1);
        mainDescription = `Closest match: macro:${macroName}
`;
        const issuesByLocation = /* @__PURE__ */ new Map();
        for (const issue of closestIssues) {
          const relPath = issue.location.replace(path3 + "/", "");
          if (!issuesByLocation.has(relPath)) {
            issuesByLocation.set(relPath, []);
          }
          let simpleIssue = issue.issue;
          if (issue.issue.includes("Expected file with extension")) {
            const extMatch = issue.issue.match(/Expected file with extension \.([\w.]+)/);
            const foundMatch = issue.issue.match(/but found \.([\w.]+|no extension)/);
            if (extMatch) {
              const expectedExt = extMatch[1];
              const fileName = relPath.split("/").pop();
              if (foundMatch && foundMatch[1] !== "no extension") {
                simpleIssue = `expected: ${fileName}.${expectedExt}, found: ${fileName}.${foundMatch[1]}`;
              } else if (issue.issue.includes("but found directory")) {
                simpleIssue = `expected: ${fileName}.${expectedExt} (file), found: ${fileName}/ (directory)`;
              } else {
                simpleIssue = `expected: ${fileName}.${expectedExt}, found: nothing`;
              }
            }
          } else if (issue.issue.includes("Expected directory")) {
            const dirName = relPath.split("/").pop();
            if (issue.issue.includes("but found file")) {
              simpleIssue = `expected: ${dirName}/ (directory), found: ${dirName} (file)`;
            } else {
              simpleIssue = `expected: ${dirName}/ (directory), found: nothing`;
            }
          } else if (issue.issue.includes("Unexpected file")) {
            simpleIssue = `unexpected file (should not exist)`;
          } else if (issue.issue.includes("Unexpected directory")) {
            simpleIssue = `unexpected directory (should not exist)`;
          } else if (issue.issue.includes("Does not match any of:")) {
            const patternsMatch = issue.issue.match(/Does not match any of: (.+)/);
            if (patternsMatch) {
              const patterns = patternsMatch[1];
              if (actual) {
                simpleIssue = `found: ${actual.type === "file" ? `file (${actual.extension || "no ext"})` : "directory"}, expected one of: ${patterns}`;
              } else {
                simpleIssue = `found: nothing, expected one of: ${patterns}`;
              }
            }
          } else if (issue.issue.includes("Expected one of:")) {
            const patternsMatch = issue.issue.match(/Expected one of: (.+)/);
            if (patternsMatch) {
              simpleIssue = `expected one of: ${patternsMatch[1]}, found: nothing`;
            }
          }
          issuesByLocation.get(relPath).push(simpleIssue);
        }
        const formattedIssues = [];
        for (const [loc, issues2] of issuesByLocation.entries()) {
          formattedIssues.push(`  ${loc}: ${issues2.join("; ")}`);
        }
        if (formattedIssues.length > 0) {
          mainDescription += "Issues:\n" + formattedIssues.join("\n");
        }
        const otherOptions = origArray.filter((_, i) => i !== closestIndex).map((s) => {
          if (typeof s === "string" && s.startsWith("#")) {
            return `macro:${s.substring(1)}`;
          } else if (typeof s === "string" && s.startsWith("@")) {
            return `rule:${s.substring(1)}`;
          }
          return "custom pattern";
        });
        if (otherOptions.length > 0) {
          mainDescription += `

Other options tried: ${otherOptions.join(", ")}`;
        }
        issues.push({
          issue: mainDescription,
          location: path3
        });
      } else {
        const specDescriptions = origArray.map((s, index) => {
          const specIssues = tempIssuesBySpec[index]?.issues || [];
          let description = "";
          if (typeof s === "string") {
            if (s.startsWith("@")) {
              description = `rule:${s.substring(1)}`;
            } else if (s.startsWith("#")) {
              description = `macro:${s.substring(1)}`;
            } else {
              description = `.${s}`;
            }
          } else {
            description = "pattern";
          }
          if (specIssues.length > 0) {
            description += ` (${specIssues.length} issues)`;
          }
          return description;
        });
        issues.push({
          issue: `Does not match any of: ${specDescriptions.join(", ")}`,
          location: path3
        });
      }
    }
    return;
  }
  if (typeof spec === "object" && spec !== null) {
    if (!actual) {
      issues.push({
        issue: `Expected directory`,
        location: path3
      });
      return;
    }
    if (actual.type !== "directory") {
      issues.push({
        issue: `Expected directory, but found file`,
        location: path3
      });
      return;
    }
    const children = actual.children || /* @__PURE__ */ new Map();
    const processedChildren = /* @__PURE__ */ new Set();
    for (const [key, childSpec] of Object.entries(spec)) {
      if (DEBUG && path3.includes("domain/business") && !path3.includes("/unit")) {
        console.log(`  Checking key '${key}' with spec: ${Array.isArray(childSpec) ? `[${childSpec}]` : typeof childSpec}`);
      }
      if (key === "...") {
        for (const [childName, childNode] of children) {
          if (!processedChildren.has(childName)) {
            await validateNode(childSpec, childNode, `${path3}/${childName}`, issues, ruleDefinitions, childSpec);
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
          await validateNode(childSpec, childNode, `${path3}/${dirName}`, issues, ruleDefinitions, childSpec);
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
        if (!childNode && Array.isArray(childSpec)) {
          if (DEBUG && path3.includes("domain/business") && key === "unit") {
            console.log(`  Looking for files with base '${key}' and extensions: ${childSpec}`);
            console.log(`  Available children: ${Array.from(children.keys())}`);
          }
          for (const ext of childSpec) {
            if (typeof ext === "string" && !ext.startsWith("#") && !ext.startsWith("@")) {
              const possibleName = `${key}.${ext}`;
              const foundChild = children.get(possibleName);
              if (DEBUG && path3.includes("domain/business") && key === "unit") {
                console.log(`    Checking for '${possibleName}': ${foundChild ? "found" : "not found"}`);
              }
              if (foundChild) {
                childNode = foundChild;
                usedName = possibleName;
                break;
              }
            }
          }
        }
        await validateNode(childSpec, childNode, `${path3}/${key}`, issues, ruleDefinitions, childSpec);
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
              location: `${path3}/${childName}`
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
  const cmd = new Deno.Command("deno", {
    args: [
      "check",
      "."
    ],
    cwd: root,
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  if (code !== 0) {
    const lines = err.split("\n").filter((l) => l.trim().length > 0);
    let currentError = "";
    let currentLocation = "";
    for (const line of lines) {
      if (line.includes("[33mWarning") || line.includes("Warning")) {
        continue;
      }
      if (line.includes("error:") || line.includes("[31merror")) {
        currentError = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/^.*?error:\s*/, "").trim();
      }
      const locationMatch = line.match(/at\s+(file:\/\/[^:]+):(\d+):(\d+)/);
      if (locationMatch) {
        currentLocation = `${locationMatch[1].replace("file://", "")}:${locationMatch[2]}:${locationMatch[3]}`;
        if (currentError && currentLocation) {
          issues.push({
            issue: currentError,
            location: currentLocation
          });
          currentError = "";
          currentLocation = "";
        }
      }
      const tsErrorMatch = line.match(/TS\d+\s*\[ERROR\]:\s*(.+)/);
      if (tsErrorMatch) {
        currentError = tsErrorMatch[1].trim();
      }
    }
    if (currentError && !currentLocation) {
      issues.push({
        issue: currentError,
        location: root
      });
    }
  }
  return {
    name: "deno check",
    issues,
    message: ""
  };
}

// enforce-imports/mod.ts
function parseGrepOutput(grepOutput, issueType) {
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
      issue: `${issueType}: ${content.trim()}`,
      location: `${file}:${lineNum}`
    };
  });
}
async function enforceImportRules(root = "src") {
  const name = "enforce-imports";
  const allIssues = [];
  const relativeImports = await findRelativeImports(root);
  allIssues.push(...relativeImports);
  const repoImports = await findInvalidRepoImports(root);
  allIssues.push(...repoImports);
  const npmImports = await findInvalidNpmImports(root);
  allIssues.push(...npmImports);
  const nodeImports = await findInvalidNodeImports(root);
  allIssues.push(...nodeImports);
  const unpinnedVersions = await findUnpinnedVersions(root);
  allIssues.push(...unpinnedVersions);
  return {
    name,
    issues: allIssues,
    message: allIssues.length === 0 ? "All import rules are followed" : ""
  };
}
async function findRelativeImports(root) {
  const args = [
    "-rn",
    `--include=*.ts`,
    String.raw`^\s*import .*['"]\.\.\/`,
    root
  ];
  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code === 1) return [];
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  if (code !== 0) {
    return [
      {
        issue: `grep failed (exit ${code}): ${err.trim() || "unknown error"}`,
        location: root
      }
    ];
  }
  return parseGrepOutput(out, "Invalid relative import found");
}
async function findInvalidRepoImports(root) {
  const patterns = [
    // Direct ./src/ imports (with optional whitespace)
    String.raw`^\s*import .*['"]\.\/src\/`,
    // Direct src/ imports (with optional whitespace)
    String.raw`^\s*import .*['"]src\/`,
    // Local ./ imports with subdirectories (with optional whitespace)
    String.raw`^\s*import .*['"]\.\/.*\/.*['"]`
  ];
  const allIssues = [];
  for (const pattern of patterns) {
    const args = [
      "-rn",
      `--include=*.ts`,
      pattern,
      root
    ];
    const cmd = new Deno.Command("grep", {
      args,
      stdout: "piped",
      stderr: "piped"
    });
    const { code, stdout } = await cmd.output();
    if (code === 0) {
      const out = new TextDecoder().decode(stdout);
      const lines = out.split("\n").filter((line) => {
        if (line.match(/^.*:.*:\s*import .*['"]\.\/[^\/]+\.ts['"]/)) {
          return false;
        }
        return line.trim().length > 0;
      });
      if (lines.length > 0) {
        const issues = parseGrepOutput(lines.join("\n"), "Repository import should use @ prefix from import map");
        allIssues.push(...issues);
      }
    }
  }
  return allIssues;
}
async function findInvalidNpmImports(root) {
  const pattern = String.raw`^\s*import .*['"]npm:`;
  const args = [
    "-rn",
    `--include=*.ts`,
    pattern,
    root
  ];
  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout } = await cmd.output();
  if (code === 1) return [];
  if (code === 0) {
    const out = new TextDecoder().decode(stdout);
    return parseGrepOutput(out, "npm: imports should use # prefix from import map (e.g., import '#class-validator')");
  }
  return [];
}
async function findInvalidNodeImports(root) {
  const pattern = String.raw`^\s*import .*['"]node:`;
  const args = [
    "-rn",
    `--include=*.ts`,
    pattern,
    root
  ];
  const cmd = new Deno.Command("grep", {
    args,
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout } = await cmd.output();
  if (code === 1) return [];
  if (code === 0) {
    const out = new TextDecoder().decode(stdout);
    return parseGrepOutput(out, "node: imports should use bare names from import map (e.g., import 'fs' not 'node:fs')");
  }
  return [];
}
async function findUnpinnedVersions(root) {
  const allIssues = [];
  const configPatterns = [
    String.raw`^\s*".*":\s*".*[\^~]`,
    String.raw`^\s*".*":\s*".*\*`,
    String.raw`^\s*".*":\s*"(npm|jsr|https?):.*@[\^~]`,
    String.raw`^\s*".*":\s*"(npm|jsr):.*@\*`,
    String.raw`^\s*".*":\s*"(npm|jsr):`
  ];
  const configFiles = [
    "deno.json",
    "deno.jsonc"
  ];
  for (const configFile of configFiles) {
    const configPath = `${root}/${configFile}`;
    try {
      await Deno.stat(configPath);
    } catch {
      continue;
    }
    for (const pattern of configPatterns) {
      const args = [
        "-nE",
        pattern,
        configPath
      ];
      const cmd = new Deno.Command("grep", {
        args,
        stdout: "piped",
        stderr: "piped"
      });
      const { code, stdout } = await cmd.output();
      if (code === 0) {
        const out = new TextDecoder().decode(stdout);
        const lines = out.split("\n").filter((line) => {
          if (line.includes("//") || !line.trim()) return false;
          return true;
        });
        for (const line of lines) {
          const match = line.match(/^(\d+):(.*)/);
          if (match) {
            const [, lineNum, content] = match;
            let issueMessage = "";
            if (pattern === String.raw`^\s*".*":\s*"(npm|jsr):`) {
              if (!content.match(/@[\d]/)) {
                issueMessage = `External package must have a version specified: ${content.trim()}`;
              }
            } else {
              issueMessage = `External package version should be pinned (remove ^, ~, or *): ${content.trim()}`;
            }
            if (issueMessage) {
              allIssues.push({
                issue: issueMessage,
                location: `${configPath}:${lineNum}`
              });
            }
          }
        }
      }
    }
  }
  const tsPatterns = [
    String.raw`^\s*import .*['"]https?://.*@[\^~]`,
    String.raw`^\s*import .*['"]https?://.*@\*`,
    String.raw`^\s*import .*['"]https?://deno\.land/(std|x)/[^@]*['"]`,
    String.raw`^\s*import .*['"]https?://esm\.sh/[^@?]*['"]`
  ];
  for (const pattern of tsPatterns) {
    const args = [
      "-rnE",
      `--include=*.ts`,
      pattern,
      root
    ];
    const cmd = new Deno.Command("grep", {
      args,
      stdout: "piped",
      stderr: "piped"
    });
    const { code, stdout } = await cmd.output();
    if (code === 0) {
      const out = new TextDecoder().decode(stdout);
      let issueType = "External package version should be pinned (remove ^, ~, or *)";
      if (pattern.includes("[^@]*['")) {
        issueType = "External package must have a version specified";
      }
      const issues = parseGrepOutput(out, issueType);
      allIssues.push(...issues);
    }
  }
  return allIssues;
}
async function findInvalidRelativeImports(root = "src") {
  return enforceImportRules(root);
}
if (false) {
  const root = Deno.args[0] ?? "src";
  const result = await enforceImportRules(root);
  if (result.issues.length === 0) {
    console.log("\u2705 All import rules are followed correctly:");
    console.log("  - No invalid relative imports (../)");
    console.log("  - Repository imports use @ prefix from import map");
    console.log("  - npm: imports use # prefix from import map");
    console.log("  - node: imports use bare names from import map");
    console.log("  - External packages are pinned to specific versions");
  } else {
    console.log("\u274C Found import rule violations:");
    for (const i of result.issues) {
      console.log(`  ${i.location} -> ${i.issue}`);
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
  if (results && typeof results === "object" && "diagnostics" in results) {
    for (const d of results.diagnostics ?? []) {
      issues.push({
        issue: `[${d.code}] ${d.message}`,
        location: `${d.filename}:${d.range.start.line}:${d.range.start.col}`
      });
    }
  } else if (Array.isArray(results)) {
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
  const absRoot = passedRoot.startsWith("/") ? passedRoot : join(Deno.cwd(), passedRoot);
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
  const path3 = await import("node:path");
  const absoluteRoot = root.startsWith("/") ? root : path3.resolve(root);
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
        const absolutePath = filePath.startsWith("/") ? filePath : path3.resolve(absoluteRoot, filePath);
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
        const absolutePath = location.startsWith("/") ? location : path3.resolve(absoluteRoot, location);
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

// deno:https://deno.land/std@0.190.0/_util/asserts.ts
var DenoStdInternalError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DenoStdInternalError";
  }
};
function assert(expr, msg = "") {
  if (!expr) {
    throw new DenoStdInternalError(msg);
  }
}

// deno:https://deno.land/std@0.190.0/_util/os.ts
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

// deno:https://deno.land/std@0.190.0/path/win32.ts
var win32_exports = {};
__export(win32_exports, {
  basename: () => basename,
  delimiter: () => delimiter,
  dirname: () => dirname2,
  extname: () => extname,
  format: () => format,
  fromFileUrl: () => fromFileUrl,
  isAbsolute: () => isAbsolute,
  join: () => join2,
  normalize: () => normalize,
  parse: () => parse,
  relative: () => relative,
  resolve: () => resolve,
  sep: () => sep,
  toFileUrl: () => toFileUrl,
  toNamespacedPath: () => toNamespacedPath
});

// deno:https://deno.land/std@0.190.0/path/_constants.ts
var CHAR_UPPERCASE_A = 65;
var CHAR_LOWERCASE_A = 97;
var CHAR_UPPERCASE_Z = 90;
var CHAR_LOWERCASE_Z = 122;
var CHAR_DOT = 46;
var CHAR_FORWARD_SLASH = 47;
var CHAR_BACKWARD_SLASH = 92;
var CHAR_COLON = 58;
var CHAR_QUESTION_MARK = 63;

// deno:https://deno.land/std@0.190.0/path/_util.ts
function assertPath(path3) {
  if (typeof path3 !== "string") {
    throw new TypeError(`Path must be a string. Received ${JSON.stringify(path3)}`);
  }
}
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}
function isPathSeparator(code) {
  return isPosixPathSeparator(code) || code === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z;
}
function normalizeString(path3, allowAboveRoot, separator, isPathSeparator2) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code;
  for (let i = 0, len = path3.length; i <= len; ++i) {
    if (i < len) code = path3.charCodeAt(i);
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
        if (res.length > 0) res += separator + path3.slice(lastSlash + 1, i);
        else res = path3.slice(lastSlash + 1, i);
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
function _format(sep4, pathObject) {
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) return base;
  if (base === sep4) return dir;
  if (dir === pathObject.root) return dir + base;
  return dir + sep4 + base;
}
var WHITESPACE_ENCODINGS = {
  "	": "%09",
  "\n": "%0A",
  "\v": "%0B",
  "\f": "%0C",
  "\r": "%0D",
  " ": "%20"
};
function encodeWhitespace(string) {
  return string.replaceAll(/[\s]/g, (c) => {
    return WHITESPACE_ENCODINGS[c] ?? c;
  });
}
function lastPathSegment(path3, isSep, start = 0) {
  let matchedNonSeparator = false;
  let end = path3.length;
  for (let i = path3.length - 1; i >= start; --i) {
    if (isSep(path3.charCodeAt(i))) {
      if (matchedNonSeparator) {
        start = i + 1;
        break;
      }
    } else if (!matchedNonSeparator) {
      matchedNonSeparator = true;
      end = i + 1;
    }
  }
  return path3.slice(start, end);
}
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
function stripSuffix(name, suffix) {
  if (suffix.length >= name.length) {
    return name;
  }
  const lenDiff = name.length - suffix.length;
  for (let i = suffix.length - 1; i >= 0; --i) {
    if (name.charCodeAt(lenDiff + i) !== suffix.charCodeAt(i)) {
      return name;
    }
  }
  return name.slice(0, -suffix.length);
}

// deno:https://deno.land/std@0.190.0/path/win32.ts
var sep = "\\";
var delimiter = ";";
function resolve(...pathSegments) {
  let resolvedDevice = "";
  let resolvedTail = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1; i--) {
    let path3;
    const { Deno: Deno2 } = globalThis;
    if (i >= 0) {
      path3 = pathSegments[i];
    } else if (!resolvedDevice) {
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a drive-letter-less path without a CWD.");
      }
      path3 = Deno2.cwd();
    } else {
      if (typeof Deno2?.env?.get !== "function" || typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a CWD.");
      }
      path3 = Deno2.cwd();
      if (path3 === void 0 || path3.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
        path3 = `${resolvedDevice}\\`;
      }
    }
    assertPath(path3);
    const len = path3.length;
    if (len === 0) continue;
    let rootEnd = 0;
    let device = "";
    let isAbsolute4 = false;
    const code = path3.charCodeAt(0);
    if (len > 1) {
      if (isPathSeparator(code)) {
        isAbsolute4 = true;
        if (isPathSeparator(path3.charCodeAt(1))) {
          let j = 2;
          let last = j;
          for (; j < len; ++j) {
            if (isPathSeparator(path3.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            const firstPart = path3.slice(last, j);
            last = j;
            for (; j < len; ++j) {
              if (!isPathSeparator(path3.charCodeAt(j))) break;
            }
            if (j < len && j !== last) {
              last = j;
              for (; j < len; ++j) {
                if (isPathSeparator(path3.charCodeAt(j))) break;
              }
              if (j === len) {
                device = `\\\\${firstPart}\\${path3.slice(last)}`;
                rootEnd = j;
              } else if (j !== last) {
                device = `\\\\${firstPart}\\${path3.slice(last, j)}`;
                rootEnd = j;
              }
            }
          }
        } else {
          rootEnd = 1;
        }
      } else if (isWindowsDeviceRoot(code)) {
        if (path3.charCodeAt(1) === CHAR_COLON) {
          device = path3.slice(0, 2);
          rootEnd = 2;
          if (len > 2) {
            if (isPathSeparator(path3.charCodeAt(2))) {
              isAbsolute4 = true;
              rootEnd = 3;
            }
          }
        }
      }
    } else if (isPathSeparator(code)) {
      rootEnd = 1;
      isAbsolute4 = true;
    }
    if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
      continue;
    }
    if (resolvedDevice.length === 0 && device.length > 0) {
      resolvedDevice = device;
    }
    if (!resolvedAbsolute) {
      resolvedTail = `${path3.slice(rootEnd)}\\${resolvedTail}`;
      resolvedAbsolute = isAbsolute4;
    }
    if (resolvedAbsolute && resolvedDevice.length > 0) break;
  }
  resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
  return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
function normalize(path3) {
  assertPath(path3);
  const len = path3.length;
  if (len === 0) return ".";
  let rootEnd = 0;
  let device;
  let isAbsolute4 = false;
  const code = path3.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      isAbsolute4 = true;
      if (isPathSeparator(path3.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path3.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          const firstPart = path3.slice(last, j);
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path3.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path3.charCodeAt(j))) break;
            }
            if (j === len) {
              return `\\\\${firstPart}\\${path3.slice(last)}\\`;
            } else if (j !== last) {
              device = `\\\\${firstPart}\\${path3.slice(last, j)}`;
              rootEnd = j;
            }
          }
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path3.charCodeAt(1) === CHAR_COLON) {
        device = path3.slice(0, 2);
        rootEnd = 2;
        if (len > 2) {
          if (isPathSeparator(path3.charCodeAt(2))) {
            isAbsolute4 = true;
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
    tail = normalizeString(path3.slice(rootEnd), !isAbsolute4, "\\", isPathSeparator);
  } else {
    tail = "";
  }
  if (tail.length === 0 && !isAbsolute4) tail = ".";
  if (tail.length > 0 && isPathSeparator(path3.charCodeAt(len - 1))) {
    tail += "\\";
  }
  if (device === void 0) {
    if (isAbsolute4) {
      if (tail.length > 0) return `\\${tail}`;
      else return "\\";
    } else if (tail.length > 0) {
      return tail;
    } else {
      return "";
    }
  } else if (isAbsolute4) {
    if (tail.length > 0) return `${device}\\${tail}`;
    else return `${device}\\`;
  } else if (tail.length > 0) {
    return device + tail;
  } else {
    return device;
  }
}
function isAbsolute(path3) {
  assertPath(path3);
  const len = path3.length;
  if (len === 0) return false;
  const code = path3.charCodeAt(0);
  if (isPathSeparator(code)) {
    return true;
  } else if (isWindowsDeviceRoot(code)) {
    if (len > 2 && path3.charCodeAt(1) === CHAR_COLON) {
      if (isPathSeparator(path3.charCodeAt(2))) return true;
    }
  }
  return false;
}
function join2(...paths) {
  const pathsCount = paths.length;
  if (pathsCount === 0) return ".";
  let joined;
  let firstPart = null;
  for (let i = 0; i < pathsCount; ++i) {
    const path3 = paths[i];
    assertPath(path3);
    if (path3.length > 0) {
      if (joined === void 0) joined = firstPart = path3;
      else joined += `\\${path3}`;
    }
  }
  if (joined === void 0) return ".";
  let needsReplace = true;
  let slashCount = 0;
  assert(firstPart != null);
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
function relative(from, to) {
  assertPath(from);
  assertPath(to);
  if (from === to) return "";
  const fromOrig = resolve(from);
  const toOrig = resolve(to);
  if (fromOrig === toOrig) return "";
  from = fromOrig.toLowerCase();
  to = toOrig.toLowerCase();
  if (from === to) return "";
  let fromStart = 0;
  let fromEnd = from.length;
  for (; fromStart < fromEnd; ++fromStart) {
    if (from.charCodeAt(fromStart) !== CHAR_BACKWARD_SLASH) break;
  }
  for (; fromEnd - 1 > fromStart; --fromEnd) {
    if (from.charCodeAt(fromEnd - 1) !== CHAR_BACKWARD_SLASH) break;
  }
  const fromLen = fromEnd - fromStart;
  let toStart = 0;
  let toEnd = to.length;
  for (; toStart < toEnd; ++toStart) {
    if (to.charCodeAt(toStart) !== CHAR_BACKWARD_SLASH) break;
  }
  for (; toEnd - 1 > toStart; --toEnd) {
    if (to.charCodeAt(toEnd - 1) !== CHAR_BACKWARD_SLASH) break;
  }
  const toLen = toEnd - toStart;
  const length = fromLen < toLen ? fromLen : toLen;
  let lastCommonSep = -1;
  let i = 0;
  for (; i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === CHAR_BACKWARD_SLASH) {
          return toOrig.slice(toStart + i + 1);
        } else if (i === 2) {
          return toOrig.slice(toStart + i);
        }
      }
      if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === CHAR_BACKWARD_SLASH) {
          lastCommonSep = i;
        } else if (i === 2) {
          lastCommonSep = 3;
        }
      }
      break;
    }
    const fromCode = from.charCodeAt(fromStart + i);
    const toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode) break;
    else if (fromCode === CHAR_BACKWARD_SLASH) lastCommonSep = i;
  }
  if (i !== length && lastCommonSep === -1) {
    return toOrig;
  }
  let out = "";
  if (lastCommonSep === -1) lastCommonSep = 0;
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || from.charCodeAt(i) === CHAR_BACKWARD_SLASH) {
      if (out.length === 0) out += "..";
      else out += "\\..";
    }
  }
  if (out.length > 0) {
    return out + toOrig.slice(toStart + lastCommonSep, toEnd);
  } else {
    toStart += lastCommonSep;
    if (toOrig.charCodeAt(toStart) === CHAR_BACKWARD_SLASH) ++toStart;
    return toOrig.slice(toStart, toEnd);
  }
}
function toNamespacedPath(path3) {
  if (typeof path3 !== "string") return path3;
  if (path3.length === 0) return "";
  const resolvedPath = resolve(path3);
  if (resolvedPath.length >= 3) {
    if (resolvedPath.charCodeAt(0) === CHAR_BACKWARD_SLASH) {
      if (resolvedPath.charCodeAt(1) === CHAR_BACKWARD_SLASH) {
        const code = resolvedPath.charCodeAt(2);
        if (code !== CHAR_QUESTION_MARK && code !== CHAR_DOT) {
          return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
        }
      }
    } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
      if (resolvedPath.charCodeAt(1) === CHAR_COLON && resolvedPath.charCodeAt(2) === CHAR_BACKWARD_SLASH) {
        return `\\\\?\\${resolvedPath}`;
      }
    }
  }
  return path3;
}
function dirname2(path3) {
  assertPath(path3);
  const len = path3.length;
  if (len === 0) return ".";
  let rootEnd = -1;
  let end = -1;
  let matchedSlash = true;
  let offset = 0;
  const code = path3.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      rootEnd = offset = 1;
      if (isPathSeparator(path3.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path3.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path3.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path3.charCodeAt(j))) break;
            }
            if (j === len) {
              return path3;
            }
            if (j !== last) {
              rootEnd = offset = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path3.charCodeAt(1) === CHAR_COLON) {
        rootEnd = offset = 2;
        if (len > 2) {
          if (isPathSeparator(path3.charCodeAt(2))) rootEnd = offset = 3;
        }
      }
    }
  } else if (isPathSeparator(code)) {
    return path3;
  }
  for (let i = len - 1; i >= offset; --i) {
    if (isPathSeparator(path3.charCodeAt(i))) {
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
  return stripTrailingSeparators(path3.slice(0, end), isPosixPathSeparator);
}
function basename(path3, suffix = "") {
  assertPath(path3);
  if (path3.length === 0) return path3;
  if (typeof suffix !== "string") {
    throw new TypeError(`Suffix must be a string. Received ${JSON.stringify(suffix)}`);
  }
  let start = 0;
  if (path3.length >= 2) {
    const drive = path3.charCodeAt(0);
    if (isWindowsDeviceRoot(drive)) {
      if (path3.charCodeAt(1) === CHAR_COLON) start = 2;
    }
  }
  const lastSegment = lastPathSegment(path3, isPathSeparator, start);
  const strippedSegment = stripTrailingSeparators(lastSegment, isPathSeparator);
  return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function extname(path3) {
  assertPath(path3);
  let start = 0;
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let preDotState = 0;
  if (path3.length >= 2 && path3.charCodeAt(1) === CHAR_COLON && isWindowsDeviceRoot(path3.charCodeAt(0))) {
    start = startPart = 2;
  }
  for (let i = path3.length - 1; i >= start; --i) {
    const code = path3.charCodeAt(i);
    if (isPathSeparator(code)) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }
  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return "";
  }
  return path3.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object") {
    throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
  }
  return _format("\\", pathObject);
}
function parse(path3) {
  assertPath(path3);
  const ret = {
    root: "",
    dir: "",
    base: "",
    ext: "",
    name: ""
  };
  const len = path3.length;
  if (len === 0) return ret;
  let rootEnd = 0;
  let code = path3.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      rootEnd = 1;
      if (isPathSeparator(path3.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path3.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path3.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path3.charCodeAt(j))) break;
            }
            if (j === len) {
              rootEnd = j;
            } else if (j !== last) {
              rootEnd = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path3.charCodeAt(1) === CHAR_COLON) {
        rootEnd = 2;
        if (len > 2) {
          if (isPathSeparator(path3.charCodeAt(2))) {
            if (len === 3) {
              ret.root = ret.dir = path3;
              ret.base = "\\";
              return ret;
            }
            rootEnd = 3;
          }
        } else {
          ret.root = ret.dir = path3;
          return ret;
        }
      }
    }
  } else if (isPathSeparator(code)) {
    ret.root = ret.dir = path3;
    ret.base = "\\";
    return ret;
  }
  if (rootEnd > 0) ret.root = path3.slice(0, rootEnd);
  let startDot = -1;
  let startPart = rootEnd;
  let end = -1;
  let matchedSlash = true;
  let i = path3.length - 1;
  let preDotState = 0;
  for (; i >= rootEnd; --i) {
    code = path3.charCodeAt(i);
    if (isPathSeparator(code)) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }
  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1) {
      ret.base = ret.name = path3.slice(startPart, end);
    }
  } else {
    ret.name = path3.slice(startPart, startDot);
    ret.base = path3.slice(startPart, end);
    ret.ext = path3.slice(startDot, end);
  }
  ret.base = ret.base || "\\";
  if (startPart > 0 && startPart !== rootEnd) {
    ret.dir = path3.slice(0, startPart - 1);
  } else ret.dir = ret.root;
  return ret;
}
function fromFileUrl(url) {
  url = url instanceof URL ? url : new URL(url);
  if (url.protocol != "file:") {
    throw new TypeError("Must be a file URL.");
  }
  let path3 = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
  if (url.hostname != "") {
    path3 = `\\\\${url.hostname}${path3}`;
  }
  return path3;
}
function toFileUrl(path3) {
  if (!isAbsolute(path3)) {
    throw new TypeError("Must be an absolute path.");
  }
  const [, hostname, pathname] = path3.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
  const url = new URL("file:///");
  url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
  if (hostname != null && hostname != "localhost") {
    url.hostname = hostname;
    if (!url.hostname) {
      throw new TypeError("Invalid hostname.");
    }
  }
  return url;
}

// deno:https://deno.land/std@0.190.0/path/posix.ts
var posix_exports = {};
__export(posix_exports, {
  basename: () => basename2,
  delimiter: () => delimiter2,
  dirname: () => dirname3,
  extname: () => extname2,
  format: () => format2,
  fromFileUrl: () => fromFileUrl2,
  isAbsolute: () => isAbsolute2,
  join: () => join3,
  normalize: () => normalize2,
  parse: () => parse2,
  relative: () => relative2,
  resolve: () => resolve2,
  sep: () => sep2,
  toFileUrl: () => toFileUrl2,
  toNamespacedPath: () => toNamespacedPath2
});
var sep2 = "/";
var delimiter2 = ":";
function resolve2(...pathSegments) {
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    let path3;
    if (i >= 0) path3 = pathSegments[i];
    else {
      const { Deno: Deno2 } = globalThis;
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a CWD.");
      }
      path3 = Deno2.cwd();
    }
    assertPath(path3);
    if (path3.length === 0) {
      continue;
    }
    resolvedPath = `${path3}/${resolvedPath}`;
    resolvedAbsolute = isPosixPathSeparator(path3.charCodeAt(0));
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
  if (resolvedAbsolute) {
    if (resolvedPath.length > 0) return `/${resolvedPath}`;
    else return "/";
  } else if (resolvedPath.length > 0) return resolvedPath;
  else return ".";
}
function normalize2(path3) {
  assertPath(path3);
  if (path3.length === 0) return ".";
  const isAbsolute4 = isPosixPathSeparator(path3.charCodeAt(0));
  const trailingSeparator = isPosixPathSeparator(path3.charCodeAt(path3.length - 1));
  path3 = normalizeString(path3, !isAbsolute4, "/", isPosixPathSeparator);
  if (path3.length === 0 && !isAbsolute4) path3 = ".";
  if (path3.length > 0 && trailingSeparator) path3 += "/";
  if (isAbsolute4) return `/${path3}`;
  return path3;
}
function isAbsolute2(path3) {
  assertPath(path3);
  return path3.length > 0 && isPosixPathSeparator(path3.charCodeAt(0));
}
function join3(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  for (let i = 0, len = paths.length; i < len; ++i) {
    const path3 = paths[i];
    assertPath(path3);
    if (path3.length > 0) {
      if (!joined) joined = path3;
      else joined += `/${path3}`;
    }
  }
  if (!joined) return ".";
  return normalize2(joined);
}
function relative2(from, to) {
  assertPath(from);
  assertPath(to);
  if (from === to) return "";
  from = resolve2(from);
  to = resolve2(to);
  if (from === to) return "";
  let fromStart = 1;
  const fromEnd = from.length;
  for (; fromStart < fromEnd; ++fromStart) {
    if (!isPosixPathSeparator(from.charCodeAt(fromStart))) break;
  }
  const fromLen = fromEnd - fromStart;
  let toStart = 1;
  const toEnd = to.length;
  for (; toStart < toEnd; ++toStart) {
    if (!isPosixPathSeparator(to.charCodeAt(toStart))) break;
  }
  const toLen = toEnd - toStart;
  const length = fromLen < toLen ? fromLen : toLen;
  let lastCommonSep = -1;
  let i = 0;
  for (; i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (isPosixPathSeparator(to.charCodeAt(toStart + i))) {
          return to.slice(toStart + i + 1);
        } else if (i === 0) {
          return to.slice(toStart + i);
        }
      } else if (fromLen > length) {
        if (isPosixPathSeparator(from.charCodeAt(fromStart + i))) {
          lastCommonSep = i;
        } else if (i === 0) {
          lastCommonSep = 0;
        }
      }
      break;
    }
    const fromCode = from.charCodeAt(fromStart + i);
    const toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode) break;
    else if (isPosixPathSeparator(fromCode)) lastCommonSep = i;
  }
  let out = "";
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || isPosixPathSeparator(from.charCodeAt(i))) {
      if (out.length === 0) out += "..";
      else out += "/..";
    }
  }
  if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
  else {
    toStart += lastCommonSep;
    if (isPosixPathSeparator(to.charCodeAt(toStart))) ++toStart;
    return to.slice(toStart);
  }
}
function toNamespacedPath2(path3) {
  return path3;
}
function dirname3(path3) {
  if (path3.length === 0) return ".";
  let end = -1;
  let matchedNonSeparator = false;
  for (let i = path3.length - 1; i >= 1; --i) {
    if (isPosixPathSeparator(path3.charCodeAt(i))) {
      if (matchedNonSeparator) {
        end = i;
        break;
      }
    } else {
      matchedNonSeparator = true;
    }
  }
  if (end === -1) {
    return isPosixPathSeparator(path3.charCodeAt(0)) ? "/" : ".";
  }
  return stripTrailingSeparators(path3.slice(0, end), isPosixPathSeparator);
}
function basename2(path3, suffix = "") {
  assertPath(path3);
  if (path3.length === 0) return path3;
  if (typeof suffix !== "string") {
    throw new TypeError(`Suffix must be a string. Received ${JSON.stringify(suffix)}`);
  }
  const lastSegment = lastPathSegment(path3, isPosixPathSeparator);
  const strippedSegment = stripTrailingSeparators(lastSegment, isPosixPathSeparator);
  return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function extname2(path3) {
  assertPath(path3);
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let preDotState = 0;
  for (let i = path3.length - 1; i >= 0; --i) {
    const code = path3.charCodeAt(i);
    if (isPosixPathSeparator(code)) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }
  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return "";
  }
  return path3.slice(startDot, end);
}
function format2(pathObject) {
  if (pathObject === null || typeof pathObject !== "object") {
    throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
  }
  return _format("/", pathObject);
}
function parse2(path3) {
  assertPath(path3);
  const ret = {
    root: "",
    dir: "",
    base: "",
    ext: "",
    name: ""
  };
  if (path3.length === 0) return ret;
  const isAbsolute4 = isPosixPathSeparator(path3.charCodeAt(0));
  let start;
  if (isAbsolute4) {
    ret.root = "/";
    start = 1;
  } else {
    start = 0;
  }
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  let i = path3.length - 1;
  let preDotState = 0;
  for (; i >= start; --i) {
    const code = path3.charCodeAt(i);
    if (isPosixPathSeparator(code)) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }
  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1) {
      if (startPart === 0 && isAbsolute4) {
        ret.base = ret.name = path3.slice(1, end);
      } else {
        ret.base = ret.name = path3.slice(startPart, end);
      }
    }
    ret.base = ret.base || "/";
  } else {
    if (startPart === 0 && isAbsolute4) {
      ret.name = path3.slice(1, startDot);
      ret.base = path3.slice(1, end);
    } else {
      ret.name = path3.slice(startPart, startDot);
      ret.base = path3.slice(startPart, end);
    }
    ret.ext = path3.slice(startDot, end);
  }
  if (startPart > 0) {
    ret.dir = stripTrailingSeparators(path3.slice(0, startPart - 1), isPosixPathSeparator);
  } else if (isAbsolute4) ret.dir = "/";
  return ret;
}
function fromFileUrl2(url) {
  url = url instanceof URL ? url : new URL(url);
  if (url.protocol != "file:") {
    throw new TypeError("Must be a file URL.");
  }
  return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function toFileUrl2(path3) {
  if (!isAbsolute2(path3)) {
    throw new TypeError("Must be an absolute path.");
  }
  const url = new URL("file:///");
  url.pathname = encodeWhitespace(path3.replace(/%/g, "%25").replace(/\\/g, "%5C"));
  return url;
}

// deno:https://deno.land/std@0.190.0/path/glob.ts
var path = isWindows ? win32_exports : posix_exports;
var { join: join4, normalize: normalize3 } = path;

// deno:https://deno.land/std@0.190.0/path/mod.ts
var path2 = isWindows ? win32_exports : posix_exports;
var { basename: basename3, delimiter: delimiter3, dirname: dirname4, extname: extname3, format: format3, fromFileUrl: fromFileUrl3, isAbsolute: isAbsolute3, join: join5, normalize: normalize4, parse: parse3, relative: relative3, resolve: resolve3, toFileUrl: toFileUrl3, toNamespacedPath: toNamespacedPath3 } = path2;
var sep3 = path2.sep;

// deno:https://deno.land/std@0.190.0/fs/_util.ts
async function createWalkEntry(path3) {
  path3 = toPathString(path3);
  path3 = normalize4(path3);
  const name = basename3(path3);
  const info = await Deno.stat(path3);
  return {
    path: path3,
    name,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink
  };
}
function toPathString(pathUrl) {
  return pathUrl instanceof URL ? fromFileUrl3(pathUrl) : pathUrl;
}

// deno:https://deno.land/std@0.190.0/fs/walk.ts
var WalkError = class extends Error {
  cause;
  name = "WalkError";
  path;
  constructor(cause, path3) {
    super(`${cause instanceof Error ? cause.message : cause} for path "${path3}"`);
    this.path = path3;
    this.cause = cause;
  }
};
function include(path3, exts, match, skip) {
  if (exts && !exts.some((ext) => path3.endsWith(ext))) {
    return false;
  }
  if (match && !match.some((pattern) => !!path3.match(pattern))) {
    return false;
  }
  if (skip && skip.some((pattern) => !!path3.match(pattern))) {
    return false;
  }
  return true;
}
function wrapErrorWithPath(err, root) {
  if (err instanceof WalkError) return err;
  return new WalkError(err, root);
}
async function* walk(root, { maxDepth = Infinity, includeFiles = true, includeDirs = true, followSymlinks = false, exts = void 0, match = void 0, skip = void 0 } = {}) {
  if (maxDepth < 0) {
    return;
  }
  root = toPathString(root);
  if (includeDirs && include(root, exts, match, skip)) {
    yield await createWalkEntry(root);
  }
  if (maxDepth < 1 || !include(root, void 0, void 0, skip)) {
    return;
  }
  try {
    for await (const entry of Deno.readDir(root)) {
      assert(entry.name != null);
      let path3 = join5(root, entry.name);
      let { isSymlink, isDirectory } = entry;
      if (isSymlink) {
        if (!followSymlinks) continue;
        path3 = await Deno.realPath(path3);
        ({ isSymlink, isDirectory } = await Deno.lstat(path3));
      }
      if (isSymlink || isDirectory) {
        yield* walk(path3, {
          maxDepth: maxDepth - 1,
          includeFiles,
          includeDirs,
          followSymlinks,
          exts,
          match,
          skip
        });
      } else if (includeFiles && include(path3, exts, match, skip)) {
        yield {
          path: path3,
          ...entry
        };
      }
    }
  } catch (err) {
    throw wrapErrorWithPath(err, normalize4(root));
  }
}

// enforce-coverage/mod.ts
async function checkTestCoverage(root = ".") {
  const issues = [];
  try {
    for await (const entry of walk(root, {
      exts: [
        "ts"
      ],
      match: [
        /\.test\.ts$/
      ],
      skip: [
        /node_modules/,
        /\.git/
      ]
    })) {
      if (entry.isFile) {
        try {
          const content = await Deno.readTextFile(entry.path);
          const lines = content.split("\n");
          let meaningfulLines = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("//")) {
              meaningfulLines++;
            }
          }
          if (meaningfulLines <= 10) {
            issues.push({
              issue: "test coverage too low",
              location: entry.path
            });
          }
        } catch (err) {
          console.error(`Could not read ${entry.path}: ${err}`);
        }
      }
    }
  } catch (err) {
    issues.push({
      issue: `Failed to check test coverage: ${err}`,
      location: root
    });
  }
  return {
    name: "test coverage",
    issues,
    message: ""
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
  for (const path3 of args) {
    const checkErrs$ = runDenoCheck(path3);
    const importErrs$ = findInvalidRelativeImports(path3);
    const lintErrs$ = runDenoLint(path3);
    const testErrs$ = runDenoTest(path3);
    const coverageErrs$ = checkTestCoverage(path3);
    const errs2 = await Promise.all([
      testErrs$,
      checkErrs$,
      importErrs$,
      lintErrs$,
      coverageErrs$
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
    const relevantPaths = event.paths.filter((path3) => {
      if (path3.includes("node_modules") || path3.includes(".git")) {
        return false;
      }
      if (path3.endsWith(".ts")) {
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
