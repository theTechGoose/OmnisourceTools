async function scanDirectory(path: string) {
  const name = path.split("/").pop() || "";
  console.log("Scanning:", path, "Name:", name);

  try {
    const stat = await Deno.stat(path);
    console.log("Stat result:", { isFile: stat.isFile, isDirectory: stat.isDirectory });

    if (stat.isFile) {
      console.log("Detected as file");
      const parts = name.split(".");
      const extension = parts.length > 1 ? parts.slice(1).join(".") : undefined;
      return {
        type: "file",
        name: parts[0],
        extension,
      };
    }

    if (stat.isDirectory) {
      console.log("Detected as directory");
      return {
        type: "directory",
        name,
        children: new Map(),
      };
    }

    return {
      type: "file",
      name,
    };
  } catch (error) {
    console.log("Error:", error);
    return {
      type: "file",
      name,
    };
  }
}

const result = await scanDirectory("/Users/raphaelcastro/Documents/programming/OmniSource/src/libs/core/src");
console.log("Result:", result);
