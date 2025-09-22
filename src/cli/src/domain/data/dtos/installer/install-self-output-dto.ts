import "reflect-metadata";
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsArray,
  validate,
} from "class-validator";

export class InstallSelfOutputDto {
  @IsBoolean()
  success!: boolean;

  @IsString()
  installedPath!: string;

  @IsString()
  toolName!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];

  private constructor() {}

  static async create(data: unknown): Promise<InstallSelfOutputDto> {
    const dto = new InstallSelfOutputDto();
    Object.assign(dto, data);

    const errors = await validate(dto);
    if (errors.length > 0) {
      const errorMessages = errors
        .flatMap(error => Object.values(error.constraints || {}))
        .join("; ");
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    return dto;
  }

  static createUnsafe(data: Partial<InstallSelfOutputDto>): InstallSelfOutputDto {
    const dto = new InstallSelfOutputDto();
    Object.assign(dto, data);
    return dto;
  }
}