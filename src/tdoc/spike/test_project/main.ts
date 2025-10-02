
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
 * @lib/recordings
 */

import { User, createUser, updateUser } from "./models/user.ts";
import { validateData } from "./utils/validator.ts";
import { logger } from "./utils/logger.ts";

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

export { User, createUser } from "./models/user.ts";
export type { UserSchema } from "./utils/validator.ts";
