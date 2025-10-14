#!/usr/bin/env deno run --no-check -A
// src/dlog/run-cmd.ts
var returnTypes = {
  bool(stdOut, _stdErr) {
    const t = stdOut.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes" || t === "y") return true;
    if (t === "false" || t === "0" || t === "no" || t === "n") return false;
    return t.length > 0;
  },
  string(stdOut, _stdErr) {
    return stdOut;
  },
  number(stdOut, _stdErr) {
    const n = Number(stdOut.trim());
    if (Number.isNaN(n)) {
      throw new Error(`Could not parse number from: "${stdOut.trim()}"`);
    }
    return n;
  }
};
var decoder = new TextDecoder();
async function runCmd(type, ...cmd) {
  const segments = splitPipeline(cmd);
  if (segments.length === 0) throw new Error("runCmd: no command provided");
  let out;
  let err;
  let code;
  if (segments.length === 1) {
    const command = runSimple("oneoff", 0, segments[0]);
    const child = command.spawn();
    const [stdoutBytes, stderrBytes, status] = await Promise.all([
      captureWithMirror(child.stdout, Deno.stdout.writable),
      captureWithMirror(child.stderr, Deno.stderr.writable),
      child.status
    ]);
    out = stdoutBytes;
    err = stderrBytes;
    code = status.code;
  } else {
    const res = await runPipe(
      segments,
      /*mirrorFinal*/
      true
    );
    out = res.stdout;
    err = res.stderr;
    code = res.code;
  }
  const stdOut = decoder.decode(out);
  const stdErr = decoder.decode(err);
  if (code !== 0) {
    throw new Error(`Command exited with code ${code}

stderr:
${stdErr.trim()}`);
  }
  const coerce = returnTypes[type];
  return coerce(stdOut, stdErr);
}
function runSimple(mode, idx, cmd) {
  const [primary, ...args] = cmd;
  if (!primary) throw new Error("runSimple: empty command segment");
  return new Deno.Command(primary, {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: mode === "pipe" ? idx > 0 ? "piped" : "inherit" : "inherit"
  });
}
async function runPipe(segments, mirrorFinal = true) {
  const firstCmd = runSimple("pipe", 0, segments[0]);
  let prev = firstCmd.spawn();
  const pipePromises = [];
  for (let i = 1; i < segments.length; i++) {
    const cmd = runSimple("pipe", i, segments[i]);
    const child = cmd.spawn();
    if (!prev.stdout) throw new Error("Previous process has no stdout");
    if (!child.stdin) throw new Error("Next process has no stdin");
    pipePromises.push(prev.stdout.pipeTo(child.stdin));
    prev = child;
  }
  await Promise.allSettled(pipePromises);
  const stdoutP = mirrorFinal ? captureWithMirror(prev.stdout, Deno.stdout.writable) : streamToBytes(prev.stdout);
  const stderrP = mirrorFinal ? captureWithMirror(prev.stderr, Deno.stderr.writable) : streamToBytes(prev.stderr);
  const [stdoutBytes, stderrBytes, status] = await Promise.all([
    stdoutP,
    stderrP,
    prev.status
  ]);
  return {
    stdout: stdoutBytes,
    stderr: stderrBytes,
    code: status.code
  };
}
async function streamToBytes(stream) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
async function captureWithMirror(stream, writable) {
  if (!stream) return new Uint8Array();
  const [forMirror, forCollect] = stream.tee();
  const mirrorPump = forMirror.pipeTo(writable, {
    preventClose: true
  }).catch(() => {
  });
  const bytes = await streamToBytes(forCollect);
  await mirrorPump.catch(() => {
  });
  return bytes;
}
function splitPipeline(tokens) {
  const segments = [];
  let current = [];
  for (const t of tokens) {
    if (t === "|") {
      if (current.length === 0) {
        throw new Error("Invalid pipeline: empty segment before '|'");
      }
      segments.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// src/dlog/config.json
var config_default = {
  name: "main",
  columns: [
    {
      id: "274255",
      name: "time",
      handlerTsCode: "(line: Message): CellHandler => {\n    return { text: line.json_content['time'] }\n}",
      idx: 1,
      width: 95
    },
    {
      id: "722778",
      name: "id",
      handlerTsCode: "(line: Message): CellHandler => {\n    return { text: line.json_content['id'] }\n}",
      idx: 4,
      width: 41
    },
    {
      id: "539791",
      name: "lvl",
      handlerTsCode: "(line: Message): CellHandler => {\n    return { text: line.json_content['lvl'] }\n}",
      idx: 2,
      width: 40
    },
    {
      id: "500030",
      name: "svc",
      handlerTsCode: "(line: Message): CellHandler => {\n    return { text: line.json_content['svc'] }\n}",
      idx: 5,
      width: 117
    },
    {
      id: "124886",
      name: "msg",
      handlerTsCode: "(line: Message): CellHandler => {\n    return { text: line.json_content['msg'] }\n}",
      idx: 3,
      width: 600
    }
  ],
  settings: {
    leftColWidth: 300,
    drawerColWidth: 480,
    maxMessages: 1e3,
    middlewares: [],
    entriesOrder: "desc",
    correlationIdField: "id",
    paintCorrelationIdCell: true
  }
};

// src/dlog/mod.ts
import { homedir } from "node:os";

// deno:https://jsr.io/@std/internal/1.0.10/_os.ts
function checkWindows() {
  const global = globalThis;
  const os = global.Deno?.build?.os;
  return typeof os === "string" ? os === "windows" : global.navigator?.platform?.startsWith("Win") ?? global.process?.platform?.startsWith("win") ?? false;
}

// deno:https://jsr.io/@std/internal/1.0.10/os.ts
var isWindows = checkWindows();

// deno:https://jsr.io/@std/path/1.1.2/_common/assert_path.ts
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string, received "${JSON.stringify(path)}"`);
  }
}

// deno:https://jsr.io/@std/path/1.1.2/_common/from_file_url.ts
function assertArg(url) {
  url = url instanceof URL ? url : new URL(url);
  if (url.protocol !== "file:") {
    throw new TypeError(`URL must be a file URL: received "${url.protocol}"`);
  }
  return url;
}

// deno:https://jsr.io/@std/path/1.1.2/posix/from_file_url.ts
function fromFileUrl(url) {
  url = assertArg(url);
  return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}

// deno:https://jsr.io/@std/path/1.1.2/_common/constants.ts
var CHAR_UPPERCASE_A = 65;
var CHAR_LOWERCASE_A = 97;
var CHAR_UPPERCASE_Z = 90;
var CHAR_LOWERCASE_Z = 122;
var CHAR_FORWARD_SLASH = 47;
var CHAR_BACKWARD_SLASH = 92;
var CHAR_COLON = 58;

// deno:https://jsr.io/@std/path/1.1.2/posix/_util.ts
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}

// deno:https://jsr.io/@std/path/1.1.2/windows/_util.ts
function isPosixPathSeparator2(code) {
  return code === CHAR_FORWARD_SLASH;
}
function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z;
}

// deno:https://jsr.io/@std/path/1.1.2/windows/from_file_url.ts
function fromFileUrl2(url) {
  url = assertArg(url);
  let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
  if (url.hostname !== "") {
    path = `\\\\${url.hostname}${path}`;
  }
  return path;
}

// deno:https://jsr.io/@std/fs/1.0.19/_get_file_info_type.ts
function getFileInfoType(fileInfo) {
  return fileInfo.isFile ? "file" : fileInfo.isDirectory ? "dir" : fileInfo.isSymlink ? "symlink" : void 0;
}

// deno:https://jsr.io/@std/fs/1.0.19/ensure_dir.ts
async function ensureDir(dir) {
  try {
    const fileInfo = await Deno.stat(dir);
    throwIfNotDirectory(fileInfo);
    return;
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }
  try {
    await Deno.mkdir(dir, {
      recursive: true
    });
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) {
      throw err;
    }
    const fileInfo = await Deno.stat(dir);
    throwIfNotDirectory(fileInfo);
  }
}
function throwIfNotDirectory(fileInfo) {
  if (!fileInfo.isDirectory) {
    throw new Error(`Failed to ensure directory exists: expected 'dir', got '${getFileInfoType(fileInfo)}'`);
  }
}

// deno:https://jsr.io/@std/path/1.1.2/_common/dirname.ts
function assertArg3(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://jsr.io/@std/path/1.1.2/_common/strip_trailing_separators.ts
function stripTrailingSeparators(segment, isSep) {
  if (segment.length <= 1) {
    return segment;
  }
  let end = segment.length;
  for (let i = segment.length - 1; i > 0; i--) {
    if (isSep(segment.charCodeAt(i))) {
      end = i;
    } else {
      break;
    }
  }
  return segment.slice(0, end);
}

// deno:https://jsr.io/@std/path/1.1.2/posix/dirname.ts
function dirname(path) {
  if (path instanceof URL) {
    path = fromFileUrl(path);
  }
  assertArg3(path);
  let end = -1;
  let matchedNonSeparator = false;
  for (let i = path.length - 1; i >= 1; --i) {
    if (isPosixPathSeparator(path.charCodeAt(i))) {
      if (matchedNonSeparator) {
        end = i;
        break;
      }
    } else {
      matchedNonSeparator = true;
    }
  }
  if (end === -1) {
    return isPosixPathSeparator(path.charCodeAt(0)) ? "/" : ".";
  }
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator);
}

// deno:https://jsr.io/@std/path/1.1.2/windows/dirname.ts
function dirname2(path) {
  if (path instanceof URL) {
    path = fromFileUrl2(path);
  }
  assertArg3(path);
  const len = path.length;
  let rootEnd = -1;
  let end = -1;
  let matchedSlash = true;
  let offset = 0;
  const code = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      rootEnd = offset = 1;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j === len) {
              return path;
            }
            if (j !== last) {
              rootEnd = offset = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        rootEnd = offset = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
        }
      }
    }
  } else if (isPathSeparator(code)) {
    return path;
  }
  for (let i = len - 1; i >= offset; --i) {
    if (isPathSeparator(path.charCodeAt(i))) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }
  if (end === -1) {
    if (rootEnd === -1) return ".";
    else end = rootEnd;
  }
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator2);
}

// deno:https://jsr.io/@std/path/1.1.2/dirname.ts
function dirname3(path) {
  return isWindows ? dirname2(path) : dirname(path);
}

// deno:https://jsr.io/@std/fs/1.0.19/exists.ts
async function exists(path, options) {
  try {
    const stat = await Deno.stat(path);
    if (options && (options.isReadable || options.isDirectory || options.isFile)) {
      if (options.isDirectory && options.isFile) {
        throw new TypeError("ExistsOptions.options.isDirectory and ExistsOptions.options.isFile must not be true together");
      }
      if (options.isDirectory && !stat.isDirectory || options.isFile && !stat.isFile) {
        return false;
      }
      if (options.isReadable) {
        return fileIsReadable(stat);
      }
    }
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    if (error instanceof Deno.errors.PermissionDenied) {
      if ((await Deno.permissions.query({
        name: "read",
        path
      })).state === "granted") {
        return !options?.isReadable;
      }
    }
    throw error;
  }
}
function fileIsReadable(stat) {
  if (stat.mode === null) {
    return true;
  } else if (Deno.uid() === stat.uid) {
    return (stat.mode & 256) === 256;
  } else if (Deno.gid() === stat.gid) {
    return (stat.mode & 32) === 32;
  }
  return (stat.mode & 4) === 4;
}

// deno:https://jsr.io/@std/fs/1.0.19/move.ts
var EXISTS_ERROR = new Deno.errors.AlreadyExists("dest already exists.");

// deno:https://jsr.io/@std/fs/1.0.19/eol.ts
var LF = "\n";
var CRLF = "\r\n";
var EOL = globalThis.Deno?.build.os === "windows" ? CRLF : LF;

// src/dlog/mod.ts
async function main() {
  const configPath = await prep();
  const denoCmd = [
    `deno`,
    ...Deno.args
  ];
  const logdyCmd = [
    "logdy",
    "--config",
    configPath,
    "--port=9501"
  ];
  await runCmd("string", ...denoCmd, "|", ...logdyCmd);
}
async function prep() {
  await ensureLogdyInstalled();
  const configPath = `${homedir()}/.config/logdy/config.json`;
  await ensureConfigAsync(configPath, config_default);
  return configPath;
}
function ensureSudo() {
  if (Deno.uid() === 0) return;
  throw new Error("The first run must be run as root (sudo) to install Logdy.");
}
async function ensureConfigAsync(configPath, cfg) {
  if (await exists(configPath)) return;
  const dir = dirname3(configPath);
  await ensureDir(dir);
  if (!await exists(configPath)) {
    await Deno.writeTextFile(configPath, JSON.stringify(cfg, null, 2));
    console.log(`Created default Logdy config at ${configPath}`);
  }
}
async function ensureLogdyInstalled() {
  const logdyExists = await runCmd("bool", "command", "-v", "logdy");
  if (logdyExists) return;
  ensureSudo();
  console.log("Logdy is not installed. Installing...");
  await runCmd("string", "curl", "https://logdy.dev/install.sh", "|", "sh");
}
main();
export {
  ensureConfigAsync
};
