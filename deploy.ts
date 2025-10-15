#!/usr/bin/env deno run -A

/**
 * Interactive deployment script for OmnisourceTools
 * Scans ./src directory and allows selection of a tool to deploy via setup.sh
 */

import { Select } from "@cliffy/prompt";

interface ToolDirectory {
  name: string;
  path: string;
  modPath: string;
}

async function scanToolDirectories(): Promise<ToolDirectory[]> {
  const srcPath = "./src";
  const tools: ToolDirectory[] = [];

  try {
    for await (const entry of Deno.readDir(srcPath)) {
      if (entry.isDirectory) {
        const modPath = `${srcPath}/${entry.name}/mod.ts`;

        // Verify mod.ts exists
        try {
          await Deno.stat(modPath);
          tools.push({
            name: entry.name,
            path: `${srcPath}/${entry.name}`,
            modPath: modPath,
          });
        } catch {
          console.warn(`⚠️  Skipping ${entry.name} - no mod.ts found`);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to read ${srcPath}:`, message);
    Deno.exit(1);
  }

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

async function selectTool(tools: ToolDirectory[]): Promise<ToolDirectory | null> {
  try {
    const selectedName = await Select.prompt({
      message: "Select a tool to deploy",
      options: tools.map(tool => ({
        name: tool.name,
        value: tool.name,
      })),
    });

    return tools.find(tool => tool.name === selectedName) || null;
  } catch (error) {
    // User cancelled with Ctrl+C
    return null;
  }
}

async function deployTool(tool: ToolDirectory): Promise<void> {
  console.log(`\n🚀 Deploying ${tool.name}...`);
  console.log(`   Path: ${tool.modPath}`);

  const command = new Deno.Command("./setup.sh", {
    args: [tool.modPath],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();

  if (code === 0) {
    console.log(`✅ Successfully deployed ${tool.name}!`);
  } else {
    console.error(`❌ Deployment failed with exit code ${code}`);
    Deno.exit(code);
  }
}

async function main(): Promise<void> {
  console.log("📦 OmnisourceTools Deployment\n");

  const tools = await scanToolDirectories();

  if (tools.length === 0) {
    console.error("❌ No tools found in ./src with mod.ts files");
    Deno.exit(1);
  }

  const selectedTool = await selectTool(tools);

  if (!selectedTool) {
    console.log("\n👋 Deployment cancelled");
    Deno.exit(0);
  }

  await deployTool(selectedTool);
}

if (import.meta.main) {
  main();
}
