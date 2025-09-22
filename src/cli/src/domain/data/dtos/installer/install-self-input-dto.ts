import "reflect-metadata";
import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  validate,
} from "class-validator";
import { Type } from "class-transformer";

export class InstallSelfInputDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z][a-zA-Z0-9-_]*$/, {
    message: "Tool name must start with a letter and contain only letters, numbers, hyphens, and underscores",
  })
  toolName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\.ts$/, {
    message: "Entry point must be a TypeScript file (.ts)",
  })
  entryPoint!: string;

  @IsOptional()
  @IsString()
  installPath?: string;

  private constructor() {}

  static async create(data: unknown): Promise<InstallSelfInputDto> {
    const dto = new InstallSelfInputDto();

    // Ensure data is an object
    if (typeof data === 'object' && data !== null) {
      Object.assign(dto, data);
    }

    const errors = await validate(dto);
    if (errors.length > 0) {
      const errorMessages = errors
        .flatMap(error => Object.values(error.constraints || {}))
        .join("; ");
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    return dto;
  }

  static createUnsafe(data: Partial<InstallSelfInputDto>): InstallSelfInputDto {
    const dto = new InstallSelfInputDto();
    Object.assign(dto, data);
    return dto;
  }
}