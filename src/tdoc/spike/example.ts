// Simple example file that imports from external sources
import { z } from "npm:zod@3.22.4";
import { assertEquals } from "jsr:@std/assert@1.0.0";

// Use the imports
export const userSchema = z.object({
  name: z.string(),
  age: z.number(),
});

export type User = z.infer<typeof userSchema>;

export function validateUser(data: unknown): User {
  return userSchema.parse(data);
}

export function testEqual(a: any, b: any) {
  assertEquals(a, b);
}