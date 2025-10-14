#!/usr/bin/env deno run --no-check -A
// src/vm-simulator/mod.ts
var CONTAINER_NAME = "vm-simulator-debian12";
var CACHED_IMAGE_NAME = "vm-simulator:cached";
async function runCommand(cmd) {
  const process = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped"
  });
  const { code, stdout, stderr } = await process.output();
  if (code !== 0) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Command failed: ${cmd.join(" ")}
${error}`);
  }
  return new TextDecoder().decode(stdout).trim();
}
async function killProcessOnPort(port) {
  try {
    const lsofOutput = await runCommand([
      "lsof",
      "-ti",
      `tcp:${port}`
    ]);
    if (lsofOutput) {
      const pids = lsofOutput.split("\n").filter((p) => p.trim());
      for (const pid of pids) {
        try {
          const processInfo = await runCommand([
            "ps",
            "-p",
            pid,
            "-o",
            "comm="
          ]);
          const processName = processInfo.toLowerCase();
          const protectedProcesses = [
            "docker",
            "claude",
            "com.docker",
            "dockerd"
          ];
          const isProtected = protectedProcesses.some((name) => processName.includes(name));
          if (isProtected) {
            console.log(`\u26A0\uFE0F  Skipping protected process ${pid} (${processInfo}) on port ${port}`);
            continue;
          }
          console.log(`Killing process ${pid} (${processInfo}) on port ${port}`);
          await runCommand([
            "kill",
            "-9",
            pid
          ]);
        } catch (_error) {
        }
      }
    }
  } catch (_error) {
  }
}
async function cleanupExistingContainer() {
  try {
    const existing = await runCommand([
      "docker",
      "ps",
      "-a",
      "--filter",
      `name=${CONTAINER_NAME}`,
      "--format",
      "{{.Names}}"
    ]);
    if (existing.includes(CONTAINER_NAME)) {
      console.log(`Removing existing container: ${CONTAINER_NAME}`);
      await runCommand([
        "docker",
        "rm",
        "-f",
        CONTAINER_NAME
      ]);
    }
  } catch (_error) {
  }
}
async function imageExists(imageName) {
  try {
    await runCommand([
      "docker",
      "image",
      "inspect",
      imageName
    ]);
    return true;
  } catch {
    return false;
  }
}
async function buildCachedImage() {
  console.log("Building cached image with SSH and Docker pre-installed...");
  const setupScript = `apt update && apt install -y openssh-server ca-certificates curl gnupg && mkdir -p /run/sshd && echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && echo 'PermitEmptyPasswords yes' >> /etc/ssh/sshd_config && passwd -d root && systemctl enable ssh && install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list && apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && systemctl enable docker`;
  const tempContainerName = "vm-simulator-build-temp";
  try {
    await runCommand([
      "docker",
      "rm",
      "-f",
      tempContainerName
    ]);
  } catch {
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
    "jrei/systemd-debian:12"
  ]);
  console.log("Waiting for systemd to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3e3));
  console.log("Installing packages...");
  await runCommand([
    "docker",
    "exec",
    tempContainerName,
    "bash",
    "-c",
    setupScript
  ]);
  console.log("Creating cached image...");
  await runCommand([
    "docker",
    "commit",
    tempContainerName,
    CACHED_IMAGE_NAME
  ]);
  console.log("Cleaning up build container...");
  await runCommand([
    "docker",
    "rm",
    "-f",
    tempContainerName
  ]);
  console.log("\u2705 Cached image created successfully!");
}
async function main() {
  const args = Deno.args;
  if (args.length < 1) {
    console.error("Usage: deno run --allow-all mod.ts <path-to-copy> [...ports]");
    console.error("       deno run --allow-all mod.ts --build-cache  (build cached image)");
    console.error("       deno run --allow-all mod.ts --down         (stop and remove container)");
    Deno.exit(1);
  }
  if (args[0] === "--build-cache") {
    await buildCachedImage();
    return;
  }
  if (args[0] === "--down") {
    console.log("Stopping and removing container...");
    await cleanupExistingContainer();
    console.log("\u2705 Container removed");
    return;
  }
  const [localPath, ...ports] = args;
  const absolutePath = await Deno.realPath(localPath);
  for (const port of ports) {
    if (port === "22") {
      console.log("\u26A0\uFE0F  Skipping port 22 (reserved for SSH)");
      continue;
    }
    await killProcessOnPort(port);
  }
  await cleanupExistingContainer();
  const portMappings = ports.flatMap((port) => [
    "-p",
    `${port}:${port}`
  ]);
  const hasCachedImage = await imageExists(CACHED_IMAGE_NAME);
  if (!hasCachedImage) {
    console.log("\u26A0\uFE0F  Cached image not found. Building it now (this is a one-time setup)...");
    await buildCachedImage();
  }
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
    CACHED_IMAGE_NAME
  ];
  console.log(`Starting container with volume mounted from ${absolutePath}...`);
  const containerId = await runCommand(dockerCmd);
  console.log(`Container started: ${containerId.slice(0, 12)}`);
  console.log("Waiting for systemd to initialize...");
  await new Promise((resolve) => setTimeout(resolve, 3e3));
  console.log("Starting SSH and Docker services...");
  await runCommand([
    "docker",
    "exec",
    CONTAINER_NAME,
    "bash",
    "-c",
    "systemctl start ssh && systemctl start docker"
  ]);
  const sshCommand = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@localhost -p 22";
  const clipboardProcess = new Deno.Command("pbcopy", {
    stdin: "piped"
  });
  const child = clipboardProcess.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(sshCommand));
  await writer.close();
  await child.status;
  const mountedName = absolutePath.split("/").pop();
  console.log("\n\u2705 Container ready!");
  console.log(`\u{1F4CB} SSH command copied to clipboard: ${sshCommand}`);
  console.log(`\u{1F511} Passwordless login enabled`);
  console.log(`\u{1F4C2} Files mounted at: /root/${mountedName}`);
  console.log(`\u{1F4BE} Changes in container will reflect on host!`);
  if (ports.length > 0) {
    console.log(`\u{1F50C} Ports mapped: ${ports.join(", ")}`);
  }
}
main().catch((error) => {
  console.error("Error:", error.message);
  Deno.exit(1);
});
