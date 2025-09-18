#!/usr/bin/env deno run -A

import {
  join,
  basename,
  dirname,
} from "https://deno.land/std@0.208.0/path/mod.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

interface Project {
  name: string;
  path: string;
  entryPoint: string;
  hasDenoJson: boolean;
}

// ANSI color codes and styles
const style = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  inverse: "\x1b[7m",

  // Colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // Bright background colors
  bgBrightBlack: "\x1b[100m",
  bgBrightRed: "\x1b[101m",
  bgBrightGreen: "\x1b[102m",
  bgBrightYellow: "\x1b[103m",
  bgBrightBlue: "\x1b[104m",
  bgBrightMagenta: "\x1b[105m",
  bgBrightCyan: "\x1b[106m",
  bgBrightWhite: "\x1b[107m",
};

// Box drawing characters
const box = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  cross: "┼",
  teeRight: "├",
  teeLeft: "┤",
  teeDown: "┬",
  teeUp: "┴",

  // Double line variants
  doubleTopLeft: "╔",
  doubleTopRight: "╗",
  doubleBottomLeft: "╚",
  doubleBottomRight: "╝",
  doubleHorizontal: "═",
  doubleVertical: "║",

  // Thick variants
  thickHorizontal: "━",
  thickVertical: "┃",
  thickTopLeft: "┏",
  thickTopRight: "┓",
  thickBottomLeft: "┗",
  thickBottomRight: "┛",
};

function drawBox(
  content: string[],
  variant: "single" | "double" | "thick" = "single",
  color: string = "",
): string {
  const lines = content.flatMap((line) => line.split("\n"));
  const maxLength = Math.max(...lines.map((line) => stripAnsi(line).length));

  let chars: any = {};
  if (variant === "double") {
    chars = {
      tl: box.doubleTopLeft,
      tr: box.doubleTopRight,
      bl: box.doubleBottomLeft,
      br: box.doubleBottomRight,
      h: box.doubleHorizontal,
      v: box.doubleVertical,
    };
  } else if (variant === "thick") {
    chars = {
      tl: box.thickTopLeft,
      tr: box.thickTopRight,
      bl: box.thickBottomLeft,
      br: box.thickBottomRight,
      h: box.thickHorizontal,
      v: box.thickVertical,
    };
  } else {
    chars = {
      tl: box.topLeft,
      tr: box.topRight,
      bl: box.bottomLeft,
      br: box.bottomRight,
      h: box.horizontal,
      v: box.vertical,
    };
  }

  const result: string[] = [];

  // Top border
  result.push(
    color + chars.tl + chars.h.repeat(maxLength + 2) + chars.tr + style.reset,
  );

  // Content lines
  for (const line of lines) {
    const strippedLength = stripAnsi(line).length;
    const padding = " ".repeat(maxLength - strippedLength);
    result.push(
      color +
        chars.v +
        style.reset +
        " " +
        line +
        padding +
        " " +
        color +
        chars.v +
        style.reset,
    );
  }

  // Bottom border
  result.push(
    color + chars.bl + chars.h.repeat(maxLength + 2) + chars.br + style.reset,
  );

  return result.join("\n");
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function centerText(text: string, width: number): string {
  const strippedLength = stripAnsi(text).length;
  const totalPadding = width - strippedLength;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return " ".repeat(leftPadding) + text + " ".repeat(rightPadding);
}

async function findProjects(): Promise<Project[]> {
  const projects: Project[] = [];
  const srcDir = join(Deno.cwd(), "src");

  try {
    for await (const entry of Deno.readDir(srcDir)) {
      if (entry.isDirectory) {
        const projectPath = join(srcDir, entry.name);
        const denoJsonPath = join(projectPath, "deno.json");

        let entryPoint = "mod.ts"; // default entry point
        let hasDenoJson = false;

        // Check for deno.json and read entry point if specified
        if (existsSync(denoJsonPath)) {
          hasDenoJson = true;
          try {
            const denoConfig = JSON.parse(
              await Deno.readTextFile(denoJsonPath),
            );
            // Look for entry point in various possible locations
            entryPoint =
              denoConfig.tasks?.start?.replace(/^deno run.*\s+/, "") ||
              denoConfig.entry ||
              denoConfig.main ||
              "mod.ts";
          } catch {
            // If deno.json parse fails, use default
          }
        }

        // Check common entry point patterns if deno.json doesn't specify
        if (!hasDenoJson || entryPoint === "mod.ts") {
          const possibleEntries = [
            "bootstrap.ts",
            "main.ts",
            "mod.ts",
            "index.ts",
          ];
          for (const entry of possibleEntries) {
            if (existsSync(join(projectPath, entry))) {
              entryPoint = entry;
              break;
            }
          }
        }

        projects.push({
          name: entry.name,
          path: projectPath,
          entryPoint,
          hasDenoJson,
        });
      }
    }
  } catch (error) {
    console.error(
      `${style.bgRed}${style.white}${style.bold} ERROR ${style.reset} ${style.red}Error scanning src directory: ${error}${style.reset}`,
    );
    Deno.exit(1);
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function displayMenu(projects: Project[]) {
  console.log("");

  // Header
  const header = centerText(
    `${style.bold}${style.brightMagenta}✦ OMNISOURCE PROJECT SELECTOR ✦${style.reset}`,
    60,
  );
  const headerBox = drawBox([header], "double", style.brightMagenta);
  console.log(headerBox);

  console.log("");

  // Menu content
  const menuLines: string[] = [];
  menuLines.push(
    `${style.brightCyan}${style.bold}Available Projects:${style.reset}`,
  );
  menuLines.push("");

  projects.forEach((project, index) => {
    const num = `${(index + 1).toString().padStart(2)}.`;
    if (project.hasDenoJson) {
      menuLines.push(
        `  ${style.brightGreen}${num} ${style.bold}[✓] ${project.name}${style.reset}`,
      );
    } else {
      menuLines.push(
        `  ${style.brightBlack}${num} ${style.dim}[·] ${project.name}${style.reset}`,
      );
    }
    menuLines.push(
      `     ${style.cyan}└─ ${style.italic}${project.entryPoint}${style.reset}`,
    );
  });

  menuLines.push("");
  menuLines.push(
    `  ${style.bgRed}${style.white}${style.bold} 0 ${style.reset}${style.red} Exit${style.reset}`,
  );

  const menuBox = drawBox(menuLines, "single", style.brightCyan);
  console.log(menuBox);
}

async function getSelection(max: number): Promise<number> {
  const buf = new Uint8Array(1024);
  const prompt = `\n${style.brightMagenta}${style.bold}▶${style.reset} ${style.magenta}Select project (0-${max}):${style.reset} `;

  await Deno.stdout.write(new TextEncoder().encode(prompt));
  const n = await Deno.stdin.read(buf);

  if (n === null) return -1;

  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  const selection = parseInt(input);

  if (isNaN(selection) || selection < 0 || selection > max) {
    console.log(
      `${style.bgRed}${style.white}${style.bold} ERROR ${style.reset} ${style.red}Invalid selection! Please try again.${style.reset}`,
    );
    return await getSelection(max);
  }

  return selection;
}

async function buildProject(project: Project) {
  console.log("");

  // Build header
  const buildHeader = centerText(
    `${style.bold}${style.brightYellow}⚡ BUILDING PROJECT ⚡${style.reset}`,
    50,
  );
  const buildBox = drawBox([buildHeader], "thick", style.brightYellow);
  console.log(buildBox);

  console.log("");

  // Project info
  const infoLines = [
    `${style.brightBlue}Project:${style.reset} ${style.bold}${project.name}${style.reset}`,
    `${style.brightBlue}Path:${style.reset} ${project.path}`,
    `${style.brightBlue}Entry:${style.reset} ${style.italic}${project.entryPoint}${style.reset}`,
  ];

  const infoBox = drawBox(infoLines, "single", style.brightBlue);
  console.log(infoBox);
  console.log("");

  // Change to project directory
  Deno.chdir(project.path);

  // Execute setup.sh with project name and entry point
  const setupPath = join(dirname(dirname(project.path)), "setup.sh");

  if (!existsSync(setupPath)) {
    console.error(
      `${style.bgRed}${style.white}${style.bold} ERROR ${style.reset} ${style.red}setup.sh not found at ${setupPath}${style.reset}`,
    );
    Deno.exit(1);
  }

  const command = new Deno.Command("bash", {
    args: [setupPath, project.name, project.entryPoint],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const { code } = await command.output();

  if (code !== 0) {
    console.error(
      `\n${style.bgRed}${style.white}${style.bold} ERROR ${style.reset} ${style.red}Build failed!${style.reset}`,
    );
    Deno.exit(1);
  }
}

async function main() {
  const projects = await findProjects();

  if (projects.length === 0) {
    console.error(
      `${style.bgRed}${style.white}${style.bold} ERROR ${style.reset} ${style.red}No projects found in src directory!${style.reset}`,
    );
    Deno.exit(1);
  }

  // If only one project, build it automatically
  if (projects.length === 1) {
    console.log(
      `\n${style.brightCyan}${style.bold}◉${style.reset} ${style.cyan}Only one project found: ${style.bold}${projects[0].name}${style.reset}`,
    );
    console.log(
      `${style.brightGreen}${style.bold}▶${style.reset} ${style.green}Building automatically...${style.reset}\n`,
    );
    await buildProject(projects[0]);
    return;
  }

  // Interactive selection for multiple projects
  while (true) {
    displayMenu(projects);
    const selection = await getSelection(projects.length);

    if (selection === 0) {
      console.log(
        `\n${style.brightGreen}${style.bold}✓${style.reset} ${style.green}Exiting...${style.reset}\n`,
      );
      break;
    }

    if (selection > 0 && selection <= projects.length) {
      await buildProject(projects[selection - 1]);
      break;
    }
  }
}

if (import.meta.main) {
  await main();
}

