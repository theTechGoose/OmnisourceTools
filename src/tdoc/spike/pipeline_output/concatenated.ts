// ============================================
// Deno namespace declarations
// ============================================

declare namespace Deno {
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string, options?: { append?: boolean }): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export const env: {
    get(key: string): string | undefined;
  };
}

declare const crypto: {
  randomUUID(): string;
};

// ============================================
// Verbose type stubs for external dependencies
// ============================================

// Stubs for npm:zod@3.22.4
type __ZodType_STUB__ = any; // Originally: ZodType
type ZodType = __ZodType_STUB__;
type __ZodError_STUB__ = any; // Originally: ZodError
type ZodError = __ZodError_STUB__;
declare const __z _STUB__: any; // Originally: z 
const z  = __z _STUB__;
type __ZodType _STUB__ = any; // Originally: ZodType 
type ZodType  = __ZodType _STUB__;


// ============================================
// Source: utils/date.ts
// ============================================


export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

// ============================================
// Source: utils/validator.ts
// ============================================



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


// ============================================
// Source: utils/logger.ts
// ============================================


/**
 * ![pill](https://img.shields.io/badge/Lib-Transcription-26c6da)<br>
 * Logger utility for the application
 */

export const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  },
  error: (message: string) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }
};

// Using Deno APIs
export async function logToFile(message: string) {
  const logFile = "./app.log";
  await Deno.writeTextFile(logFile, message + "\n", { append: true });
}

// ============================================
// Source: models/user.ts
// ============================================



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
export { formatDate };
// ============================================
// Source: main.ts
// ============================================


/**
 * @packageDocumentation
 * # Test Project Documentation
 *
 * This is a test project to validate the full pipeline.
 *
 * ## Features
 * - User management
 * - Validation with Zod
 * - Utilities
 *
 * ![pill](https://img.shields.io/badge/Lib-Recordings-FF746C)<br>
 */

/**
 * @entrypoint
 * Main application class
 */
export class Application {
  private users: User[] = [];

  /**
   * Add a new user
   * @param name - User's name
   * @param age - User's age
   */
  async addUser(name: string, age: number): Promise<User> {
    const userData = { name, age, id: crypto.randomUUID() };
    const user = await validateData(userData, createUser);
    this.users.push(user);
    logger.info(`User added: ${user.id}`);
    return user;
  }

  /**
   * Get all users
   */
  getUsers(): User[] {
    return this.users;
  }
}

export { User, createUser };
export type { UserSchema };