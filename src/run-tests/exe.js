#!/usr/bin/env deno run -A
// enforce-dirs/mod.ts
var structure = {
  src: {
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
            "@nopInData"
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
    }
  },
  deno: "json",
  design: "ts",
  tests: {
    examples: {
      "...": "#basic",
      artifacts: [
        "json",
        "mp3",
        "#folder"
      ]
    },
    e2e: {
      surface: {
        "...": [
          "e2e.ts"
        ]
      },
      artifacts: {
        // explicit only — if you want a dir pattern, define a macro and use "#assetsLike" etc.
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
        // explicit only — if you want a dir pattern, define a macro and use "#assetsLike" etc.
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
  }
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
  }
};
var rules = {
  noRoot: (p) => {
    if (!p.startsWith("_root")) return null;
    return `_root is depricated, use bootstrap.ts instead`;
  },
  nopInData: async (p) => {
    const testFile = pathJoin(p, "unit.test.ts");
    const nopTestFile = pathJoin(p, "unit.nop.test.ts");
    try {
      const hasUnitTest = (await Deno.stat(testFile)).isFile;
      try {
        const hasNopTest = (await Deno.stat(nopTestFile)).isFile;
      } catch {
        if (hasUnitTest) {
          return `Data layer tests should be named 'unit.nop.test.ts' to indicate they are no-ops.`;
        }
      }
    } catch {
    }
    return null;
  }
};
function filterSpec(obj) {
  if (Array.isArray(obj)) {
    return obj.map(filterSpec).filter((v) => v !== void 0);
  } else if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const filtered = filterSpec(v);
      if (filtered !== void 0) {
        out[k] = filtered;
      }
    }
    return out;
  } else if (typeof obj === "string") {
    return obj.startsWith("@") ? void 0 : obj;
  }
  return obj;
}
async function enforceStructure(root, spec = structure) {
  const issues = [];
  await validateDirAgainstSpec(root, "", spec, issues);
  const stringSpec = JSON.stringify(filterSpec(spec), null, 2);
  const knownMacroList = `

${JSON.stringify(filterSpec(macros), null, 2)}

`;
  const knownRuleList = JSON.stringify(Object.entries(rules).reduce((acc, [k, v]) => {
    acc[k] = v.toString();
    return acc;
  }, {}), null, 2);
  const help = `

Spec keys: literal names or '...' (wildcard: 0,1,many)

Atoms:
- "js" (string)                 \u2192 exact file extension
- "#macro" (string '#' prefix)  \u2192 directory must match macro shape
- ["js","json","#m","@r"]       \u2192 one-of (file with one ext OR dir matching macro), then apply rules
- "@rule"                       \u2192 apply rule to matched path

- Expected top-level structure:
${stringSpec}

- Known macros: ${knownMacroList}
- Known rules: 
${knownRuleList}
`;
  return {
    name: "enforce-structure",
    issues,
    message: ""
  };
}
async function validateDirAgainstSpec(root, rel, spec, issues) {
  if (!isObject(spec)) {
    issues.push({
      issue: `Spec at "${rel || "."}" must be an object describing a directory.`,
      location: pathJoin(root, rel || ".")
    });
    return;
  }
  const abs = pathJoin(root, rel || ".");
  const snapshot = await readDirSnapshot(abs, issues);
  if (!snapshot) return;
  const obj = spec;
  const hasWildcard = Object.prototype.hasOwnProperty.call(obj, "...");
  const wildcardSpec = obj["..."];
  const explicitKeys = Object.keys(obj).filter((k) => k !== "...");
  for (const key of explicitKeys) {
    const node = obj[key];
    await enforceExplicitKey(root, rel, key, node, snapshot, issues);
  }
  const consumedFiles = /* @__PURE__ */ new Set();
  const consumedDirs = /* @__PURE__ */ new Set();
  for (const key of explicitKeys) {
    const node = obj[key];
    if (isFileSpec(node)) {
      for (const fname of filesThatMatchExplicitFileSpec(key, node, snapshot)) consumedFiles.add(fname);
    } else if (isArray(node)) {
      const hasFileExts = node.some((x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"));
      const hasMacros = node.some((x) => isString(x) && x.startsWith("#"));
      if (hasFileExts) {
        for (const fname of filesThatMatchExplicitFileArray(key, node, snapshot)) consumedFiles.add(fname);
      }
      if (hasMacros || snapshot.dirs.has(key)) {
        consumedDirs.add(key);
      }
    } else {
      consumedDirs.add(key);
    }
  }
  for (const file of snapshot.files) {
    if (consumedFiles.has(file)) continue;
    if (!hasWildcard) {
      issues.push({
        issue: `Unexpected file: ${file}`,
        location: pathJoin(root, rel, file)
      });
    } else {
      await validateWildcardItem(root, rel, file, false, wildcardSpec, issues);
    }
  }
  for (const dir of snapshot.dirs) {
    if (consumedDirs.has(dir)) continue;
    if (!hasWildcard) {
      issues.push({
        issue: `Unexpected directory: ${dir}`,
        location: pathJoin(root, rel, dir)
      });
    } else {
      await validateWildcardItem(root, rel, dir, true, wildcardSpec, issues);
    }
  }
}
async function enforceExplicitKey(root, rel, key, spec, snapshot, issues) {
  const here = pathJoin(root, rel);
  const fileCandidate = (ext) => `${key}.${ext}`;
  if (isString(spec)) {
    const fname = fileCandidate(spec);
    const isFilePresent = snapshot.files.has(fname);
    const isDirPresent = snapshot.dirs.has(key);
    if (!isFilePresent) {
      issues.push({
        issue: `Missing required file "${fname}".`,
        location: pathJoin(here, fname)
      });
    }
    if (isDirPresent) {
      issues.push({
        issue: `Expected file "${fname}" but found directory "${key}".`,
        location: pathJoin(here, key)
      });
    }
    return;
  }
  if (isArray(spec)) {
    const exts = /* @__PURE__ */ new Set();
    const macroTags = /* @__PURE__ */ new Set();
    const ruleTags = [];
    for (const x of spec) {
      if (isString(x)) {
        if (x.startsWith("#")) macroTags.add(x);
        else if (x.startsWith("@")) ruleTags.push(x);
        else exts.add(x);
      } else {
        issues.push({
          issue: `Invalid array entry for "${key}". Allowed: "ext", "#macro", "@rule".`,
          location: pathJoin(here, key)
        });
        return;
      }
    }
    const dirPresent = snapshot.dirs.has(key);
    const matchingFiles = [
      ...exts
    ].map((e) => `${key}.${e}`).filter((f) => snapshot.files.has(f));
    const wantsDir = macroTags.size > 0;
    const wantsFile = exts.size > 0;
    if (wantsDir && wantsFile && matchingFiles.length > 0 && dirPresent) {
      issues.push({
        issue: `Ambiguous "${key}": both a matching file and a directory exist. Keep exactly one.`,
        location: pathJoin(here, key)
      });
      return;
    }
    if (wantsFile && !wantsDir) {
      if (matchingFiles.length === 0) {
        issues.push({
          issue: `Missing required file "${key}.[${[
            ...exts
          ].join("|")}]".`,
          location: pathJoin(here, `${key}.[${[
            ...exts
          ].join("|")}]`)
        });
        return;
      }
      if (dirPresent) {
        issues.push({
          issue: `Expected file "${key}.[${[
            ...exts
          ].join("|")}]" but found directory "${key}".`,
          location: pathJoin(here, key)
        });
        return;
      }
      for (const f of matchingFiles) {
        await applyRulesForPath(pathJoin(here, f), ruleTags, issues);
      }
      return;
    }
    if (!wantsFile && wantsDir) {
      if (!dirPresent) {
        issues.push({
          issue: `Missing required directory "${key}".`,
          location: pathJoin(here, key)
        });
        return;
      }
      const targetRel = pathJoin(rel, key);
      const attempts = [];
      for (const tag of macroTags) {
        const name = tagToName(tag);
        const macroSpec = macros[name];
        const tmp = [];
        if (!macroSpec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [
              {
                issue: `Unknown macro ${tag}`,
                location: pathJoin(root, targetRel)
              }
            ]
          });
          continue;
        }
        await validateDirAgainstSpec(root, targetRel, macroSpec, tmp);
        attempts.push({
          name: tag,
          ok: tmp.length === 0,
          details: tmp
        });
        if (tmp.length === 0) {
          await applyRulesForPath(pathJoin(root, targetRel), ruleTags, issues);
          return;
        }
      }
      if (attempts.length === 0) {
        issues.push({
          issue: `Directory "${key}" allowed only via macro shapes, but none specified.`,
          location: pathJoin(root, targetRel)
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${key}" does not conform to ${best.name}. Example issue: ${best.details[0]?.issue ?? "shape mismatch"}`,
          location: pathJoin(root, targetRel)
        });
      }
      return;
    }
    if (matchingFiles.length > 0) {
      for (const f of matchingFiles) {
        await applyRulesForPath(pathJoin(here, f), ruleTags, issues);
      }
      return;
    }
    if (dirPresent) {
      const targetRel = pathJoin(rel, key);
      const attempts = [];
      for (const tag of macroTags) {
        const name = tagToName(tag);
        const macroSpec = macros[name];
        const tmp = [];
        if (!macroSpec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [
              {
                issue: `Unknown macro ${tag}`,
                location: pathJoin(root, targetRel)
              }
            ]
          });
          continue;
        }
        await validateDirAgainstSpec(root, targetRel, macroSpec, tmp);
        attempts.push({
          name: tag,
          ok: tmp.length === 0,
          details: tmp
        });
        if (tmp.length === 0) {
          await applyRulesForPath(pathJoin(root, targetRel), ruleTags, issues);
          return;
        }
      }
      if (attempts.length === 0) {
        issues.push({
          issue: `Directory "${key}" present, but neither file extensions nor macro shapes were allowed.`,
          location: pathJoin(root, targetRel)
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${key}" does not conform to ${best.name}. Example issue: ${best.details[0]?.issue ?? "shape mismatch"}`,
          location: pathJoin(root, targetRel)
        });
      }
      return;
    }
    issues.push({
      issue: `Missing required "${key}" as either file ".${[
        ...exts
      ].join("|")}" or a directory matching macros.`,
      location: pathJoin(here, key)
    });
    return;
  }
  if (!snapshot.dirs.has(key)) {
    issues.push({
      issue: `Missing required directory "${key}"`,
      location: pathJoin(here, key)
    });
    return;
  }
  await validateDirAgainstSpec(root, pathJoin(rel, key), spec, issues);
}
async function validateWildcardItem(root, rel, name, isDir, wildcardSpec, issues) {
  const here = pathJoin(root, rel, name);
  if (isString(wildcardSpec)) {
    if (wildcardSpec.startsWith("#")) {
      if (!isDir) {
        issues.push({
          issue: `Unexpected file "${name}". Wildcard requires directories matching macro ${wildcardSpec}.`,
          location: here
        });
        return;
      }
      const macroName = tagToName(wildcardSpec);
      const macroSpec = macros[macroName];
      if (!macroSpec) {
        issues.push({
          issue: `Unknown macro ${wildcardSpec}`,
          location: here
        });
        return;
      }
      await validateDirAgainstSpec(root, pathJoin(rel, name), macroSpec, issues);
      return;
    }
    if (isDir) {
      issues.push({
        issue: `Unexpected directory "${name}". Wildcard here only allows files with ".${wildcardSpec}" extension.`,
        location: here
      });
      return;
    }
    const ext = fileExt(name);
    if (ext !== wildcardSpec) {
      issues.push({
        issue: `Invalid file "${name}". Expected extension ".${wildcardSpec}".`,
        location: here
      });
    }
    return;
  }
  if (isArray(wildcardSpec)) {
    const exts = /* @__PURE__ */ new Set();
    const macroTags = /* @__PURE__ */ new Set();
    const ruleTags = [];
    for (const x of wildcardSpec) {
      if (isString(x)) {
        if (x.startsWith("#")) macroTags.add(x);
        else if (x.startsWith("@")) ruleTags.push(x);
        else exts.add(x);
      } else {
        issues.push({
          issue: `Invalid wildcard entry. Allowed: "ext", "#macro", "@rule".`,
          location: here
        });
        return;
      }
    }
    if (isDir) {
      const attempts = [];
      for (const tag of macroTags) {
        const name2 = tagToName(tag);
        const spec = macros[name2];
        const tmp = [];
        if (!spec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [
              {
                issue: `Unknown macro ${tag}`,
                location: here
              }
            ]
          });
          continue;
        }
        await validateDirAgainstSpec(root, pathJoin(rel, name), spec, tmp);
        attempts.push({
          name: tag,
          ok: tmp.length === 0,
          details: tmp
        });
        if (tmp.length === 0) {
          await applyRulesForPath(here, ruleTags, issues);
          return;
        }
      }
      if (attempts.length === 0) {
        issues.push({
          issue: `Unexpected directory "${name}". Wildcard allows only files [${[
            ...exts
          ].join(", ")}] or macro-shaped directories.`,
          location: here
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${name}" does not conform to ${best.name}. Example issue: ${best.details[0]?.issue ?? "shape mismatch"}`,
          location: here
        });
      }
      return;
    }
    const ext = fileExt(name);
    if (!exts.has(ext)) {
      issues.push({
        issue: `Invalid file "${name}". Allowed extensions: [${[
          ...exts
        ].join(", ")}].`,
        location: here
      });
      return;
    }
    await applyRulesForPath(here, ruleTags, issues);
    return;
  }
  if (!isDir) {
    issues.push({
      issue: `Unexpected file "${name}". Wildcard requires directories matching the nested spec.`,
      location: here
    });
    return;
  }
  await validateDirAgainstSpec(root, pathJoin(rel, name), wildcardSpec, issues);
}
async function readDirSnapshot(absDir, issues) {
  try {
    const st = await Deno.stat(absDir);
    if (!st.isDirectory) {
      issues.push({
        issue: `Expected directory but found file`,
        location: absDir
      });
      return null;
    }
  } catch {
    issues.push({
      issue: `Missing directory`,
      location: absDir
    });
    return null;
  }
  const files = /* @__PURE__ */ new Set();
  const dirs = /* @__PURE__ */ new Set();
  try {
    for await (const entry of Deno.readDir(absDir)) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.isDirectory) dirs.add(entry.name);
      else if (entry.isFile) files.add(entry.name);
    }
  } catch (e) {
    issues.push({
      issue: `Failed to read directory: ${e instanceof Error ? e.message : String(e)}`,
      location: absDir
    });
    return null;
  }
  return {
    files,
    dirs
  };
}
function isString(v) {
  return typeof v === "string";
}
function isArray(v) {
  return Array.isArray(v);
}
function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
function isFileSpec(v) {
  return isString(v) && !v.startsWith("#") && !v.startsWith("@");
}
function fileExt(filename) {
  return filename.split(".").slice(1).join(".") || "";
}
function pathJoin(...parts) {
  return parts.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}
function tagToName(tag) {
  return tag.startsWith("#") || tag.startsWith("@") ? tag.slice(1) : tag;
}
function filesThatMatchExplicitFileSpec(key, spec, snapshot) {
  const fname = `${key}.${spec}`;
  return snapshot.files.has(fname) ? [
    fname
  ] : [];
}
function filesThatMatchExplicitFileArray(key, arr, snapshot) {
  const exts = arr.filter((x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"));
  return exts.map((e) => `${key}.${e}`).filter((f) => snapshot.files.has(f));
}
async function applyRulesForPath(targetPath, ruleTags, issues) {
  for (const tag of ruleTags) {
    const name = tagToName(tag);
    const fn = rules[name];
    if (!fn) {
      issues.push({
        issue: `Unknown rule ${tag}`,
        location: targetPath
      });
      continue;
    }
    try {
      const res = await fn(targetPath);
      if (res) issues.push({
        issue: res,
        location: targetPath
      });
    } catch (e) {
      issues.push({
        issue: `Rule ${tag} threw: ${e instanceof Error ? e.message : String(e)}`,
        location: targetPath
      });
    }
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
