import { InstallSelfInputDto, InstallSelfOutputDto } from "@dtos/install-self/mod.ts";
import { InstallSelfService } from "@business/install-self/mod.ts";
import { InstallSelfDataService } from "@services/install-self/mod.ts";

export class InstallSelfRoute {
  private constructor(
    private readonly businessService: InstallSelfService,
    private readonly dataService: InstallSelfDataService
  ) {}

  private static instance: InstallSelfRoute;

  static getInstance(): InstallSelfRoute {
    if (!InstallSelfRoute.instance) {
      const businessService = InstallSelfService.getInstance();
      const dataService = InstallSelfDataService.getInstance();
      InstallSelfRoute.instance = new InstallSelfRoute(businessService, dataService);
    }
    return InstallSelfRoute.instance;
  }

  static createWithDependencies(
    businessService: InstallSelfService,
    dataService: InstallSelfDataService
  ): InstallSelfRoute {
    return new InstallSelfRoute(businessService, dataService);
  }

  async execute(input: unknown): Promise<InstallSelfOutputDto> {
    try {
      const inputDto = await InstallSelfInputDto.create(input);

      const nameValidation = this.businessService.validateToolName(inputDto.toolName);
      const entryValidation = this.businessService.validateEntryPoint(inputDto.entryPoint);

      const allWarnings = [
        ...nameValidation.warnings,
        ...entryValidation.warnings,
      ];

      if (!nameValidation.isValid || !entryValidation.isValid) {
        const allErrors = [
          ...nameValidation.errors,
          ...entryValidation.errors,
        ];

        return await InstallSelfOutputDto.create({
          success: false,
          installedPath: "",
          toolName: inputDto.toolName,
          message: `Validation failed: ${allErrors.join("; ")}`,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        });
      }

      const entryExists = await this.dataService.checkEntryPointExists(inputDto.entryPoint);
      if (!entryExists) {
        return await InstallSelfOutputDto.create({
          success: false,
          installedPath: "",
          toolName: inputDto.toolName,
          message: `Entry point file not found: ${inputDto.entryPoint}`,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        });
      }

      console.log("⚡ === OMNISOURCE TOOL FORGE === ⚡");
      console.log(`🔨 Forging: ${inputDto.toolName}`);
      console.log(`📜 Source: ${inputDto.entryPoint}`);
      console.log("");

      console.log("🔥 Bundling TypeScript into executable...");
      const bundledCode = await this.dataService.bundleTypeScript(inputDto.entryPoint);

      const command = this.businessService.generateInstallCommand(
        inputDto.toolName,
        inputDto.entryPoint,
        inputDto.installPath
      );

      console.log("⚙️  Setting execution permissions...");
      await this.dataService.createExecutableFile(
        command.outputPath,
        command.shebang,
        bundledCode
      );

      console.log(`🚀 Deploying to ${command.installPath}...`);
      await this.dataService.installTool(command.outputPath, command.installPath);

      const successMessage = this.businessService.formatSuccessMessage(
        inputDto.toolName,
        command.installPath
      );
      console.log(successMessage);

      console.log("💪 Another tool forged in the OmniSource crucible!");

      return await InstallSelfOutputDto.create({
        success: true,
        installedPath: command.installPath,
        toolName: inputDto.toolName,
        message: "Tool installed successfully",
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return InstallSelfOutputDto.createUnsafe({
        success: false,
        installedPath: "",
        toolName: (input as any)?.toolName || "unknown",
        message: `Installation failed: ${errorMessage}`,
      });
    }
  }
}