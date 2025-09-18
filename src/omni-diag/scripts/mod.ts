export function getSetupScriptPath(): string {
  return new URL("./setup.sh", import.meta.url).pathname;
}