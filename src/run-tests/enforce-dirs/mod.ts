import type { IssueResponse } from "../utils/mod.ts";
import { validateStructure } from "./validate.ts";

/**
 * Enforce directory structure validation
 * @param rootDir The root directory to validate (typically from getRoot())
 * @returns IssueResponse with validation results
 */
export async function enforceStructure(rootDir: string): Promise<IssueResponse> {
  try {
    // Call the validate function with the root directory
    const result = await validateStructure(rootDir);

    // Update the name to match the pattern used by other enforcers
    return {
      ...result,
      name: "structure",
      message: result.message || "Directory structure validation complete"
    };
  } catch (error) {
    // Handle any errors and return in the expected format
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: "structure",
      issues: [{
        issue: `Structure validation error: ${errorMessage}`,
        location: rootDir
      }],
      message: `Failed to validate directory structure: ${errorMessage}`
    };
  }
}

// Re-export the main validation function for direct use if needed
export { validateStructure } from "./validate.ts";