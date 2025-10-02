
import type { ZodType, ZodError } from "npm:zod@3.22.4";

export type UserSchema = ZodType<{
  id: string;
  name: string;
  age: number;
}>;

export async function validateData<T>(
  data: unknown,
  validator: (data: unknown) => T
): Promise<T> {
  try {
    return validator(data);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Validation failed:", error.message);
    }
    throw error;
  }
}

export * from "npm:zod@3.22.4";
