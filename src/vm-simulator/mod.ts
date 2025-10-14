const CONTAINER_NAME = "vm-simulator-debian12";
const CACHED_IMAGE_NAME = "vm-simulator:cached";

async function runCommand(cmd: string[]): Promise<string> {
  const process = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await process.output();

  if (code !== 0) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Command failed: ${cmd.join(" ")}\n${error}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

async function killProcessOnPort(port: string): Promise<void> {
  try {
    // Find process using the port
    const lsofOutput = await runCommand([
      "lsof",
      "-ti",
      `tcp:${port}`,
    ]);

    if (lsofOutput) {
      const pids = lsofOutput.split("\n").filter((p) => p.trim());
      for (const pid of pids) {
        // Check if process is Docker-related or system-critical
        try {
          const processInfo = await runCommand(["ps", "-p", pid, "-o", "comm="]);
          const processName = processInfo.toLowerCase();

          const protectedProcesses = ["docker", "claude", "com.docker", "dockerd"];
          const isProtected = protectedProcesses.some(name => processName.includes(name));

          if (isProtected) {
            console.log(`⚠️  Skipping protected process ${pid} (${processInfo}) on port ${port}`);
            continue;
          }

          console.log(`Killing process ${pid} (${processInfo}) on port ${port}`);
          await runCommand(["kill", "-9", pid]);
        } catch (_error) {
          // Process might have exited, skip
        }
      }
    }
  } catch (_error) {
    // No process on port, continue
  }
}

async function cleanupExistingContainer(): Promise<void> {
  try {
    const existing = await runCommand([
      "docker",
      "ps",
      "-a",
      "--filter",
      `name=${CONTAINER_NAME}`,
      "--format",
      "{{.Names}}",
    ]);

    if (existing.includes(CONTAINER_NAME)) {
      console.log(`Removing existing container: ${CONTAINER_NAME}`);
      await runCommand(["docker", "rm", "-f", CONTAINER_NAME]);
    }
  } catch (_error) {
    // Container doesn't exist, proceed
  }
}

async function imageExists(imageName: string): Promise<boolean> {
  try {
    await runCommand(["docker", "image", "inspect", imageName]);
    return true;
  } catch {
    return false;
  }
}

async function buildCachedImage(): Promise<void> {
  console.log("Building cached image with SSH and Docker pre-installed...");

  const setupScript =
    "apt update && " +
    "apt install -y openssh-server ca-certificates curl gnupg && " +
    "mkdir -p /run/sshd && " +
    "echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && " +
    "echo 'PermitEmptyPasswords yes' >> /etc/ssh/sshd_config && " +
    "passwd -d root && " +
    "systemctl enable ssh && " +
    // Install Docker
    "install -m 0755 -d /etc/apt/keyrings && " +
    "curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && " +
    "chmod a+r /etc/apt/keyrings/docker.asc && " +
    'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list && ' +
    "apt update && " +
    "apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && " +
    "systemctl enable docker";

  // Create temporary container for building
  const tempContainerName = "vm-simulator-build-temp";

  try {
    await runCommand(["docker", "rm", "-f", tempContainerName]);
  } catch {
    // Container doesn't exist
  }

  await runCommand([
    "docker",
    "run",
    "-d",
    "--name",
    tempContainerName,
    "--privileged",
    "-v",
    "/sys/fs/cgroup:/sys/fs/cgroup:rw",
    "--cgroupns=host",
    "jrei/systemd-debian:12",
  ]);

  console.log("Waiting for systemd to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Installing packages...");
  await runCommand(["docker", "exec", tempContainerName, "bash", "-c", setupScript]);

  console.log("Creating cached image...");
  await runCommand(["docker", "commit", tempContainerName, CACHED_IMAGE_NAME]);

  console.log("Cleaning up build container...");
  await runCommand(["docker", "rm", "-f", tempContainerName]);

  console.log("✅ Cached image created successfully!");
}

async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.error(
      "Usage: deno run --allow-all mod.ts <path-to-copy> [...ports]",
    );
    console.error("       deno run --allow-all mod.ts --build-cache  (build cached image)");
    console.error("       deno run --allow-all mod.ts --down         (stop and remove container)");
    Deno.exit(1);
  }

  // Handle cache building
  if (args[0] === "--build-cache") {
    await buildCachedImage();
    return;
  }

  // Handle container teardown
  if (args[0] === "--down") {
    console.log("Stopping and removing container...");
    await cleanupExistingContainer();
    console.log("✅ Container removed");
    return;
  }

  const [localPath, ...ports] = args;

  // Resolve to absolute path for volume mounting
  const absolutePath = await Deno.realPath(localPath);

  // Kill processes on user-specified ports
  for (const port of ports) {
    if (port === "22") {
      console.log("⚠️  Skipping port 22 (reserved for SSH)");
      continue;
    }
    await killProcessOnPort(port);
  }

  // Cleanup existing container
  await cleanupExistingContainer();

  // Build port mappings
  const portMappings = ports.flatMap((port) => ["-p", `${port}:${port}`]);

  // Check if cached image exists, if not build it
  const hasCachedImage = await imageExists(CACHED_IMAGE_NAME);
  if (!hasCachedImage) {
    console.log("⚠️  Cached image not found. Building it now (this is a one-time setup)...");
    await buildCachedImage();
  }

  // Build docker run command - mount the path as a volume
  const dockerCmd = [
    "docker",
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "--privileged",
    "-v",
    "/sys/fs/cgroup:/sys/fs/cgroup:rw",
    "--cgroupns=host",
    "-v",
    `${absolutePath}:/root/${absolutePath.split("/").pop()}`,
    "-p",
    "22:22",
    ...portMappings,
    CACHED_IMAGE_NAME,
  ];

  console.log(`Starting container with volume mounted from ${absolutePath}...`);
  const containerId = await runCommand(dockerCmd);
  console.log(`Container started: ${containerId.slice(0, 12)}`);

  // Wait for systemd to initialize
  console.log("Waiting for systemd to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Just start the services (they're already installed in the cached image)
  console.log("Starting SSH and Docker services...");
  await runCommand(["docker", "exec", CONTAINER_NAME, "bash", "-c", "systemctl start ssh && systemctl start docker"]);

  // Prepare SSH command (disable host key checking)
  const sshCommand =
    "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@localhost -p 22";

  // Copy to clipboard (macOS)
  const clipboardProcess = new Deno.Command("pbcopy", {
    stdin: "piped",
  });

  const child = clipboardProcess.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(sshCommand));
  await writer.close();
  await child.status;

  const mountedName = absolutePath.split("/").pop();
  console.log("\n✅ Container ready!");
  console.log(`📋 SSH command copied to clipboard: ${sshCommand}`);
  console.log(`🔑 Passwordless login enabled`);
  console.log(`📂 Files mounted at: /root/${mountedName}`);
  console.log(`💾 Changes in container will reflect on host!`);

  if (ports.length > 0) {
    console.log(`🔌 Ports mapped: ${ports.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  Deno.exit(1);
});
