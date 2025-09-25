import type { IssueResponse, Issue, Spec, Rule } from "../utils/mod.ts";
import { structure, macros, rules } from "./specs.ts";

// Debug flag - set DEBUG_VALIDATION=true environment variable to enable debug logging
const DEBUG = Deno.env.get("DEBUG_VALIDATION") === "true";

// Type for actual file system structure
type FileSystemNode = {
  type: "file" | "directory";
  name: string;
  extension?: string;
  children?: Map<string, FileSystemNode>;
};

// Cache for expanded macros
const macroCache = new Map<string, Spec>();

// Track macro expansion to detect circular references
const expansionStack = new Set<string>();

/**
 * Helper function to expand macros with tracking of current macro being expanded
 */
function expandMacrosWithDepth(
  spec: Spec,
  macroDefinitions: Record<string, Spec>,
  currentMacro: string | null,
  depth: number,
): Spec {
  // Prevent infinite recursion with a depth limit
  if (depth > 10) {
    return spec; // Stop expanding at depth 10 to prevent infinite recursion
  }

  if (typeof spec === "string") {
    // Check if it's a macro reference
    if (spec.startsWith("#")) {
      const macroName = spec.substring(1);

      // If it's a self-reference, don't expand further
      if (macroName === currentMacro) {
        return spec; // Keep the macro reference for recursive structures
      }

      // Check if macro exists
      if (!macroDefinitions[macroName]) {
        throw new Error(`Macro not found: #${macroName}`);
      }

      // Expand the macro
      return expandMacrosWithDepth(
        macroDefinitions[macroName],
        macroDefinitions,
        macroName,
        depth + 1,
      );
    }
    // Check if it's a rule reference (don't expand)
    if (spec.startsWith("@")) {
      return spec;
    }
    // Regular string (file extension)
    return spec;
  }

  if (Array.isArray(spec)) {
    // Expand each item in the array
    const expanded = spec.map((item) =>
      expandMacrosWithDepth(item, macroDefinitions, currentMacro, depth),
    );
    // Don't return as array if it's a single-item array that got expanded to non-array
    return expanded as Spec;
  }

  if (typeof spec === "object" && spec !== null) {
    // Expand each value in the object
    const expanded: Record<string, Spec> = {};
    for (const [key, value] of Object.entries(spec)) {
      expanded[key] = expandMacrosWithDepth(
        value,
        macroDefinitions,
        currentMacro,
        depth,
      );
    }
    return expanded;
  }

  return spec;
}

/**
 * Expand all macro references in a spec
 */
function expandMacros(
  spec: Spec,
  macroDefinitions: Record<string, Spec>,
): Spec {
  return expandMacrosWithDepth(spec, macroDefinitions, null, 0);
}

/**
 * Scan a directory and build a tree representation
 */
async function scanDirectory(path: string): Promise<FileSystemNode> {
  const name = path.split("/").pop() || "";

  try {
    const stat = await Deno.stat(path);

    if (stat.isFile) {
      const parts = name.split(".");
      const extension = parts.length > 1 ? parts.slice(1).join(".") : undefined;
      return {
        type: "file",
        name: parts[0],
        extension,
      };
    }

    if (stat.isDirectory) {
      const children = new Map<string, FileSystemNode>();

      // Skip common ignore patterns
      const ignoredDirs = ["node_modules", ".git", "dist", ".cache"];
      if (ignoredDirs.includes(name)) {
        return {
          type: "directory",
          name,
          children,
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
        children,
      };
    }

    // Symlinks or other types - treat as file
    return {
      type: "file",
      name,
    };
  } catch (error) {
    // If we can't read it, treat it as missing
    return {
      type: "file",
      name,
    };
  }
}

/**
 * Check if a node matches a file extension spec
 */
function matchesFileExtension(
  node: FileSystemNode,
  extension: string,
): boolean {
  if (node.type !== "file") return false;

  // Handle multi-part extensions like "test.ts" or "d.ts"
  if (extension.includes(".")) {
    const expectedParts = extension.split(".");
    const actualName = node.name + (node.extension ? "." + node.extension : "");
    return actualName.endsWith("." + extension);
  }

  return node.extension === extension;
}

/**
 * Validate a single node against a spec
 */
async function validateNode(
  spec: Spec,
  actual: FileSystemNode | undefined,
  path: string,
  issues: Issue[],
  ruleDefinitions: Record<string, Rule>,
  originalSpec?: Spec,
): Promise<void> {
  // Handle rule references
  if (typeof spec === "string" && spec.startsWith("@")) {
    const ruleName = spec.substring(1);
    if (ruleDefinitions[ruleName]) {
      const result = await ruleDefinitions[ruleName](path);
      if (result) {
        issues.push({
          issue: result,
          location: path,
        });
      }
    }
    return;
  }

  // Handle file extension specs
  if (typeof spec === "string") {
    if (!actual) {
      issues.push({
        issue: `Expected file with extension .${spec}`,
        location: path,
      });
    } else if (!matchesFileExtension(actual, spec)) {
      if (actual.type === "directory") {
        issues.push({
          issue: `Expected file with extension .${spec}, but found directory`,
          location: path,
        });
      } else {
        issues.push({
          issue: `Expected file with extension .${spec}, but found .${actual.extension || "no extension"}`,
          location: path,
        });
      }
    }
    return;
  }

  // Handle array specs (any-of)
  if (Array.isArray(spec)) {
    // Try each spec in the array
    let matched = false;
    const tempIssuesBySpec: Array<{ spec: Spec; origSpec: Spec; issues: Issue[] }> = [];

    // Use original spec if available for better error messages
    const origArray = originalSpec && Array.isArray(originalSpec) ? originalSpec : spec;

    // DEBUG: Log what we're validating
    if (DEBUG && path.includes("domain/business")) {
      console.log(`\n=== DEBUG: Validating ${path} ===`);
      console.log(`Actual type: ${actual ? actual.type : 'undefined'}`);
      if (actual && actual.type === 'directory' && actual.children) {
        console.log(`Actual children: ${Array.from(actual.children.keys()).join(', ')}`);
      }
      console.log(`Spec options: ${origArray.map(s => typeof s === 'string' ? s : 'object').join(', ')}`);
    }

    for (let i = 0; i < spec.length; i++) {
      const subSpec = spec[i];
      const origSubSpec = origArray[i];
      const subIssues: Issue[] = [];

      // DEBUG: Log each spec attempt
      if (DEBUG && path.includes("domain/business")) {
        console.log(`\n  Trying spec option ${i}: ${typeof origSubSpec === 'string' ? origSubSpec : 'object'}`);
        if (typeof subSpec === 'object' && !Array.isArray(subSpec)) {
          console.log(`  Expanded spec keys: ${Object.keys(subSpec).join(', ')}`);
        }
      }

      await validateNode(subSpec, actual, path, subIssues, ruleDefinitions, origSubSpec);

      // DEBUG: Log validation result
      if (DEBUG && path.includes("domain/business")) {
        console.log(`  Result: ${subIssues.length} issues`);
        if (subIssues.length > 0) {
          console.log(`  First few issues: ${subIssues.slice(0, 3).map(i => i.issue).join('; ')}`);
        }
      }

      if (subIssues.length === 0) {
        matched = true;
        break;
      }
      tempIssuesBySpec.push({ spec: subSpec, origSpec: origSubSpec, issues: subIssues });
    }

    if (!matched) {
      // Find which spec has the fewest issues (closest match)
      let minIssues = Infinity;
      let closestIndex = 0;
      tempIssuesBySpec.forEach((item, index) => {
        if (item.issues.length < minIssues) {
          minIssues = item.issues.length;
          closestIndex = index;
        }
      });

      // Generate detailed message for the closest matching spec
      const closestSpec = origArray[closestIndex];
      const closestIssues = tempIssuesBySpec[closestIndex].issues;

      let mainDescription = "";
      if (typeof closestSpec === "string" && closestSpec.startsWith("#")) {
        const macroName = closestSpec.substring(1);
        mainDescription = `Closest match: macro:${macroName}\n`;

        // Group issues by location for better readability
        const issuesByLocation = new Map<string, string[]>();
        for (const issue of closestIssues) {
          const relPath = issue.location.replace(path + "/", "");
          if (!issuesByLocation.has(relPath)) {
            issuesByLocation.set(relPath, []);
          }

          // Make issue descriptions very specific
          let simpleIssue = issue.issue;

          // Parse the original issue to extract specific expectations
          if (issue.issue.includes("Expected file with extension")) {
            const extMatch = issue.issue.match(/Expected file with extension \.([\w.]+)/);
            const foundMatch = issue.issue.match(/but found \.([\w.]+|no extension)/);
            if (extMatch) {
              const expectedExt = extMatch[1];
              const fileName = relPath.split('/').pop();
              if (foundMatch && foundMatch[1] !== "no extension") {
                simpleIssue = `expected: ${fileName}.${expectedExt}, found: ${fileName}.${foundMatch[1]}`;
              } else if (issue.issue.includes("but found directory")) {
                simpleIssue = `expected: ${fileName}.${expectedExt} (file), found: ${fileName}/ (directory)`;
              } else {
                simpleIssue = `expected: ${fileName}.${expectedExt}, found: nothing`;
              }
            }
          } else if (issue.issue.includes("Expected directory")) {
            const dirName = relPath.split('/').pop();
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
            // Extract what patterns were expected
            const patternsMatch = issue.issue.match(/Does not match any of: (.+)/);
            if (patternsMatch) {
              const patterns = patternsMatch[1];
              // Check if actual exists to provide better context
              if (actual) {
                simpleIssue = `found: ${actual.type === 'file' ? `file (${actual.extension || 'no ext'})` : 'directory'}, expected one of: ${patterns}`;
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

          issuesByLocation.get(relPath)!.push(simpleIssue);
        }

        // Format issues by location
        const formattedIssues: string[] = [];
        for (const [loc, issues] of issuesByLocation.entries()) {
          formattedIssues.push(`  ${loc}: ${issues.join("; ")}`);
        }

        if (formattedIssues.length > 0) {
          mainDescription += "Issues:\n" + formattedIssues.join("\n");
        }

        // Show what the other options were
        const otherOptions = origArray
          .filter((_, i) => i !== closestIndex)
          .map(s => {
            if (typeof s === "string" && s.startsWith("#")) {
              return `macro:${s.substring(1)}`;
            } else if (typeof s === "string" && s.startsWith("@")) {
              return `rule:${s.substring(1)}`;
            }
            return "custom pattern";
          });

        if (otherOptions.length > 0) {
          mainDescription += `\n\nOther options tried: ${otherOptions.join(", ")}`;
        }

        issues.push({
          issue: mainDescription,
          location: path,
        });
      } else {
        // Fallback to original behavior for non-macro specs
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

          // Add issue count for each option
          if (specIssues.length > 0) {
            description += ` (${specIssues.length} issues)`;
          }

          return description;
        });

        issues.push({
          issue: `Does not match any of: ${specDescriptions.join(", ")}`,
          location: path,
        });
      }
    }
    return;
  }

  // Handle object specs (directory structure)
  if (typeof spec === "object" && spec !== null) {
    if (!actual) {
      issues.push({
        issue: `Expected directory`,
        location: path,
      });
      return;
    }

    if (actual.type !== "directory") {
      issues.push({
        issue: `Expected directory, but found file`,
        location: path,
      });
      return;
    }

    const children = actual.children || new Map();
    const processedChildren = new Set<string>();

    for (const [key, childSpec] of Object.entries(spec)) {
      // DEBUG logging for business directories
      if (DEBUG && path.includes("domain/business") && !path.includes("/unit")) {
        console.log(`  Checking key '${key}' with spec: ${Array.isArray(childSpec) ? `[${childSpec}]` : typeof childSpec}`);
      }

      if (key === "...") {
        // Wildcard - validate all children against this spec
        for (const [childName, childNode] of children) {
          if (!processedChildren.has(childName)) {
            await validateNode(
              childSpec,
              childNode,
              `${path}/${childName}`,
              issues,
              ruleDefinitions,
              childSpec,
            );
            processedChildren.add(childName);
          }
        }
      } else if (key.endsWith("?")) {
        // Optional directory
        const dirName = key.slice(0, -1);
        // First try exact match
        let childNode = children.get(dirName);
        let usedName = dirName;

        // If not found and spec is a file extension, try with extension
        if (
          !childNode &&
          typeof childSpec === "string" &&
          !childSpec.startsWith("#") &&
          !childSpec.startsWith("@")
        ) {
          const withExt = `${dirName}.${childSpec}`;
          childNode = children.get(withExt);
          if (childNode) {
            usedName = withExt;
          }
        }

        if (childNode) {
          await validateNode(
            childSpec,
            childNode,
            `${path}/${dirName}`,
            issues,
            ruleDefinitions,
            childSpec,
          );
          processedChildren.add(usedName);
        }
        // If not present, that's okay (it's optional)
      } else {
        // Exact name match
        // First try exact match
        let childNode = children.get(key);
        let usedName = key;

        // If not found and spec is a file extension, try with extension
        if (
          !childNode &&
          typeof childSpec === "string" &&
          !childSpec.startsWith("#") &&
          !childSpec.startsWith("@")
        ) {
          const withExt = `${key}.${childSpec}`;
          childNode = children.get(withExt);
          if (childNode) {
            usedName = withExt;
          }
        }

        // If not found and spec is an array of extensions, try each one
        if (!childNode && Array.isArray(childSpec)) {
          // DEBUG
          if (DEBUG && path.includes("domain/business") && key === "unit") {
            console.log(`  Looking for files with base '${key}' and extensions: ${childSpec}`);
            console.log(`  Available children: ${Array.from(children.keys())}`);
          }

          // For arrays like ["test.ts", "nop.test.ts"], we need to check if any matching file exists
          for (const ext of childSpec) {
            if (typeof ext === "string" && !ext.startsWith("#") && !ext.startsWith("@")) {
              const possibleName = `${key}.${ext}`;
              const foundChild = children.get(possibleName);

              // DEBUG
              if (DEBUG && path.includes("domain/business") && key === "unit") {
                console.log(`    Checking for '${possibleName}': ${foundChild ? 'found' : 'not found'}`);
              }

              if (foundChild) {
                childNode = foundChild;
                usedName = possibleName;
                break;
              }
            }
          }
        }

        await validateNode(
          childSpec,
          childNode,
          `${path}/${key}`,
          issues,
          ruleDefinitions,
          childSpec,
        );
        if (childNode) {
          processedChildren.add(usedName);
        }
      }
    }

    // Check for unexpected files (not in spec)
    if (!spec["..."]) {
      for (const [childName, childNode] of children) {
        if (!processedChildren.has(childName)) {
          // Check if it matches an optional directory pattern
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
              location: `${path}/${childName}`,
            });
          }
        }
      }
    }
  }
}

/**
 * Main validation function
 */
export async function validateStructure(
  targetDir: string = ".",
): Promise<IssueResponse> {
  try {
    // Phase 1: Load and prepare (specs are imported directly)
    const expandedSpec = expandMacros(structure, macros);

    // Phase 2: Scan file system
    const actualStructure = await scanDirectory(targetDir);

    // Phase 3: Validate structure
    const issues: Issue[] = [];

    // Validate the contents of the target directory, not the directory itself
    if (actualStructure.type === "directory" && actualStructure.children) {
      // Treat the expanded spec as the expected contents of the target directory
      if (typeof expandedSpec === "object" && !Array.isArray(expandedSpec)) {
        const processedChildren = new Set<string>();

        for (const [key, childSpec] of Object.entries(expandedSpec)) {
          if (key === "...") {
            // Wildcard - validate all children
            for (const [childName, childNode] of actualStructure.children) {
              if (!processedChildren.has(childName)) {
                await validateNode(
                  childSpec,
                  childNode,
                  `${targetDir}/${childName}`,
                  issues,
                  rules || {},
                  (structure as any)["..."],
                );
                processedChildren.add(childName);
              }
            }
          } else if (key.endsWith("?")) {
            // Optional directory
            const dirName = key.slice(0, -1);
            // Look for exact directory match or file with extension
            let childNode = actualStructure.children.get(dirName);

            if (!childNode && typeof childSpec === "string") {
              // Try with extension for files
              const withExt = `${dirName}.${childSpec}`;
              childNode = actualStructure.children.get(withExt);
              if (childNode) {
                processedChildren.add(withExt);
              }
            } else if (childNode) {
              processedChildren.add(dirName);
            }

            if (childNode) {
              await validateNode(
                childSpec,
                childNode,
                `${targetDir}/${dirName}`,
                issues,
                rules || {},
                (structure as any)[key],
              );
            }
          } else {
            // Exact name match
            let childNode = actualStructure.children.get(key);
            let actualKey = key;

            // If we're looking for a file and didn't find exact match, try with extension
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

            await validateNode(
              childSpec,
              childNode,
              `${targetDir}/${key}`,
              issues,
              rules || {},
              (structure as any)[key],
            );
          }
        }

        // Check for unexpected files
        const specKeys = Object.keys(expandedSpec);
        const hasWildcard = specKeys.includes("...");

        if (!hasWildcard) {
          for (const [childName] of actualStructure.children) {
            if (!processedChildren.has(childName)) {
              const childNode = actualStructure.children.get(childName)!;
              issues.push({
                issue: `Unexpected ${childNode.type}`,
                location: `${targetDir}/${childName}`,
              });
            }
          }
        }
      } else {
        // If spec is not a directory spec, validate against the directory itself
        await validateNode(
          expandedSpec,
          actualStructure,
          targetDir,
          issues,
          rules || {},
          structure,
        );
      }
    } else {
      // Not a directory, validate as-is
      await validateNode(
        expandedSpec,
        actualStructure,
        targetDir,
        issues,
        rules || {},
        structure,
      );
    }

    // Phase 4: Return IssueResponse format
    return {
      name: `validate-structure: ${targetDir}`,
      issues: issues,
      message:
        issues.length === 0
          ? "All validations passed"
          : `Found ${issues.length} validation issue(s)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: `validate-structure: ${targetDir}`,
      issues: [
        {
          issue: errorMessage,
          location: targetDir,
        },
      ],
      message: `Validation failed: ${errorMessage}`,
    };
  }
}

// Main CLI entry point
if (import.meta.main) {
  const targetDir = Deno.args[0] || ".";
  const result = await validateStructure(targetDir);

  // Display results
  if (result.issues.length === 0) {
    console.log("✅", result.message);
    Deno.exit(0);
  } else {
    for (const issue of result.issues) {
      console.log(`❌ ${issue.location}: ${issue.issue}`);
    }
    console.log(`\n${result.message}`);
    Deno.exit(1);
  }
}

