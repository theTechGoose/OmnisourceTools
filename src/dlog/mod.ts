import { runCmd } from "./run-cmd.ts";
import cfg from "./config.json" with { type: "json" };
import { homedir } from "node:os";
import { exists, ensureDir } from "jsr:@std/fs";
import { dirname } from "jsr:@std/path";

async function main() {
  const configPath = await prep();
  const denoCmd = [`deno`, ...Deno.args];
  const logdyCmd = ["logdy", "--config", configPath, "--port=9501"];
  await runCmd("string", ...denoCmd, "|", ...logdyCmd);
}

async function prep() {
  await ensureLogdyInstalled();
  const configPath = `${homedir()}/.config/logdy/config.json`;
  await ensureConfigAsync(configPath, cfg);
  return configPath;
}

function ensureSudo() {
  if (Deno.uid() === 0) return;
  throw new Error("The first run must be run as root (sudo) to install Logdy.");
}

export async function ensureConfigAsync(configPath: string, cfg: unknown) {
  const dir = dirname(configPath);
  await ensureDir(dir);

  // Read existing config if present
  const existing = await Deno.readTextFile(configPath).catch(() => null);
  const desired = JSON.stringify(cfg, null, 2);

  // Only write if different or missing
  if (existing !== desired) {
    await Deno.writeTextFile(configPath, desired);
    console.log(
      existing === null
        ? `Created default Logdy config at ${configPath}`
        : `Updated Logdy config at ${configPath}`,
    );
  }
}

async function ensureLogdyInstalled() {
  const logdyExists = await runCmd("bool", "command", "-v", "logdy");
  if (logdyExists) return;
  ensureSudo();
  console.log("Logdy is not installed. Installing...");
  await runCmd("string", "curl", "https://logdy.dev/install.sh", "|", "sh");
}

main();
