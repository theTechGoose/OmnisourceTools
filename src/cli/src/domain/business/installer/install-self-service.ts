export interface InstallCommand {
  readonly toolName: string;
  readonly entryPoint: string;
  readonly outputPath: string;
  readonly installPath: string;
  readonly shebang: string;
}

export interface InstallValidation {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export class InstallSelfService {
  private constructor() {}

  private static instance: InstallSelfService;

  static getInstance(): InstallSelfService {
    if (!InstallSelfService.instance) {
      InstallSelfService.instance = new InstallSelfService();
    }
    return InstallSelfService.instance;
  }

  generateInstallCommand(
    toolName: string,
    entryPoint: string,
    installPath?: string
  ): InstallCommand {
    const home = Deno.env.get("HOME") || "/tmp";
    const defaultInstallPath = `${home}/.local/bin`;
    const finalInstallPath = installPath || defaultInstallPath;

    return {
      toolName,
      entryPoint,
      outputPath: "exe.js",
      installPath: `${finalInstallPath}/${toolName}`,
      shebang: "#!/usr/bin/env deno run -A",
    };
  }

  validateToolName(toolName: string): InstallValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!toolName || toolName.length === 0) {
      errors.push("Tool name cannot be empty");
    }

    if (toolName.length > 50) {
      errors.push("Tool name cannot exceed 50 characters");
    }

    if (!/^[a-zA-Z]/.test(toolName)) {
      errors.push("Tool name must start with a letter");
    }

    if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(toolName)) {
      errors.push("Tool name can only contain letters, numbers, hyphens, and underscores");
    }

    if (toolName.includes("--")) {
      warnings.push("Tool name contains double hyphens which may cause command parsing issues");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateEntryPoint(entryPoint: string): InstallValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!entryPoint || entryPoint.length === 0) {
      errors.push("Entry point cannot be empty");
    }

    if (!entryPoint.endsWith(".ts")) {
      errors.push("Entry point must be a TypeScript file (.ts)");
    }

    if (entryPoint.startsWith("/")) {
      warnings.push("Entry point is an absolute path, consider using relative paths");
    }

    if (entryPoint.includes("..")) {
      warnings.push("Entry point contains parent directory references");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  generateBundleCommand(entryPoint: string): string {
    return `deno bundle "${entryPoint}"`;
  }

  generateShebangScript(shebang: string, bundledCode: string): string {
    return `${shebang}\n${bundledCode}`;
  }

  formatSuccessMessage(toolName: string, installPath: string): string {
    return `
╔════════════════════════════════════════════════════════════════╗
║                  🌟 BUILD SUCCESSFUL! 🌟                      ║
╠════════════════════════════════════════════════════════════════╣
║  Tool Name: ${toolName.padEnd(50)}║
║  Installed: ${installPath.padEnd(50)}║
╠════════════════════════════════════════════════════════════════╣
║  Pro Tips:                                                    ║
║  • Ensure ~/.local/bin is in your PATH                        ║
║  • Run '${toolName} --help' for usage info                    ║
╚════════════════════════════════════════════════════════════════╝
`;
  }

  parseInstallPath(installPath: string): { dir: string; file: string } {
    const lastSlash = installPath.lastIndexOf("/");
    if (lastSlash === -1) {
      return { dir: ".", file: installPath };
    }
    return {
      dir: installPath.substring(0, lastSlash),
      file: installPath.substring(lastSlash + 1),
    };
  }
}