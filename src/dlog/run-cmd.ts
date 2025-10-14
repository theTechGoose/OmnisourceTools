// deno-lint-ignore-file no-explicit-any

// ---------- type coercers ----------
const returnTypes = {
  bool(stdOut: string, _stdErr: string) {
    const t = stdOut.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes" || t === "y") return true;
    if (t === "false" || t === "0" || t === "no" || t === "n") return false;
    return t.length > 0;
  },
  string(stdOut: string, _stdErr: string) {
    return stdOut;
  },
  number(stdOut: string, _stdErr: string) {
    const n = Number(stdOut.trim());
    if (Number.isNaN(n)) {
      throw new Error(`Could not parse number from: "${stdOut.trim()}"`);
    }
    return n;
  },
} as const;

type ReturnTypeKey = keyof typeof returnTypes;

const decoder = new TextDecoder();

// ---------- public API ----------
export async function runCmd(type: ReturnTypeKey, ...cmd: string[]) {
  const segments = splitPipeline(cmd);
  if (segments.length === 0) throw new Error("runCmd: no command provided");

  let out: Uint8Array;
  let err: Uint8Array;
  let code: number;

  if (segments.length === 1) {
    // one-off: spawn and mirror directly
    const command = runSimple("oneoff", 0, segments[0]);
    const child = command.spawn();

    const [stdoutBytes, stderrBytes, status] = await Promise.all([
      captureWithMirror(child.stdout, Deno.stdout.writable),
      captureWithMirror(child.stderr, Deno.stderr.writable),
      child.status,
    ]);

    out = stdoutBytes;
    err = stderrBytes;
    code = status.code;
  } else {
    // pipeline: mirror only the LAST stage (shell-like behavior)
    const res = await runPipe(segments, /*mirrorFinal*/ true);
    out = res.stdout;
    err = res.stderr;
    code = res.code;
  }

  const stdOut = decoder.decode(out);
  const stdErr = decoder.decode(err);

  if (code !== 0) {
    throw new Error(
      `Command exited with code ${code}\n\nstderr:\n${stdErr.trim()}`,
    );
  }

  const coerce = returnTypes[type];
  return coerce(stdOut, stdErr);
}

// ---------- internals ----------
function runSimple(mode: "pipe" | "oneoff", idx: number, cmd: string[]) {
  const [primary, ...args] = cmd;
  if (!primary) throw new Error("runSimple: empty command segment");

  return new Deno.Command(primary, {
    args,
    stdout: "piped",
    stderr: "piped",
    stdin: mode === "pipe" ? (idx > 0 ? "piped" : "inherit") : "inherit",
  });
}

async function runPipe(segments: string[][], mirrorFinal = true) {
  const firstCmd = runSimple("pipe", 0, segments[0]);
  let prev = firstCmd.spawn();

  const pipePromises: Promise<void>[] = [];
  for (let i = 1; i < segments.length; i++) {
    const cmd = runSimple("pipe", i, segments[i]);
    const child = cmd.spawn();

    if (!prev.stdout) throw new Error("Previous process has no stdout");
    if (!child.stdin) throw new Error("Next process has no stdin");

    // stream prev -> child as bytes flow (no buffering)
    pipePromises.push(prev.stdout.pipeTo(child.stdin));
    prev = child;
  }

  // prev is the LAST process
  await Promise.allSettled(pipePromises);

  const stdoutP = mirrorFinal
    ? captureWithMirror(prev.stdout, Deno.stdout.writable)
    : streamToBytes(prev.stdout);

  const stderrP = mirrorFinal
    ? captureWithMirror(prev.stderr, Deno.stderr.writable)
    : streamToBytes(prev.stderr);

  const [stdoutBytes, stderrBytes, status] = await Promise.all([
    stdoutP,
    stderrP,
    prev.status,
  ]);

  return {
    stdout: stdoutBytes,
    stderr: stderrBytes,
    code: status.code,
  };
}

/** turn a ReadableStream<Uint8Array> (or null) into bytes */
async function streamToBytes(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // concat
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

/** capture stream while mirroring to a writable (real-time) */
async function captureWithMirror(
  stream: ReadableStream<Uint8Array> | null,
  writable: WritableStream<Uint8Array>,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const [forMirror, forCollect] = stream.tee();
  // mirror to console; do not close Deno stdout/stderr
  const mirrorPump = forMirror
    .pipeTo(writable, { preventClose: true })
    .catch(() => {});
  const bytes = await streamToBytes(forCollect);
  await mirrorPump.catch(() => {});
  return bytes;
}

/**
 * Split tokens into pipeline segments by literal '|'
 * ["ps","aux","|","grep","deno","|","wc","-l"]
 * -> [["ps","aux"],["grep","deno"],["wc","-l"]]
 */
function splitPipeline(tokens: string[]): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];
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
