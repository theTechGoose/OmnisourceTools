function isString(v: any): v is string {
  return typeof v === "string";
}

function isArray(v: any): v is any[] {
  return Array.isArray(v);
}

function isObject(v: any): v is Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v);
}

function isFileSpec(v: any): v is string {
  return isString(v) && !v.startsWith("#") && !v.startsWith("@");
}

function fileExt(filename: string): string {
  return filename.split(".").slice(1).join(".") || "";
}

function pathJoin(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}

function tagToName(tag: string): string {
  return tag.startsWith("#") || tag.startsWith("@") ? tag.slice(1) : tag;
}

type DirSnapshot = { files: Set<string>; dirs: Set<string> };

function filesThatMatchExplicitFileSpec(
  key: string,
  spec: string,
  snapshot: DirSnapshot,
): string[] {
  const keyArr = key.split("?").reverse();
  const fname = `${keyArr[0]}.${spec}`;
  const filesThatExist = snapshot.files.has(fname) ? [fname] : [];
  if (keyArr.length > 1) return [fname];
  return filesThatExist;
}

function isPureFileArray(arr: string[]): boolean {
  return arr.every(
    (x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"),
  );
}

function filesThatMatchExplicitFileArray(
  key: string,
  arr: string[],
  snapshot: DirSnapshot,
): string[] {
  const exts = arr.filter(
    (x) => isString(x) && !x.startsWith("#") && !x.startsWith("@"),
  );
  return exts.map((e) => `${key}.${e}`).filter((f) => snapshot.files.has(f));
}

export {
  isString,
  isArray,
  isObject,
  isFileSpec,
  fileExt,
  pathJoin,
  tagToName,
  filesThatMatchExplicitFileSpec,
  isPureFileArray,
  filesThatMatchExplicitFileArray,
};
export type { DirSnapshot };

