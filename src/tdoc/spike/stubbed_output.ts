// ============================================
// Verbose type stubs for external dependencies
// ============================================

// Stubs for npm:zod@3.22.4
declare const __z_STUB__: any; // Originally: z
const z = __z_STUB__;
type __ZodType_STUB__ = any; // Originally: ZodType (assumed type)
type ZodType = __ZodType_STUB__;
type __ZodSchema_STUB__ = any; // Originally: ZodSchema (assumed type)
type ZodSchema = __ZodSchema_STUB__;
type __ZodError_STUB__ = any; // Originally: ZodError
type ZodError = __ZodError_STUB__;

// Stubs for jsr:@std/assert@1.0.0
declare const __assertEquals_STUB__: any; // Originally: assertEquals
const assertEquals = __assertEquals_STUB__;





export interface User {
  name: string;
  age: number;
}

export function validateUser(data: unknown, schema: ZodType): User {
  return schema.parse(data);
}

export function handleError(error: ZodError) {
  console.log(error.errors);
}

export const userSchema: ZodSchema = z.object({
  name: z.string(),
  age: z.number(),
});

export function testEqual(a: any, b: any) {
  assertEquals(a, b);
}
