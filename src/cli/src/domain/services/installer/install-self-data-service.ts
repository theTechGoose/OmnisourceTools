import type { InstallCommand } from "@business/install-self/install-self-service.ts";

export interface FileSystemOperations {
  exists(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
}

export interface ProcessOperations {
  runCommand(command: string[]): Promise<{ success: boolean; output: string; error: string }>;
}

export class InstallSelfDataService {
  private constructor(
    private readonly fs: FileSystemOperations,
    private readonly process: ProcessOperations
  ) {}

  private static instance: InstallSelfDataService;

  static getInstance(): InstallSelfDataService {
    if (!InstallSelfDataService.instance) {
      const fs = new DenoFileSystemOperations();
      const process = new DenoProcessOperations();
      InstallSelfDataService.instance = new InstallSelfDataService(fs, process);
    }
    return InstallSelfDataService.instance;
  }

  static createWithDependencies(
    fs: FileSystemOperations,
    process: ProcessOperations
  ): InstallSelfDataService {
    return new InstallSelfDataService(fs, process);
  }

  async checkEntryPointExists(entryPoint: string): Promise<boolean> {
    try {
      return await this.fs.exists(entryPoint);
    } catch {
      return false;
    }
  }

  async bundleTypeScript(entryPoint: string): Promise<string> {
    const result = await this.process.runCommand([
      "deno",
      "bundle",
      entryPoint,
    ]);

    if (!result.success) {
      throw new Error(`Failed to bundle TypeScript: ${result.error}`);
    }

    return result.output;
  }

  async createExecutableFile(
    path: string,
    shebang: string,
    content: string
  ): Promise<void> {
    const executableContent = `${shebang}\n${content}`;
    await this.fs.writeTextFile(path, executableContent);
    await this.fs.chmod(path, 0o755);
  }

  async ensureDirectoryExists(path: string): Promise<void> {
    await this.fs.mkdir(path, { recursive: true });
  }

  async installTool(source: string, destination: string): Promise<void> {
    const { dir } = this.parsePath(destination);
    await this.ensureDirectoryExists(dir);
    await this.fs.copyFile(source, destination);
  }

  async checkToolExists(path: string): Promise<boolean> {
    return await this.fs.exists(path);
  }

  private parsePath(path: string): { dir: string; file: string } {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) {
      return { dir: ".", file: path };
    }
    return {
      dir: path.substring(0, lastSlash),
      file: path.substring(lastSlash + 1),
    };
  }
}

class DenoFileSystemOperations implements FileSystemOperations {
  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await Deno.writeTextFile(path, content);
  }

  async chmod(path: string, mode: number): Promise<void> {
    await Deno.chmod(path, mode);
  }

  async mkdir(path: string, options?: { recursive: boolean }): Promise<void> {
    await Deno.mkdir(path, options);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    await Deno.copyFile(source, destination);
  }
}

class DenoProcessOperations implements ProcessOperations {
  async runCommand(
    command: string[]
  ): Promise<{ success: boolean; output: string; error: string }> {
    const cmd = new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: "piped",
      stderr: "piped",
    });

    const { success, stdout, stderr } = await cmd.output();

    return {
      success,
      output: new TextDecoder().decode(stdout),
      error: new TextDecoder().decode(stderr),
    };
  }
}