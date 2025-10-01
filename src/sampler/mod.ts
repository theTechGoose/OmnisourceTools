import { dirname, join, relative } from "node:path";
import {
  InputData,
  jsonInputForTargetLanguage,
  quicktype,
} from "npm:quicktype-core";

async function jsonToTsInterfaces(json: string, i: number) {
  const jsonInput = jsonInputForTargetLanguage("ts");
  const parentName = getParentFolderName() || "Root";
  let interfaceName = parentName.charAt(0).toUpperCase() + parentName.slice(1);
  interfaceName = `${interfaceName}_${i}`;
  await jsonInput.addSource({ name: interfaceName, samples: [json] });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  const result = await quicktype({
    inputData,
    lang: "ts",
    rendererOptions: {
      "just-types": "true",
    },
  });
  return result.lines.join("\n");
}

async function getGitRoot() {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
  });
  const { stdout } = await cmd.output();
  const root = new TextDecoder().decode(stdout).trim();
  return root;
}

async function getEnvFile() {
  const curr = Deno.cwd();
  const root = await getGitRoot();
  const rel = relative(curr, root);
  return join(rel, "env", "local");
}

async function runTest(file: string) {
  const curr = Deno.cwd();
  const path = join(curr, file);
  const envFile = await getEnvFile();
  console.log(`Running tests in ${path} with env file ${envFile}`);
  const cmd = new Deno.Command("deno", {
    args: ["test", "-A", `--env-file=${envFile}`, path],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr } = await cmd.output();
  const stdTxt = new TextDecoder().decode(stdout);
  const errTxt = new TextDecoder().decode(stderr);
  const full = stdTxt + "\n\n" + errTxt;

  // Extract JavaScript objects (not strict JSON)
  const jsObjects: string[] = [];
  let braceCount = 0;
  let currentObj = "";
  let inString = false;
  let quoteChar = null;

  for (let i = 0; i < full.length; i++) {
    const char = full[i];
    const prevChar = i > 0 ? full[i - 1] : "";

    // Handle string boundaries
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inString = false;
        quoteChar = null;
      }
    }

    if (!inString) {
      if (char === "{") {
        if (braceCount === 0) {
          currentObj = "{";
        } else {
          currentObj += char;
        }
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        currentObj += char;

        if (braceCount === 0 && currentObj.length > 2) {
          // Try to evaluate as JavaScript object
          try {
            eval(`(${currentObj})`);
            jsObjects.push(currentObj);
          } catch (e) {
            // Not a valid JS object, skip
          }
          currentObj = "";
        }
      } else if (braceCount > 0) {
        currentObj += char;
      }
    } else if (braceCount > 0) {
      currentObj += char;
    }
  }

  console.log(`Found ${jsObjects.length} JS objects`);
  return jsObjects.map((obj) => [obj]);
}

function parseMatch(match: string) {
  try {
    // Handle JavaScript object notation (convert to valid JSON)
    const obj = eval(`(${match})`);
    return JSON.stringify(obj, null, 2);
  } catch {
    return null;
  }
}

function findArtifactsFolderUp() {
  const here = join(Deno.cwd(), dirname(Deno.args[0]));
  let current = here;
  console.log({ here: current });

  while (current !== "/" && current !== "") {
    const artifactsPath = join(current, "artifacts");
    try {
      const stat = Deno.statSync(artifactsPath);
      if (stat.isDirectory) {
        return artifactsPath;
      }
    } catch {
      // Directory doesn't exist, continue searching up
    }

    // Move up one directory
    const parent = join(current, "..");
    if (parent === current) break; // Reached root
    current = parent;
  }

  return null; // artifacts folder not found
}

function getParentFolderName() {
  const here = dirname(Deno.args[0]);
  const parent = join(here);
  return parent.split("/").pop();
}

if (import.meta.main) {
  const matches = await runTest(Deno.args[0]);
  const artifactsFolder = findArtifactsFolderUp();
  const parsedItems = matches.map((m) => parseMatch(m[0])).filter((m) => m);

  const parsedWithTypes = await Promise.all(
    parsedItems.map(async (item, i) => {
      const types = await jsonToTsInterfaces(item!, i);
      return { json: item, types };
    }),
  );
  if (!artifactsFolder) throw new Error("artifacts folder not found");
  const parentFolderName = getParentFolderName();
  const outFolder = join(artifactsFolder, parentFolderName || "default");
  Deno.mkdirSync(outFolder, { recursive: true });
  Deno.writeTextFileSync(
    outFolder + "/output.json",
    `[\n${
      parsedWithTypes
        .map((i) => JSON.parse(i.json!))
        .map((obj) => JSON.stringify(obj, null, 2))
        .join(",\n")
    }\n]`,
  );
  Deno.writeTextFileSync(
    outFolder + "/types.ts",
    parsedWithTypes.map((i) => i.types).join("\n\n"),
  );
  console.log({ outFolder });
}
