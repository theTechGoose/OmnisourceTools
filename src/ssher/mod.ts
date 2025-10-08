import {
  Select,
  Input,
  Confirm,
} from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/mod.ts";

interface SSHTarget {
  name: string;
  command: string;
  online?: boolean;
}

interface Config {
  servers: Array<{ name: string; command: string }>;
}

const DEFAULT_CONFIG: Config = {
  servers: [
    {
      name: "arachne",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@34.66.97.235",
    },
    {
      name: "logger",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@34.27.214.65",
    },
    {
      name: "supabase",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@136.114.182.150",
    },
    {
      name: "on-prem",
      command: "ssh -p 27347 raphael@7.tcp.ngrok.io",
    },
  ],
};

async function getConfigPath(): Promise<string> {
  const home = Deno.env.get("HOME") || "";
  return `${home}/.config/sshr/config.json`;
}

async function loadConfig(): Promise<SSHTarget[]> {
  const configPath = await getConfigPath();

  try {
    const configContent = await Deno.readTextFile(configPath);
    const config: Config = JSON.parse(configContent);
    return config.servers.map((s) => ({ ...s, online: false }));
  } catch (error) {
    // Config doesn't exist, create it with defaults
    if (error instanceof Deno.errors.NotFound) {
      console.log(`📝 Creating default config at ${configPath}`);

      // Create directory if it doesn't exist
      const configDir = configPath.substring(0, configPath.lastIndexOf("/"));
      await Deno.mkdir(configDir, { recursive: true });

      // Write default config
      await Deno.writeTextFile(
        configPath,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
      );

      return DEFAULT_CONFIG.servers.map((s) => ({ ...s, online: false }));
    }

    throw error;
  }
}

async function checkServerStatus(target: SSHTarget): Promise<boolean> {
  try {
    // Extract host and port from command
    const parts = target.command.split(" ");
    let host = "";
    let port = "22";

    // Find the user@host part
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("@")) {
        host = parts[i].split("@")[1];
      }
      // Check for -p flag for custom port
      if (parts[i] === "-p" && i + 1 < parts.length) {
        port = parts[i + 1];
      }
    }

    if (!host) return false;

    // Use nc to check if port is reachable (-G for timeout on macOS)
    const testCmd = new Deno.Command("nc", {
      args: ["-G", "2", "-z", host, port],
      stdout: "null",
      stderr: "null",
    });

    const { code } = await testCmd.output();
    return code === 0;
  } catch {
    return false;
  }
}

type AccessType = "ssh" | "bind" | "sftp";

interface PortBinding {
  remotePort: number;
  localPort: number;
}

async function main() {
  // Load config
  const sshTargets = await loadConfig();

  // Check server status
  console.log("🔍 Checking server status...\n");
  await Promise.all(
    sshTargets.map(async (target) => {
      target.online = await checkServerStatus(target);
    }),
  );

  // Select SSH target
  const targetName = await Select.prompt({
    message: "Which server do you want to connect to?",
    options: sshTargets.map((t) => ({
      name: t.online ? t.name : `${t.name} (offline)`,
      value: t.name,
      disabled: !t.online,
    })),
  });

  const target = sshTargets.find((t) => t.name === targetName);
  if (!target) {
    console.error("❌ Invalid target selection");
    Deno.exit(1);
  }

  // Select access type
  const accessType: AccessType = await Select.prompt({
    message: "What type of access do you need?",
    options: [
      { name: "Interactive SSH session", value: "ssh" as const },
      { name: "SSH with port binding", value: "bind" as const },
      { name: "SFTP session", value: "sftp" as const },
    ],
  });

  let finalCommand = target.command;

  // Handle port binding
  if (accessType === "bind") {
    const bindings: PortBinding[] = [];

    let addMore = true;
    while (addMore) {
      const remotePortStr = await Input.prompt({
        message: "What port on the remote machine?",
        validate: (value) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1 || port > 65535) {
            return "Please enter a valid port number (1-65535)";
          }
          return true;
        },
      });

      const localPortStr = await Input.prompt({
        message: "What port on this machine?",
        validate: (value) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1 || port > 65535) {
            return "Please enter a valid port number (1-65535)";
          }
          return true;
        },
      });

      bindings.push({
        remotePort: parseInt(remotePortStr),
        localPort: parseInt(localPortStr),
      });

      addMore = await Confirm.prompt({
        message: "Do you want to add another binding?",
        default: false,
      });
    }

    // Build SSH command with port forwarding
    const portForwards = bindings
      .map((b) => `-L ${b.localPort}:localhost:${b.remotePort}`)
      .join(" ");

    finalCommand = `${target.command} ${portForwards}`;
  } else if (accessType === "sftp") {
    // Replace ssh with sftp
    finalCommand = target.command.replace(/^ssh/, "sftp");
  }

  // Execute the command using exec to replace the shell process with SSH
  console.log(`\n🚀 Executing: ${finalCommand}\n`);

  // Use exec to replace the current process with SSH
  const cmd = new Deno.Command("sh", {
    args: ["-c", `exec ${finalCommand}`],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = cmd.spawn();
  const status = await process.status;
  Deno.exit(status.code);
}

if (import.meta.main) {
  await main();
}
