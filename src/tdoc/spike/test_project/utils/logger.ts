
/**
 * @lib/transcription
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
