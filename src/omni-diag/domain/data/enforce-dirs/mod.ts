#!/usr/bin/env -S deno run -A
import { Issue, IssueResponse, Spec, Rule } from "@/domain/data/types.ts";

// deno-lint-ignore-file no-explicit-any

/**
 * Spec grammar (explicit & standardized):
 * - Keys: literal names or "..." (wildcard: 0, 1, many)
 * - Values (atoms or arrays of atoms):
 *   - "js"           → required file with extension .js (for the given key)
 *   - "#macro"       → required directory matching the named macro's Spec
 *   - ["js","json","#m","@r"] → one-of:
 *        - file with one of listed extensions, OR
 *        - directory matching one of listed macros;
 *     then apply any "@rule" tags to the matched path (file or directory)
 *   - "@rule"        → apply registered rule to matched path (can be combined in arrays)
 *
 * No inline macros, no inline rules, no overrides.
 */

// ------------------- Main Project Spec -------------------

// Default structure for root-level projects
const structure: Spec = {
  src: ["#developed", "#undeveloped"],
  tests: ["#developedTests", "#undevelopedTests"],
  deno: "json",
  CONTRIBUTING: "md",
};

// Structure for when we're checking a developed module directly
const developedModuleStructure: Spec = {
  bootstrap: "ts",
  deno: "json",
  domain: {
    business: {
      "...": ["#polymorphic", "#basic"],
    },
    data: {
      "...": ["#polymorphic", "#basic", "@nopTests"],
    },
  },
  routes: {
    "...": {
      internals: {
        "...": "#basic",
      },
      entry: "ts",
    },
  },
  dto: {
    "...": "#basic",
  },
  mod: "ts",
};

// ------------------- Macros (basic & polymorphic included here) -------------------

type Macros = Record<string, Spec>;

const macros: Macros = {
  basic: {
    "surface?": {
      "...": "#basic",
    },
    mod: "ts",
    unit: ["test.ts", "nop.test.ts"],
  },
  polymorphic: {
    implementations: {
      "...": "#basic",
    },
    base: "ts",
    unit: "test.ts",
    mod: "ts",
  },
  folder: {
    "...": ["json", "mp3"],
  },
  developed: {
    bootstrap: ["ts"], // must be bootstrap.ts
    "...": {
      domain: {
        business: {
          "...": ["#polymorphic", "#basic"],
        },
        data: {
          "...": ["#polymorphic", "#basic", "@nopTests"],
        },
      },
      routes: {
        "...": {
          internals: {
            "...": "#basic",
          },
          entry: "ts",
        },
      },
      dto: {
        "...": "#basic",
      },
      mod: "ts",
    },
  },
  undeveloped: {
    bootstrap: ["ts"], // must be bootstrap.ts
    domain: {
      business: {
        "...": ["#polymorphic", "#basic"],
      },
      data: {
        "...": ["#polymorphic", "#basic", "@nopTests"],
      },
    },
    routes: {
      "...": {
        internals: {
          "...": "#basic",
        },
        entry: "ts",
      },
    },
    dto: {
      "...": "#basic",
    },
  },

  developedTests: {
    examples: {
      "...": ["#basic", "@nopTests"],
      artifacts: ["#folder"],
    },
    "e2e?": {
      surface: {
        "...": ["e2e.ts"],
      },
      artifacts: {
        // explicit only — if you want a dir pattern, define a macro and use "#assetsLike" etc.
        "...": ["json", "mp3", "#folder"],
      },
    },
    integration: {
      surface: {
        "...": ["integration.ts"],
      },
      artifacts: {
        // explicit only — if you want a dir pattern, define a macro and use "#assetsLike" etc.
        "...": ["json", "mp3", "#folder"],
      },
    },
    fixtures: {
      "...": ["json", "mp3", "#folder"],
    },
  },
  undevelopedTests: {
    examples: {
      "...": ["#basic", "@nopTests"],
      artifacts: ["#folder"],
    },
    "integration?": {
      surface: {
        "...": ["integration.ts"],
      },
      artifacts: {
        "...": ["json", "mp3", "#folder"],
      },
    },
  },
  tools: {
    "...": {
      bootstrap: "ts",
      mod: "ts",
      test: "ts",
      "...": "#basic",
    },
  },

  // Example extra macro you could use in specs:
  // assetsLike: { "...": ["json","mp3"] },
};

// ------------------- Rules (registry; referenced via "@rule") -------------------

type Rules = Record<string, Rule>;

const rules: Rules = {
  noRoot: (p) => {
    if (!p.startsWith("_root")) return null;
    return `_root is depricated, use bootstrap.ts instead`;
  },
  nopTests: async (p: string) => {
    // Check if directory contains unit.test.ts instead of unit.nop.test.ts
    const testFile = pathJoin(p, "unit.test.ts");
    const nopTestFile = pathJoin(p, "unit.nop.test.ts");

    try {
      const hasUnitTest = (await Deno.stat(testFile)).isFile;
      if (hasUnitTest) {
        return `tests here should be named 'unit.nop.test.ts' to indicate they are no-ops.`;
      }
    } catch {
      // unit.test.ts doesn't exist, which is fine
    }

    return null;
  },
};

// ------------------- Public API -------------------
function filterSpec(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(filterSpec).filter((v) => v !== undefined);
  } else if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const filtered = filterSpec(v);
      if (filtered !== undefined) {
        out[k] = filtered;
      }
    }
    return out;
  } else if (typeof obj === "string") {
    // Remove if starts with "@"
    return obj.startsWith("@") ? undefined : obj;
  }
  return obj;
}

/**
 * Enforce the exact structure described by `spec` against the directory `root`.
 * Returns a list of { issue, location }.
 */
export async function enforceStructure(
  root: string,
  spec?: Spec,
): Promise<IssueResponse> {
  // Auto-detect if we're checking a developed module directly
  if (!spec) {
    try {
      const hasBootstrap = await Deno.stat(pathJoin(root, "bootstrap.ts")).then(s => s.isFile).catch(() => false);
      const hasDomain = await Deno.stat(pathJoin(root, "domain")).then(s => s.isDirectory).catch(() => false);
      const hasSrc = await Deno.stat(pathJoin(root, "src")).then(s => s.isDirectory).catch(() => false);

      // If we have bootstrap.ts and domain/, we're likely a developed module
      if (hasBootstrap && hasDomain && !hasSrc) {
        spec = developedModuleStructure;
      } else {
        spec = structure;
      }
    } catch {
      spec = structure;
    }
  }

  const issues: Issue[] = [];
  await validateDirAgainstSpec(root, "", spec, issues);

  const stringSpec = JSON.stringify(filterSpec(spec), null, 2);
  const knownMacroList = `\n\n${JSON.stringify(filterSpec(macros), null, 2)}\n\n`;
  // Object.keys(macros)
  //   .sort()
  //   .map((k) => `#${k}`)
  //   .join(", ") || "(none)";
  const knownRuleList = JSON.stringify(
    Object.entries(rules).reduce(
      (acc, [k, v]) => {
        acc[k] = v.toString();
        return acc;
      },
      {} as Record<string, string>,
    ),
    null,
    2,
  );
  //   .sort()
  //   .map((k) => `@${k}`)
  //   .join(", ") || "(none)";

  const help =
    `\n\nSpec keys: literal names or '...' (wildcard: 0,1,many)\n\n` +
    `Atoms:\n` +
    `- "js" (string)                 → exact file extension\n` +
    `- "#macro" (string '#' prefix)  → directory must match macro shape\n` +
    `- ["js","json","#m","@r"]       → one-of (file with one ext OR dir matching macro), then apply rules\n` +
    `- "@rule"                       → apply rule to matched path\n\n` +
    `- Expected top-level structure:\n${stringSpec}\n\n` +
    `- Known macros: ${knownMacroList}\n` +
    `- Known rules: \n${knownRuleList}\n`;

  return {
    name: "enforce-structure",
    issues,
    message: "",
    // issues.length ? help : "",
  };
}

// ------------------- Core validation -------------------

async function validateDirAgainstSpec(
  root: string,
  rel: string,
  spec: Spec,
  issues: Issue[],
): Promise<void> {
  if (!isObject(spec)) {
    issues.push({
      issue: `Spec at "${rel || "."}" must be an object describing a directory.`,
      location: pathJoin(root, rel || "."),
    });
    return;
  }

  const abs = pathJoin(root, rel || ".");
  const snapshot = await readDirSnapshot(abs, issues);
  if (!snapshot) return;

  const obj = spec as Record<string, Spec>;
  const hasWildcard = Object.prototype.hasOwnProperty.call(obj, "...");
  const wildcardSpec = obj["..."];
  const explicitKeys = Object.keys(obj).filter((k) => k !== "...");

  // 1) Enforce explicit keys
  for (const key of explicitKeys) {
    const node = obj[key];
    await enforceExplicitKey(root, rel, key, node, snapshot, issues);
  }

  // 2) Strict extras policy
  const consumedFiles = new Set<string>();
  const consumedDirs = new Set<string>();

  for (const key of explicitKeys) {
    const node = obj[key];
    if (isFileSpec(node)) {
      for (const fname of filesThatMatchExplicitFileSpec(key, node, snapshot))
        consumedFiles.add(fname);
    } else if (isArray(node)) {
      // Check if array contains file extensions
      const hasFileExts = node.some(
        (x: any) => isString(x) && !x.startsWith("#") && !x.startsWith("@"),
      );
      const hasMacros = node.some((x: any) => isString(x) && x.startsWith("#"));

      if (hasFileExts) {
        for (const fname of filesThatMatchExplicitFileArray(
          key,
          node,
          snapshot,
        ))
          consumedFiles.add(fname);
      }
      if (hasMacros || snapshot.dirs.has(key)) {
        consumedDirs.add(key);
      }
    } else {
      consumedDirs.add(key);
    }
  }

  // Files
  for (const file of snapshot.files) {
    if (consumedFiles.has(file)) continue;
    if (!hasWildcard) {
      issues.push({
        issue: `Unexpected file: ${file}`,
        location: pathJoin(root, rel, file),
      });
    } else {
      await validateWildcardItem(root, rel, file, false, wildcardSpec, issues);
    }
  }

  // Dirs
  for (const dir of snapshot.dirs) {
    if (consumedDirs.has(dir)) continue;
    if (!hasWildcard) {
      issues.push({
        issue: `Unexpected directory: ${dir}`,
        location: pathJoin(root, rel, dir),
      });
    } else {
      await validateWildcardItem(root, rel, dir, true, wildcardSpec, issues);
    }
  }
}

async function enforceExplicitKey(
  root: string,
  rel: string,
  key: string,
  spec: Spec,
  snapshot: DirSnapshot,
  issues: Issue[],
) {
  const here = pathJoin(root, rel);
  const fileCandidate = (ext: string) => `${key}.${ext}`;

  if (isString(spec)) {
    // Exact file name with given extension
    const fname = fileCandidate(spec);
    const isFilePresent = snapshot.files.has(fname);
    const isDirPresent = snapshot.dirs.has(key);
    if (!isFilePresent) {
      issues.push({
        issue: `Missing required file "${fname}".`,
        location: pathJoin(here, fname),
      });
    }
    if (isDirPresent) {
      issues.push({
        issue: `Expected file "${fname}" but found directory "${key}".`,
        location: pathJoin(here, key),
      });
    }
    return;
  }

  if (isArray(spec)) {
    // Parse: extensions, macro tags, rule tags
    const exts = new Set<string>();
    const macroTags = new Set<string>();
    const ruleTags: string[] = [];

    for (const x of spec) {
      if (isString(x)) {
        if (x.startsWith("#")) macroTags.add(x);
        else if (x.startsWith("@")) ruleTags.push(x);
        else exts.add(x); // extension
      } else {
        issues.push({
          issue: `Invalid array entry for "${key}". Allowed: "ext", "#macro", "@rule".`,
          location: pathJoin(here, key),
        });
        return;
      }
    }

    const dirPresent = snapshot.dirs.has(key);
    const matchingFiles = [...exts]
      .map((e) => `${key}.${e}`)
      .filter((f) => snapshot.files.has(f));

    const wantsDir = macroTags.size > 0;
    const wantsFile = exts.size > 0;

    // Exclusive choice guard
    if (wantsDir && wantsFile && matchingFiles.length > 0 && dirPresent) {
      issues.push({
        issue: `Ambiguous "${key}": both a matching file and a directory exist. Keep exactly one.`,
        location: pathJoin(here, key),
      });
      return;
    }

    // Files-only
    if (wantsFile && !wantsDir) {
      if (matchingFiles.length === 0) {
        issues.push({
          issue: `Missing required file "${key}.[${[...exts].join("|")}]".`,
          location: pathJoin(here, `${key}.[${[...exts].join("|")}]`),
        });
        return;
      }
      if (dirPresent) {
        issues.push({
          issue: `Expected file "${key}.[${[...exts].join("|")}]" but found directory "${key}".`,
          location: pathJoin(here, key),
        });
        return;
      }
      // Apply rules to matched files
      for (const f of matchingFiles) {
        await applyRulesForPath(pathJoin(here, f), ruleTags, issues);
      }
      return;
    }

    // Dir-only
    if (!wantsFile && wantsDir) {
      if (!dirPresent) {
        issues.push({
          issue: `Missing required directory "${key}".`,
          location: pathJoin(here, key),
        });
        return;
      }
      const targetRel = pathJoin(rel, key);
      const attempts: Array<{ name: string; ok: boolean; details: Issue[] }> =
        [];

      // Try each macro
      for (const tag of macroTags) {
        const name = tagToName(tag);
        const macroSpec = macros[name];
        const tmp: Issue[] = [];
        if (!macroSpec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [
              {
                issue: `Unknown macro ${tag}`,
                location: pathJoin(root, targetRel),
              },
            ],
          });
          continue;
        }
        await validateDirAgainstSpec(root, targetRel, macroSpec, tmp);
        attempts.push({ name: tag, ok: tmp.length === 0, details: tmp });
        if (tmp.length === 0) {
          await applyRulesForPath(pathJoin(root, targetRel), ruleTags, issues);
          return;
        }
      }

      // none matched
      if (attempts.length === 0) {
        issues.push({
          issue: `Directory "${key}" allowed only via macro shapes, but none specified.`,
          location: pathJoin(root, targetRel),
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${key}" does not conform to ${best.name}. Example issue: ${
            best.details[0]?.issue ?? "shape mismatch"
          }`,
          location: pathJoin(root, targetRel),
        });
      }
      return;
    }

    // Either file or dir acceptable
    if (matchingFiles.length > 0) {
      for (const f of matchingFiles) {
        await applyRulesForPath(pathJoin(here, f), ruleTags, issues);
      }
      return;
    }
    if (dirPresent) {
      const targetRel = pathJoin(rel, key);
      const attempts: Array<{ name: string; ok: boolean; details: Issue[] }> =
        [];
      for (const tag of macroTags) {
        const name = tagToName(tag);
        const macroSpec = macros[name];
        const tmp: Issue[] = [];
        if (!macroSpec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [
              {
                issue: `Unknown macro ${tag}`,
                location: pathJoin(root, targetRel),
              },
            ],
          });
          continue;
        }
        await validateDirAgainstSpec(root, targetRel, macroSpec, tmp);
        attempts.push({ name: tag, ok: tmp.length === 0, details: tmp });
        if (tmp.length === 0) {
          await applyRulesForPath(pathJoin(root, targetRel), ruleTags, issues);
          return;
        }
      }
      if (attempts.length === 0) {
        issues.push({
          issue: `Directory "${key}" present, but neither file extensions nor macro shapes were allowed.`,
          location: pathJoin(root, targetRel),
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${key}" does not conform to ${best.name}. Example issue: ${
            best.details[0]?.issue ?? "shape mismatch"
          }`,
          location: pathJoin(root, targetRel),
        });
      }
      return;
    }

    // neither exists
    issues.push({
      issue: `Missing required "${key}" as either file ".${[...exts].join("|")}" or a directory matching macros.`,
      location: pathJoin(here, key),
    });
    return;
  }

  // Object → required directory with nested spec
  if (!snapshot.dirs.has(key)) {
    issues.push({
      issue: `Missing required directory "${key}"`,
      location: pathJoin(here, key),
    });
    return;
  }
  await validateDirAgainstSpec(root, pathJoin(rel, key), spec, issues);
}

async function validateWildcardItem(
  root: string,
  rel: string,
  name: string,
  isDir: boolean,
  wildcardSpec: Spec,
  issues: Issue[],
) {
  const here = pathJoin(root, rel, name);

  // wildcard as string
  if (isString(wildcardSpec)) {
    // Check if it's a macro reference
    if (wildcardSpec.startsWith("#")) {
      if (!isDir) {
        issues.push({
          issue: `Unexpected file "${name}". Wildcard requires directories matching macro ${wildcardSpec}.`,
          location: here,
        });
        return;
      }
      const macroName = tagToName(wildcardSpec);
      const macroSpec = macros[macroName];
      if (!macroSpec) {
        issues.push({
          issue: `Unknown macro ${wildcardSpec}`,
          location: here,
        });
        return;
      }
      await validateDirAgainstSpec(
        root,
        pathJoin(rel, name),
        macroSpec,
        issues,
      );
      return;
    }

    // Otherwise it's a file extension
    if (isDir) {
      issues.push({
        issue: `Unexpected directory "${name}". Wildcard here only allows files with ".${wildcardSpec}" extension.`,
        location: here,
      });
      return;
    }
    const ext = fileExt(name);
    if (ext !== wildcardSpec) {
      issues.push({
        issue: `Invalid file "${name}". Expected extension ".${wildcardSpec}".`,
        location: here,
      });
    }
    return;
  }

  // wildcard as array → one-of (exts or macros), plus optional rules
  if (isArray(wildcardSpec)) {
    const exts = new Set<string>();
    const macroTags = new Set<string>();
    const ruleTags: string[] = [];

    for (const x of wildcardSpec) {
      if (isString(x)) {
        if (x.startsWith("#")) macroTags.add(x);
        else if (x.startsWith("@")) ruleTags.push(x);
        else exts.add(x);
      } else {
        issues.push({
          issue: `Invalid wildcard entry. Allowed: "ext", "#macro", "@rule".`,
          location: here,
        });
        return;
      }
    }

    if (isDir) {
      const attempts: Array<{ name: string; ok: boolean; details: Issue[] }> =
        [];
      for (const tag of macroTags) {
        const name2 = tagToName(tag);
        const spec = macros[name2];
        const tmp: Issue[] = [];
        if (!spec) {
          attempts.push({
            name: tag,
            ok: false,
            details: [{ issue: `Unknown macro ${tag}`, location: here }],
          });
          continue;
        }
        await validateDirAgainstSpec(root, pathJoin(rel, name), spec, tmp);
        attempts.push({ name: tag, ok: tmp.length === 0, details: tmp });
        if (tmp.length === 0) {
          await applyRulesForPath(here, ruleTags, issues);
          return;
        }
      }

      if (attempts.length === 0) {
        issues.push({
          issue: `Unexpected directory "${name}". Wildcard allows only files [${[...exts].join(", ")}] or macro-shaped directories.`,
          location: here,
        });
      } else {
        attempts.sort((a, b) => a.details.length - b.details.length);
        const best = attempts[0];
        issues.push({
          issue: `Directory "${name}" does not conform to ${best.name}. Example issue: ${
            best.details[0]?.issue ?? "shape mismatch"
          }`,
          location: here,
        });
      }
      return;
    }

    // File case
    const ext = fileExt(name);
    if (!exts.has(ext)) {
      issues.push({
        issue: `Invalid file "${name}". Allowed extensions: [${[...exts].join(", ")}].`,
        location: here,
      });
      return;
    }
    await applyRulesForPath(here, ruleTags, issues);
    return;
  }

  // wildcard as object → arbitrary directory names that must match nested spec exactly
  if (!isDir) {
    issues.push({
      issue: `Unexpected file "${name}". Wildcard requires directories matching the nested spec.`,
      location: here,
    });
    return;
  }
  await validateDirAgainstSpec(root, pathJoin(rel, name), wildcardSpec, issues);
}

// ------------------- FS helpers -------------------

type DirSnapshot = { files: Set<string>; dirs: Set<string> };

async function readDirSnapshot(
  absDir: string,
  issues: Issue[],
): Promise<DirSnapshot | null> {
  try {
    const st = await Deno.stat(absDir);
    if (!st.isDirectory) {
      issues.push({
        issue: `Expected directory but found file`,
        location: absDir,
      });
      return null;
    }
  } catch {
    issues.push({ issue: `Missing directory`, location: absDir });
    return null;
  }

  const files = new Set<string>();
  const dirs = new Set<string>();
  try {
    for await (const entry of Deno.readDir(absDir)) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.isDirectory) dirs.add(entry.name);
      else if (entry.isFile) files.add(entry.name);
      // (symlinks ignored)
    }
  } catch (e) {
    issues.push({
      issue: `Failed to read directory: ${e instanceof Error ? e.message : String(e)}`,
      location: absDir,
    });
    return null;
  }
  return { files, dirs };
}

// ------------------- Utilities -------------------

function isString(v: any): v is string {
  return typeof v === "string";
}
function isArray(v: any): v is any[] {
  return Array.isArray(v);
}
function isObject(v: any): v is Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v);
}

function isFileSpec(v: any): v is string {
  return isString(v) && !v.startsWith("#") && !v.startsWith("@");
}

function fileExt(filename: string): string {
  return filename.split(".").slice(1).join(".") || "";
}

function pathJoin(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}

function tagToName(tag: string): string {
  return tag.startsWith("#") || tag.startsWith("@") ? tag.slice(1) : tag;
}

function filesThatMatchExplicitFileSpec(
  key: string,
  spec: string,
  snapshot: DirSnapshot,
): string[] {
  const fname = `${key}.${spec}`;
  return snapshot.files.has(fname) ? [fname] : [];
}

function isPureFileArray(arr: string[]): boolean {
  return arr.every(
    (x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"),
  );
}

function filesThatMatchExplicitFileArray(
  key: string,
  arr: string[],
  snapshot: DirSnapshot,
): string[] {
  const exts = arr.filter(
    (x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"),
  );
  return exts.map((e) => `${key}.${e}`).filter((f) => snapshot.files.has(f));
}

async function applyRulesForPath(
  targetPath: string,
  ruleTags: string[],
  issues: Issue[],
) {
  for (const tag of ruleTags) {
    const name = tagToName(tag);
    const fn = rules[name];
    if (!fn) {
      issues.push({ issue: `Unknown rule ${tag}`, location: targetPath });
      continue;
    }
    try {
      const res = await fn(targetPath);
      if (res) issues.push({ issue: res, location: targetPath });
    } catch (e) {
      issues.push({
        issue: `Rule ${tag} threw: ${e instanceof Error ? e.message : String(e)}`,
        location: targetPath,
      });
    }
  }
}

// //------------------- CLI demo -------------------
// if (import.meta.main) {
//   const issues = await enforceStructure(Deno.args[0] ?? ".");
//   for (const i of issues.issues) console.log(`${i.location}: ${i.issue}`);
//   if (issues.message) console.log(issues.message);
// }
