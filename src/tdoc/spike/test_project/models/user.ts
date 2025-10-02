
import { z } from "npm:zod@3.22.4";
import type { ZodType } from "npm:zod@3.22.4";

export interface User {
  id: string;
  name: string;
  age: number;
}

export const userSchema: ZodType = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().min(0).max(120),
});

export function createUser(data: unknown): User {
  return userSchema.parse(data) as User;
}

export function updateUser(user: User, updates: Partial<User>): User {
  return { ...user, ...updates };
}

// Re-export from another module
export { formatDate } from "../utils/date.ts";
