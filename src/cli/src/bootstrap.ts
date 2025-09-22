#!/usr/bin/env deno run -A

import "reflect-metadata";
import { Command } from "cliffy/command";
import { InstallSelfRoute } from "@routes/installer/mod.ts";

const main = async () => {
  const cli = new Command()
    .name("omni-cli")
    .version("0.0.1")
    .description("OmniSource CLI - Forge Your Tools Into Reality")
    .globalOption("-v, --verbose", "Enable verbose output");

  cli
    .command("install-self <tool-name> [entry-point]")
    .description("Install a TypeScript tool as an executable")
    .option("-p, --path <path:string>", "Custom installation path (default: ~/.local/bin)")
    .example("Install with default entry", "omni-cli install-self my-tool")
    .example("Install with custom entry", "omni-cli install-self my-tool src/main.ts")
    .example("Install to custom path", "omni-cli install-self my-tool main.ts --path /usr/local/bin")
    .action(async (options: { path?: string }, toolName: string, entryPoint: string = "bootstrap.ts") => {
      try {
        const route = InstallSelfRoute.getInstance();
        const result = await route.execute({
          toolName,
          entryPoint,
          installPath: options.path,
        });

        if (!result.success) {
          console.error(`❌ ${result.message}`);
          if (result.warnings && result.warnings.length > 0) {
            console.warn("⚠️  Warnings:");
            result.warnings.forEach(warning => console.warn(`   - ${warning}`));
          }
          Deno.exit(1);
        }

        if (result.warnings && result.warnings.length > 0) {
          console.warn("\n⚠️  Warnings:");
          result.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }

      } catch (error) {
        console.error("❌ Unexpected error:", error);
        Deno.exit(1);
      }
    });

  cli
    .command("build <tool-name> [entry-point]")
    .description("Build a tool without installing (creates exe.js)")
    .action(async (_options: {}, toolName: string, entryPoint: string = "bootstrap.ts") => {
      console.log("🔨 Building tool locally...");
      console.log(`   Tool: ${toolName}`);
      console.log(`   Entry: ${entryPoint}`);
      console.log("\n⚠️  This command is not yet implemented.");
      console.log("   Use 'install-self' to build and install.");
    });

  cli
    .command("list")
    .description("List installed OmniSource tools")
    .action(() => {
      console.log("📋 Listing installed tools...");
      console.log("\n⚠️  This command is not yet implemented.");
      console.log("   Check ~/.local/bin for installed tools.");
    });

  await cli.parse(Deno.args);
};

if (import.meta.main) {
  await main();
}