#!/usr/bin/env deno run --no-check -A
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// deno:https://deno.land/std@0.221.0/fmt/colors.ts
var { Deno: Deno2 } = globalThis;
var noColor = typeof Deno2?.noColor === "boolean" ? Deno2.noColor : false;
var enabled = !noColor;
function code(open, close) {
  return {
    open: `\x1B[${open.join(";")}m`,
    close: `\x1B[${close}m`,
    regexp: new RegExp(`\\x1b\\[${close}m`, "g")
  };
}
function run(str, code2) {
  return enabled ? `${code2.open}${str.replace(code2.regexp, code2.open)}${code2.close}` : str;
}
function bold(str) {
  return run(str, code([
    1
  ], 22));
}
function dim(str) {
  return run(str, code([
    2
  ], 22));
}
function italic(str) {
  return run(str, code([
    3
  ], 23));
}
function underline(str) {
  return run(str, code([
    4
  ], 24));
}
function red(str) {
  return run(str, code([
    31
  ], 39));
}
function green(str) {
  return run(str, code([
    32
  ], 39));
}
function yellow(str) {
  return run(str, code([
    33
  ], 39));
}
function brightBlue(str) {
  return run(str, code([
    94
  ], 39));
}
var ANSI_PATTERN = new RegExp([
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TXZcf-nq-uy=><~]))"
].join("|"), "g");
function stripAnsiCode(string) {
  return string.replace(ANSI_PATTERN, "");
}

// deno:https://deno.land/std@0.221.0/path/_common/assert_path.ts
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
  }
}

// deno:https://deno.land/std@0.221.0/path/_common/constants.ts
var CHAR_UPPERCASE_A = 65;
var CHAR_LOWERCASE_A = 97;
var CHAR_UPPERCASE_Z = 90;
var CHAR_LOWERCASE_Z = 122;
var CHAR_DOT = 46;
var CHAR_FORWARD_SLASH = 47;
var CHAR_BACKWARD_SLASH = 92;
var CHAR_COLON = 58;

// deno:https://deno.land/std@0.221.0/path/_common/strip_trailing_separators.ts
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

// deno:https://deno.land/std@0.221.0/path/windows/_util.ts
function isPosixPathSeparator(code2) {
  return code2 === CHAR_FORWARD_SLASH;
}
function isPathSeparator(code2) {
  return code2 === CHAR_FORWARD_SLASH || code2 === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code2) {
  return code2 >= CHAR_LOWERCASE_A && code2 <= CHAR_LOWERCASE_Z || code2 >= CHAR_UPPERCASE_A && code2 <= CHAR_UPPERCASE_Z;
}

// deno:https://deno.land/std@0.221.0/path/_common/dirname.ts
function assertArg(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://deno.land/std@0.221.0/path/windows/dirname.ts
function dirname(path) {
  assertArg(path);
  const len = path.length;
  let rootEnd = -1;
  let end = -1;
  let matchedSlash = true;
  let offset = 0;
  const code2 = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code2)) {
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
    } else if (isWindowsDeviceRoot(code2)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        rootEnd = offset = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
        }
      }
    }
  } else if (isPathSeparator(code2)) {
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
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator);
}

// deno:https://deno.land/std@0.221.0/assert/assertion_error.ts
var AssertionError = class extends Error {
  /** Constructs a new instance. */
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }
};

// deno:https://deno.land/std@0.221.0/assert/assert.ts
function assert(expr, msg = "") {
  if (!expr) {
    throw new AssertionError(msg);
  }
}

// deno:https://deno.land/std@0.221.0/path/_common/normalize.ts
function assertArg4(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://deno.land/std@0.221.0/path/_common/normalize_string.ts
function normalizeString(path, allowAboveRoot, separator, isPathSeparator2) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code2;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code2 = path.charCodeAt(i);
    else if (isPathSeparator2(code2)) break;
    else code2 = CHAR_FORWARD_SLASH;
    if (isPathSeparator2(code2)) {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += `${separator}..`;
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code2 === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

// deno:https://deno.land/std@0.221.0/path/windows/normalize.ts
function normalize(path) {
  assertArg4(path);
  const len = path.length;
  let rootEnd = 0;
  let device;
  let isAbsolute3 = false;
  const code2 = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code2)) {
      isAbsolute3 = true;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          const firstPart = path.slice(last, j);
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
              return `\\\\${firstPart}\\${path.slice(last)}\\`;
            } else if (j !== last) {
              device = `\\\\${firstPart}\\${path.slice(last, j)}`;
              rootEnd = j;
            }
          }
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code2)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        device = path.slice(0, 2);
        rootEnd = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) {
            isAbsolute3 = true;
            rootEnd = 3;
          }
        }
      }
    }
  } else if (isPathSeparator(code2)) {
    return "\\";
  }
  let tail;
  if (rootEnd < len) {
    tail = normalizeString(path.slice(rootEnd), !isAbsolute3, "\\", isPathSeparator);
  } else {
    tail = "";
  }
  if (tail.length === 0 && !isAbsolute3) tail = ".";
  if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
    tail += "\\";
  }
  if (device === void 0) {
    if (isAbsolute3) {
      if (tail.length > 0) return `\\${tail}`;
      else return "\\";
    } else if (tail.length > 0) {
      return tail;
    } else {
      return "";
    }
  } else if (isAbsolute3) {
    if (tail.length > 0) return `${device}\\${tail}`;
    else return `${device}\\`;
  } else if (tail.length > 0) {
    return device + tail;
  } else {
    return device;
  }
}

// deno:https://deno.land/std@0.221.0/path/windows/join.ts
function join(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  let firstPart = null;
  for (let i = 0; i < paths.length; ++i) {
    const path = paths[i];
    assertPath(path);
    if (path.length > 0) {
      if (joined === void 0) joined = firstPart = path;
      else joined += `\\${path}`;
    }
  }
  if (joined === void 0) return ".";
  let needsReplace = true;
  let slashCount = 0;
  assert(firstPart !== null);
  if (isPathSeparator(firstPart.charCodeAt(0))) {
    ++slashCount;
    const firstLen = firstPart.length;
    if (firstLen > 1) {
      if (isPathSeparator(firstPart.charCodeAt(1))) {
        ++slashCount;
        if (firstLen > 2) {
          if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
          else {
            needsReplace = false;
          }
        }
      }
    }
  }
  if (needsReplace) {
    for (; slashCount < joined.length; ++slashCount) {
      if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
    }
    if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
  }
  return normalize(joined);
}

// deno:https://deno.land/std@0.221.0/path/posix/_util.ts
function isPosixPathSeparator2(code2) {
  return code2 === CHAR_FORWARD_SLASH;
}

// deno:https://deno.land/std@0.221.0/path/posix/dirname.ts
function dirname2(path) {
  assertArg(path);
  let end = -1;
  let matchedNonSeparator = false;
  for (let i = path.length - 1; i >= 1; --i) {
    if (isPosixPathSeparator2(path.charCodeAt(i))) {
      if (matchedNonSeparator) {
        end = i;
        break;
      }
    } else {
      matchedNonSeparator = true;
    }
  }
  if (end === -1) {
    return isPosixPathSeparator2(path.charCodeAt(0)) ? "/" : ".";
  }
  return stripTrailingSeparators(path.slice(0, end), isPosixPathSeparator2);
}

// deno:https://deno.land/std@0.221.0/path/posix/normalize.ts
function normalize2(path) {
  assertArg4(path);
  const isAbsolute3 = isPosixPathSeparator2(path.charCodeAt(0));
  const trailingSeparator = isPosixPathSeparator2(path.charCodeAt(path.length - 1));
  path = normalizeString(path, !isAbsolute3, "/", isPosixPathSeparator2);
  if (path.length === 0 && !isAbsolute3) path = ".";
  if (path.length > 0 && trailingSeparator) path += "/";
  if (isAbsolute3) return `/${path}`;
  return path;
}

// deno:https://deno.land/std@0.221.0/path/posix/join.ts
function join2(...paths) {
  if (paths.length === 0) return ".";
  let joined;
  for (let i = 0; i < paths.length; ++i) {
    const path = paths[i];
    assertPath(path);
    if (path.length > 0) {
      if (!joined) joined = path;
      else joined += `/${path}`;
    }
  }
  if (!joined) return ".";
  return normalize2(joined);
}

// deno:https://deno.land/std@0.221.0/path/_os.ts
var osType = (() => {
  const { Deno: Deno3 } = globalThis;
  if (typeof Deno3?.build?.os === "string") {
    return Deno3.build.os;
  }
  const { navigator } = globalThis;
  if (navigator?.appVersion?.includes?.("Win")) {
    return "windows";
  }
  return "linux";
})();
var isWindows = osType === "windows";

// deno:https://deno.land/std@0.221.0/path/dirname.ts
function dirname3(path) {
  return isWindows ? dirname(path) : dirname2(path);
}

// deno:https://deno.land/std@0.221.0/path/join.ts
function join3(...paths) {
  return isWindows ? join(...paths) : join2(...paths);
}

// deno:https://deno.land/std@0.221.0/path/normalize.ts
function normalize3(path) {
  return isWindows ? normalize(path) : normalize2(path);
}

// deno:https://deno.land/std@0.221.0/text/levenshtein_distance.ts
function levenshteinDistance(str1, str2) {
  if (str1.length > str2.length) {
    [str1, str2] = [
      str2,
      str1
    ];
  }
  let distances = Array.from({
    length: str1.length + 1
  }, (_, i) => +i);
  for (let str2Index = 0; str2Index < str2.length; str2Index++) {
    const tempDistances = [
      str2Index + 1
    ];
    for (let str1Index = 0; str1Index < str1.length; str1Index++) {
      const char1 = str1[str1Index];
      const char2 = str2[str2Index];
      if (char1 === char2) {
        tempDistances.push(distances[str1Index]);
      } else {
        tempDistances.push(1 + Math.min(distances[str1Index], distances[str1Index + 1], tempDistances.at(-1)));
      }
    }
    distances = tempDistances;
  }
  return distances.at(-1);
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/_figures.ts
var main = {
  ARROW_UP: "\u2191",
  ARROW_DOWN: "\u2193",
  ARROW_LEFT: "\u2190",
  ARROW_RIGHT: "\u2192",
  ARROW_UP_LEFT: "\u2196",
  ARROW_UP_RIGHT: "\u2197",
  ARROW_DOWN_RIGHT: "\u2198",
  ARROW_DOWN_LEFT: "\u2199",
  RADIO_ON: "\u25C9",
  RADIO_OFF: "\u25EF",
  TICK: "\u2714",
  CROSS: "\u2718",
  ELLIPSIS: "\u2026",
  POINTER_SMALL: "\u203A",
  POINTER_SMALL_LEFT: "\u2039",
  LINE: "\u2500",
  POINTER: "\u276F",
  POINTER_LEFT: "\u276E",
  INFO: "\u2139",
  TAB_LEFT: "\u21E4",
  TAB_RIGHT: "\u21E5",
  ESCAPE: "\u238B",
  BACKSPACE: "\u232B",
  PAGE_UP: "\u21DE",
  PAGE_DOWN: "\u21DF",
  ENTER: "\u21B5",
  SEARCH: "\u{1F50E}",
  FOLDER: "\u{1F4C1}",
  FOLDER_OPEN: "\u{1F4C2}"
};
var win = {
  ...main,
  RADIO_ON: "(*)",
  RADIO_OFF: "( )",
  TICK: "\u221A",
  CROSS: "\xD7",
  POINTER_SMALL: "\xBB"
};
var Figures = Deno.build.os === "windows" ? win : main;
var keyMap = {
  up: "ARROW_UP",
  down: "ARROW_DOWN",
  left: "ARROW_LEFT",
  right: "ARROW_RIGHT",
  pageup: "PAGE_UP",
  pagedown: "PAGE_DOWN",
  tab: "TAB_RIGHT",
  enter: "ENTER",
  return: "ENTER"
};
function getFiguresByKeys(keys) {
  const figures = [];
  for (const key of keys) {
    const figure = Figures[keyMap[key]] ?? key;
    if (!figures.includes(figure)) {
      figures.push(figure);
    }
  }
  return figures;
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/ansi/ansi_escapes.ts
var ansi_escapes_exports = {};
__export(ansi_escapes_exports, {
  bel: () => bel,
  clearScreen: () => clearScreen,
  clearTerminal: () => clearTerminal,
  cursorBackward: () => cursorBackward,
  cursorDown: () => cursorDown,
  cursorForward: () => cursorForward,
  cursorHide: () => cursorHide,
  cursorLeft: () => cursorLeft,
  cursorMove: () => cursorMove,
  cursorNextLine: () => cursorNextLine,
  cursorPosition: () => cursorPosition,
  cursorPrevLine: () => cursorPrevLine,
  cursorRestore: () => cursorRestore,
  cursorSave: () => cursorSave,
  cursorShow: () => cursorShow,
  cursorTo: () => cursorTo,
  cursorUp: () => cursorUp,
  eraseDown: () => eraseDown,
  eraseLine: () => eraseLine,
  eraseLineEnd: () => eraseLineEnd,
  eraseLineStart: () => eraseLineStart,
  eraseLines: () => eraseLines,
  eraseScreen: () => eraseScreen,
  eraseUp: () => eraseUp,
  image: () => image,
  link: () => link,
  scrollDown: () => scrollDown,
  scrollUp: () => scrollUp
});

// deno:https://deno.land/std@0.221.0/encoding/_util.ts
var encoder = new TextEncoder();
function getTypeName(value) {
  const type = typeof value;
  if (type !== "object") {
    return type;
  } else if (value === null) {
    return "null";
  } else {
    return value?.constructor?.name ?? "object";
  }
}
function validateBinaryLike(source) {
  if (typeof source === "string") {
    return encoder.encode(source);
  } else if (source instanceof Uint8Array) {
    return source;
  } else if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  throw new TypeError(`The input must be a Uint8Array, a string, or an ArrayBuffer. Received a value of the type ${getTypeName(source)}.`);
}

// deno:https://deno.land/std@0.221.0/encoding/base64.ts
var base64abc = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "+",
  "/"
];
function encodeBase64(data) {
  const uint8 = validateBinaryLike(data);
  let result = "";
  let i;
  const l = uint8.length;
  for (i = 2; i < l; i += 3) {
    result += base64abc[uint8[i - 2] >> 2];
    result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
    result += base64abc[(uint8[i - 1] & 15) << 2 | uint8[i] >> 6];
    result += base64abc[uint8[i] & 63];
  }
  if (i === l + 1) {
    result += base64abc[uint8[i - 2] >> 2];
    result += base64abc[(uint8[i - 2] & 3) << 4];
    result += "==";
  }
  if (i === l) {
    result += base64abc[uint8[i - 2] >> 2];
    result += base64abc[(uint8[i - 2] & 3) << 4 | uint8[i - 1] >> 4];
    result += base64abc[(uint8[i - 1] & 15) << 2];
    result += "=";
  }
  return result;
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/ansi/ansi_escapes.ts
var ESC = "\x1B";
var CSI = `${ESC}[`;
var OSC = `${ESC}]`;
var SEP = ";";
var bel = "\x07";
var cursorPosition = `${CSI}6n`;
function cursorTo(x, y) {
  if (typeof y !== "number") {
    return `${CSI}${x}G`;
  }
  return `${CSI}${y};${x}H`;
}
function cursorMove(x, y) {
  let ret = "";
  if (x < 0) {
    ret += `${CSI}${-x}D`;
  } else if (x > 0) {
    ret += `${CSI}${x}C`;
  }
  if (y < 0) {
    ret += `${CSI}${-y}A`;
  } else if (y > 0) {
    ret += `${CSI}${y}B`;
  }
  return ret;
}
function cursorUp(count = 1) {
  return `${CSI}${count}A`;
}
function cursorDown(count = 1) {
  return `${CSI}${count}B`;
}
function cursorForward(count = 1) {
  return `${CSI}${count}C`;
}
function cursorBackward(count = 1) {
  return `${CSI}${count}D`;
}
function cursorNextLine(count = 1) {
  return `${CSI}E`.repeat(count);
}
function cursorPrevLine(count = 1) {
  return `${CSI}F`.repeat(count);
}
var cursorLeft = `${CSI}G`;
var cursorHide = `${CSI}?25l`;
var cursorShow = `${CSI}?25h`;
var cursorSave = `${ESC}7`;
var cursorRestore = `${ESC}8`;
function scrollUp(count = 1) {
  return `${CSI}S`.repeat(count);
}
function scrollDown(count = 1) {
  return `${CSI}T`.repeat(count);
}
var eraseScreen = `${CSI}2J`;
function eraseUp(count = 1) {
  return `${CSI}1J`.repeat(count);
}
function eraseDown(count = 1) {
  return `${CSI}0J`.repeat(count);
}
var eraseLine = `${CSI}2K`;
var eraseLineEnd = `${CSI}0K`;
var eraseLineStart = `${CSI}1K`;
function eraseLines(count) {
  let clear = "";
  for (let i = 0; i < count; i++) {
    clear += eraseLine + (i < count - 1 ? cursorUp() : "");
  }
  clear += cursorLeft;
  return clear;
}
var clearScreen = "\x1Bc";
var clearTerminal = Deno.build.os === "windows" ? `${eraseScreen}${CSI}0f` : `${eraseScreen}${CSI}3J${CSI}H`;
function link(text, url) {
  return [
    OSC,
    "8",
    SEP,
    SEP,
    url,
    bel,
    text,
    OSC,
    "8",
    SEP,
    SEP,
    bel
  ].join("");
}
function image(buffer, options) {
  let ret = `${OSC}1337;File=inline=1`;
  if (options?.width) {
    ret += `;width=${options.width}`;
  }
  if (options?.height) {
    ret += `;height=${options.height}`;
  }
  if (options?.preserveAspectRatio === false) {
    ret += ";preserveAspectRatio=0";
  }
  return ret + ":" + encodeBase64(buffer) + bel;
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/ansi/cursor_position.ts
var encoder2 = new TextEncoder();
var decoder = new TextDecoder();
function getCursorPosition({ reader = Deno.stdin, writer = Deno.stdout } = {}) {
  const data = new Uint8Array(8);
  reader.setRaw(true);
  writer.writeSync(encoder2.encode(cursorPosition));
  reader.readSync(data);
  reader.setRaw(false);
  const [y, x] = decoder.decode(data).match(/\[(\d+);(\d+)R/)?.slice(1, 3).map(Number) ?? [
    0,
    0
  ];
  return {
    x,
    y
  };
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/ansi/tty.ts
var tty = factory();
var encoder3 = new TextEncoder();
function factory(options) {
  let result = "";
  let stack = [];
  const writer = options?.writer ?? Deno.stdout;
  const reader = options?.reader ?? Deno.stdin;
  const tty2 = function(...args) {
    if (this) {
      update(args);
      writer.writeSync(encoder3.encode(result));
      return this;
    }
    return factory(args[0] ?? options);
  };
  tty2.text = function(text) {
    stack.push([
      text,
      []
    ]);
    update();
    writer.writeSync(encoder3.encode(result));
    return this;
  };
  tty2.getCursorPosition = () => getCursorPosition({
    writer,
    reader
  });
  const methodList = Object.entries(ansi_escapes_exports);
  for (const [name, method] of methodList) {
    if (name === "cursorPosition") {
      continue;
    }
    Object.defineProperty(tty2, name, {
      get() {
        stack.push([
          method,
          []
        ]);
        return this;
      }
    });
  }
  return tty2;
  function update(args) {
    if (!stack.length) {
      return;
    }
    if (args) {
      stack[stack.length - 1][1] = args;
    }
    result = stack.reduce((prev, [cur, args2]) => prev + (typeof cur === "string" ? cur : cur.call(tty2, ...args2)), "");
    stack = [];
  }
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/keycode/_key_codes.ts
var KeyMap = {
  /* xterm/gnome ESC [ letter (with modifier) */
  "[P": "f1",
  "[Q": "f2",
  "[R": "f3",
  "[S": "f4",
  /* xterm/gnome ESC O letter (without modifier) */
  "OP": "f1",
  "OQ": "f2",
  "OR": "f3",
  "OS": "f4",
  /* xterm/rxvt ESC [ number ~ */
  "[11~": "f1",
  "[12~": "f2",
  "[13~": "f3",
  "[14~": "f4",
  /* from Cygwin and used in libuv */
  "[[A": "f1",
  "[[B": "f2",
  "[[C": "f3",
  "[[D": "f4",
  "[[E": "f5",
  /* common */
  "[15~": "f5",
  "[17~": "f6",
  "[18~": "f7",
  "[19~": "f8",
  "[20~": "f9",
  "[21~": "f10",
  "[23~": "f11",
  "[24~": "f12",
  /* xterm ESC [ letter */
  "[A": "up",
  "[B": "down",
  "[C": "right",
  "[D": "left",
  "[E": "clear",
  "[F": "end",
  "[H": "home",
  /* xterm/gnome ESC O letter */
  "OA": "up",
  "OB": "down",
  "OC": "right",
  "OD": "left",
  "OE": "clear",
  "OF": "end",
  "OH": "home",
  /* xterm/rxvt ESC [ number ~ */
  "[1~": "home",
  "[2~": "insert",
  "[3~": "delete",
  "[4~": "end",
  "[5~": "pageup",
  "[6~": "pagedown",
  /* putty */
  "[[5~": "pageup",
  "[[6~": "pagedown",
  /* rxvt */
  "[7~": "home",
  "[8~": "end"
};
var KeyMapShift = {
  /* rxvt keys with modifiers */
  "[a": "up",
  "[b": "down",
  "[c": "right",
  "[d": "left",
  "[e": "clear",
  "[2$": "insert",
  "[3$": "delete",
  "[5$": "pageup",
  "[6$": "pagedown",
  "[7$": "home",
  "[8$": "end",
  "[Z": "tab"
};
var KeyMapCtrl = {
  /* rxvt keys with modifiers */
  "Oa": "up",
  "Ob": "down",
  "Oc": "right",
  "Od": "left",
  "Oe": "clear",
  "[2^": "insert",
  "[3^": "delete",
  "[5^": "pageup",
  "[6^": "pagedown",
  "[7^": "home",
  "[8^": "end"
};
var SpecialKeyMap = {
  "\r": "return",
  "\n": "enter",
  "	": "tab",
  "\b": "backspace",
  "\x7F": "backspace",
  "\x1B": "escape",
  " ": "space"
};

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/keycode/key_code.ts
var kUTF16SurrogateThreshold = 65536;
var kEscape = "\x1B";
function parse3(data) {
  let index = -1;
  const keys = [];
  const input = data instanceof Uint8Array ? new TextDecoder().decode(data) : data;
  const hasNext = () => input.length - 1 >= index + 1;
  const next = () => input[++index];
  parseNext();
  return keys;
  function parseNext() {
    let ch = next();
    let s = ch;
    let escaped = false;
    const key = {
      name: void 0,
      char: void 0,
      sequence: void 0,
      code: void 0,
      ctrl: false,
      meta: false,
      shift: false
    };
    if (ch === kEscape && hasNext()) {
      escaped = true;
      s += ch = next();
      if (ch === kEscape) {
        s += ch = next();
      }
    }
    if (escaped && (ch === "O" || ch === "[")) {
      let code2 = ch;
      let modifier = 0;
      if (ch === "O") {
        s += ch = next();
        if (ch >= "0" && ch <= "9") {
          modifier = (Number(ch) >> 0) - 1;
          s += ch = next();
        }
        code2 += ch;
      } else if (ch === "[") {
        s += ch = next();
        if (ch === "[") {
          code2 += ch;
          s += ch = next();
        }
        const cmdStart = s.length - 1;
        if (ch >= "0" && ch <= "9") {
          s += ch = next();
          if (ch >= "0" && ch <= "9") {
            s += ch = next();
          }
        }
        if (ch === ";") {
          s += ch = next();
          if (ch >= "0" && ch <= "9") {
            s += next();
          }
        }
        const cmd = s.slice(cmdStart);
        let match;
        if (match = cmd.match(/^(\d\d?)(;(\d))?([~^$])$/)) {
          code2 += match[1] + match[4];
          modifier = (Number(match[3]) || 1) - 1;
        } else if (match = cmd.match(/^((\d;)?(\d))?([A-Za-z])$/)) {
          code2 += match[4];
          modifier = (Number(match[3]) || 1) - 1;
        } else {
          code2 += cmd;
        }
      }
      key.ctrl = !!(modifier & 4);
      key.meta = !!(modifier & 10);
      key.shift = !!(modifier & 1);
      key.code = code2;
      if (code2 in KeyMap) {
        key.name = KeyMap[code2];
      } else if (code2 in KeyMapShift) {
        key.name = KeyMapShift[code2];
        key.shift = true;
      } else if (code2 in KeyMapCtrl) {
        key.name = KeyMapCtrl[code2];
        key.ctrl = true;
      } else {
        key.name = "undefined";
      }
    } else if (ch in SpecialKeyMap) {
      key.name = SpecialKeyMap[ch];
      key.meta = escaped;
      if (key.name === "space") {
        key.char = ch;
      }
    } else if (!escaped && ch <= "") {
      key.name = String.fromCharCode(ch.charCodeAt(0) + "a".charCodeAt(0) - 1);
      key.ctrl = true;
      key.char = key.name;
    } else if (/^[0-9A-Za-z]$/.test(ch)) {
      key.name = ch.toLowerCase();
      key.shift = /^[A-Z]$/.test(ch);
      key.meta = escaped;
      key.char = ch;
    } else if (escaped) {
      key.name = ch.length ? void 0 : "escape";
      key.meta = true;
    } else {
      key.name = ch;
      key.char = ch;
    }
    key.sequence = s;
    if (s.length !== 0 && (key.name !== void 0 || escaped) || charLengthAt(s, 0) === s.length) {
      keys.push(key);
    } else {
      throw new Error("Unrecognized or broken escape sequence");
    }
    if (hasNext()) {
      parseNext();
    }
  }
}
function charLengthAt(str, i) {
  const pos = str.codePointAt(i);
  if (typeof pos === "undefined") {
    return 1;
  }
  return pos >= kUTF16SurrogateThreshold ? 2 : 1;
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/_generic_prompt.ts
var GenericPrompt = class _GenericPrompt {
  static injectedValue;
  cursor = {
    x: 0,
    y: 0
  };
  #value;
  #lastError;
  #isFirstRun = true;
  #encoder = new TextEncoder();
  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  static inject(value) {
    _GenericPrompt.injectedValue = value;
  }
  getDefaultSettings(options) {
    return {
      ...options,
      tty: tty({
        // Stdin is only used by getCursorPosition which we don't need.
        reader: Deno.stdin,
        writer: options.writer ?? Deno.stdout
      }),
      cbreak: options.cbreak ?? false,
      reader: options.reader ?? Deno.stdin,
      writer: options.writer ?? Deno.stdout,
      pointer: options.pointer ?? brightBlue(Figures.POINTER_SMALL),
      prefix: options.prefix ?? yellow("? "),
      indent: options.indent ?? "",
      keys: {
        submit: [
          "enter",
          "return"
        ],
        ...options.keys ?? {}
      }
    };
  }
  /** Execute the prompt. */
  async prompt() {
    try {
      return await this.#execute();
    } finally {
      this.settings.tty.cursorShow();
    }
  }
  /** Clear prompt output. */
  clear() {
    this.settings.tty.cursorLeft.eraseDown();
  }
  /** Execute the prompt. */
  #execute = async () => {
    if (typeof _GenericPrompt.injectedValue !== "undefined" && this.#lastError) {
      throw new Error(this.error());
    }
    await this.render();
    this.#lastError = void 0;
    if (!await this.read()) {
      return this.#execute();
    }
    if (typeof this.#value === "undefined") {
      throw new Error("internal error: failed to read value");
    }
    this.clear();
    const successMessage = this.success(this.#value);
    if (successMessage) {
      this.settings.writer.writeSync(this.#encoder.encode(successMessage + "\n"));
    }
    _GenericPrompt.injectedValue = void 0;
    this.settings.tty.cursorShow();
    return this.#value;
  };
  /** Render prompt. */
  async render() {
    const result = await Promise.all([
      this.message(),
      this.body?.(),
      this.footer()
    ]);
    const content = result.filter(Boolean).join("\n");
    const lines = content.split("\n");
    const columns = getColumns();
    const linesCount = columns ? lines.reduce((prev, next) => {
      const length = stripAnsiCode(next).length;
      return prev + (length > columns ? Math.ceil(length / columns) : 1);
    }, 0) : content.split("\n").length;
    const y = linesCount - this.cursor.y - 1;
    if (!this.#isFirstRun || this.#lastError) {
      this.clear();
    }
    this.#isFirstRun = false;
    this.settings.writer.writeSync(this.#encoder.encode(content));
    if (y) {
      this.settings.tty.cursorUp(y);
    }
    this.settings.tty.cursorTo(this.cursor.x);
  }
  /** Read user input from stdin, handle events and validate user input. */
  async read() {
    if (typeof _GenericPrompt.injectedValue !== "undefined") {
      const value = _GenericPrompt.injectedValue;
      await this.#validateValue(value);
    } else {
      const events = await this.#readKey();
      if (!events.length) {
        return false;
      }
      for (const event of events) {
        await this.handleEvent(event);
      }
    }
    return typeof this.#value !== "undefined";
  }
  submit() {
    return this.#validateValue(this.getValue());
  }
  message() {
    return `${this.settings.indent}${this.settings.prefix}` + bold(this.settings.message) + this.defaults();
  }
  defaults() {
    let defaultMessage = "";
    if (typeof this.settings.default !== "undefined" && !this.settings.hideDefault) {
      defaultMessage += dim(` (${this.format(this.settings.default)})`);
    }
    return defaultMessage;
  }
  /** Get prompt success message. */
  success(value) {
    return `${this.settings.indent}${this.settings.prefix}` + bold(this.settings.message) + this.defaults() + " " + this.settings.pointer + " " + green(this.format(value));
  }
  footer() {
    return this.error() ?? this.hint();
  }
  error() {
    return this.#lastError ? this.settings.indent + red(bold(`${Figures.CROSS} `) + this.#lastError) : void 0;
  }
  hint() {
    return this.settings.hint ? this.settings.indent + italic(brightBlue(dim(`${Figures.POINTER} `) + this.settings.hint)) : void 0;
  }
  setErrorMessage(message) {
    this.#lastError = message;
  }
  /**
   * Handle user input event.
   * @param event Key event.
   */
  async handleEvent(event) {
    switch (true) {
      case (event.name === "c" && event.ctrl):
        this.clear();
        this.settings.tty.cursorShow();
        Deno.exit(130);
        return;
      case this.isKey(this.settings.keys, "submit", event):
        await this.submit();
        break;
    }
  }
  /** Read user input from stdin and pars ansi codes. */
  #readKey = async () => {
    const data = await this.#readChar();
    return data.length ? parse3(data) : [];
  };
  /** Read user input from stdin. */
  #readChar = async () => {
    const buffer = new Uint8Array(8);
    const isTty = this.settings.reader.isTerminal();
    if (isTty) {
      this.settings.reader.setRaw(true, {
        cbreak: this.settings.cbreak
      });
    }
    const nread = await this.settings.reader.read(buffer);
    if (isTty) {
      this.settings.reader.setRaw(false);
    }
    if (nread === null) {
      return buffer;
    }
    return buffer.subarray(0, nread);
  };
  /**
   * Map input value to output value. If a custom transform handler ist set, the
   * custom handler will be executed, otherwise the default transform handler
   * from the prompt will be executed.
   * @param value The value to transform.
   */
  #transformValue = (value) => {
    return this.settings.transform ? this.settings.transform(value) : this.transform(value);
  };
  /**
   * Validate input value. Set error message if validation fails and transform
   * output value on success.
   * If a default value is set, the default will be used as value without any
   * validation.
   * If a custom validation handler ist set, the custom handler will
   * be executed, otherwise a prompt specific default validation handler will be
   * executed.
   * @param value The value to validate.
   */
  #validateValue = async (value) => {
    if (!value && typeof this.settings.default !== "undefined") {
      this.#value = this.settings.default;
      return;
    }
    this.#value = void 0;
    this.#lastError = void 0;
    const validation = await (this.settings.validate ? this.settings.validate(value) : this.validate(value));
    if (validation === false) {
      this.#lastError = `Invalid answer.`;
    } else if (typeof validation === "string") {
      this.#lastError = validation;
    } else {
      this.#value = this.#transformValue(value);
    }
  };
  /**
   * Check if key event has given name or sequence.
   * @param keys  Key map.
   * @param name  Key name.
   * @param event Key event.
   */
  isKey(keys, name, event) {
    const keyNames = keys?.[name];
    return typeof keyNames !== "undefined" && (typeof event.name !== "undefined" && keyNames.indexOf(event.name) !== -1 || typeof event.sequence !== "undefined" && keyNames.indexOf(event.sequence) !== -1);
  }
};
function getColumns() {
  try {
    return Deno.consoleSize().columns ?? null;
  } catch (_error) {
    return null;
  }
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/_generic_input.ts
var GenericInput = class extends GenericPrompt {
  inputValue = "";
  inputIndex = 0;
  getDefaultSettings(options) {
    const settings = super.getDefaultSettings(options);
    return {
      ...settings,
      keys: {
        moveCursorLeft: [
          "left"
        ],
        moveCursorRight: [
          "right"
        ],
        deleteCharLeft: [
          "backspace"
        ],
        deleteCharRight: [
          "delete"
        ],
        ...settings.keys ?? {}
      }
    };
  }
  getCurrentInputValue() {
    return this.inputValue;
  }
  message() {
    const message = super.message() + " " + this.settings.pointer + " ";
    this.cursor.x = stripAnsiCode(message).length + this.inputIndex + 1;
    return message + this.input();
  }
  input() {
    return underline(this.inputValue);
  }
  highlight(value, color1 = dim, color2 = brightBlue) {
    value = value.toString();
    const inputLowerCase = this.getCurrentInputValue().toLowerCase();
    const valueLowerCase = value.toLowerCase();
    const index = valueLowerCase.indexOf(inputLowerCase);
    const matched = value.slice(index, index + inputLowerCase.length);
    return index >= 0 ? color1(value.slice(0, index)) + color2(matched) + color1(value.slice(index + inputLowerCase.length)) : value;
  }
  /**
   * Handle user input event.
   * @param event Key event.
   */
  async handleEvent(event) {
    switch (true) {
      case this.isKey(this.settings.keys, "moveCursorLeft", event):
        this.moveCursorLeft();
        break;
      case this.isKey(this.settings.keys, "moveCursorRight", event):
        this.moveCursorRight();
        break;
      case this.isKey(this.settings.keys, "deleteCharRight", event):
        this.deleteCharRight();
        break;
      case this.isKey(this.settings.keys, "deleteCharLeft", event):
        this.deleteChar();
        break;
      case (event.char && !event.meta && !event.ctrl):
        this.addChar(event.char);
        break;
      default:
        await super.handleEvent(event);
    }
  }
  /** Add character to current input. */
  addChar(char) {
    this.inputValue = this.inputValue.slice(0, this.inputIndex) + char + this.inputValue.slice(this.inputIndex);
    this.inputIndex++;
  }
  /** Move prompt cursor left. */
  moveCursorLeft() {
    if (this.inputIndex > 0) {
      this.inputIndex--;
    }
  }
  /** Move prompt cursor right. */
  moveCursorRight() {
    if (this.inputIndex < this.inputValue.length) {
      this.inputIndex++;
    }
  }
  /** Delete char left. */
  deleteChar() {
    if (this.inputIndex > 0) {
      this.inputIndex--;
      this.deleteCharRight();
    }
  }
  /** Delete char right. */
  deleteCharRight() {
    if (this.inputIndex < this.inputValue.length) {
      this.inputValue = this.inputValue.slice(0, this.inputIndex) + this.inputValue.slice(this.inputIndex + 1);
    }
  }
};

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/_generic_list.ts
var GenericList = class extends GenericInput {
  parentOptions = [];
  get selectedOption() {
    return this.options.at(this.listIndex);
  }
  /**
   * Create list separator.
   *
   * @param label Separator label.
   */
  static separator(label = "------------") {
    return {
      name: label
    };
  }
  getDefaultSettings({ groupIcon = true, groupOpenIcon = groupIcon, ...options }) {
    const settings = super.getDefaultSettings(options);
    return {
      ...settings,
      listPointer: options.listPointer ?? brightBlue(Figures.POINTER),
      searchLabel: options.searchLabel ?? brightBlue(Figures.SEARCH),
      backPointer: options.backPointer ?? brightBlue(Figures.POINTER_LEFT),
      groupPointer: options.groupPointer ?? options.listPointer ?? brightBlue(Figures.POINTER),
      groupIcon: !groupIcon ? false : typeof groupIcon === "string" ? groupIcon : Figures.FOLDER,
      groupOpenIcon: !groupOpenIcon ? false : typeof groupOpenIcon === "string" ? groupOpenIcon : Figures.FOLDER_OPEN,
      maxBreadcrumbItems: options.maxBreadcrumbItems ?? 5,
      breadcrumbSeparator: options.breadcrumbSeparator ?? ` ${Figures.POINTER_SMALL} `,
      maxRows: options.maxRows ?? 10,
      options: this.mapOptions(options, options.options),
      keys: {
        next: options.search ? [
          "down"
        ] : [
          "down",
          "d",
          "n",
          "2"
        ],
        previous: options.search ? [
          "up"
        ] : [
          "up",
          "u",
          "p",
          "8"
        ],
        nextPage: [
          "pagedown",
          "right"
        ],
        previousPage: [
          "pageup",
          "left"
        ],
        open: [
          "right",
          "enter",
          "return"
        ],
        back: [
          "left",
          "escape",
          "enter",
          "return"
        ],
        ...settings.keys ?? {}
      }
    };
  }
  mapOption(options, option) {
    if (isOption(option)) {
      return {
        value: option.value,
        name: typeof option.name === "undefined" ? options.format?.(option.value) ?? String(option.value) : option.name,
        disabled: "disabled" in option && option.disabled === true,
        indentLevel: 0
      };
    } else {
      return {
        value: null,
        name: option.name,
        disabled: true,
        indentLevel: 0
      };
    }
  }
  mapOptionGroup(options, option, recursive = true) {
    return {
      name: option.name,
      disabled: !!option.disabled,
      indentLevel: 0,
      options: recursive ? this.mapOptions(options, option.options) : []
    };
  }
  match() {
    const input = this.getCurrentInputValue().toLowerCase();
    let options = this.getCurrentOptions().slice();
    if (input.length) {
      const matches = matchOptions(input, this.getCurrentOptions());
      options = flatMatchedOptions(matches);
    }
    this.setOptions(options);
  }
  setOptions(options) {
    this.options = [
      ...options
    ];
    const parent = this.getParentOption();
    if (parent && this.options[0] !== parent) {
      this.options.unshift(parent);
    }
    this.listIndex = Math.max(0, Math.min(this.options.length - 1, this.listIndex));
    this.listOffset = Math.max(0, Math.min(this.options.length - this.getListHeight(), this.listOffset));
  }
  getCurrentOptions() {
    return this.getParentOption()?.options ?? this.settings.options;
  }
  getParentOption(index = -1) {
    return this.parentOptions.at(index);
  }
  submitBackButton() {
    const parentOption = this.parentOptions.pop();
    if (!parentOption) {
      return;
    }
    this.match();
    this.listIndex = this.options.indexOf(parentOption);
  }
  submitGroupOption(selectedOption) {
    this.parentOptions.push(selectedOption);
    this.match();
    this.listIndex = 1;
  }
  isBackButton(option) {
    return option === this.getParentOption();
  }
  hasParent() {
    return this.parentOptions.length > 0;
  }
  isSearching() {
    return this.getCurrentInputValue() !== "";
  }
  message() {
    let message = `${this.settings.indent}${this.settings.prefix}` + bold(this.settings.message) + this.defaults();
    if (this.settings.search) {
      const input = this.isSearchSelected() ? this.input() : dim(this.input());
      message += " " + this.settings.searchLabel + " ";
      this.cursor.x = stripAnsiCode(message).length + this.inputIndex + 1;
      message += input;
    }
    return message;
  }
  /** Render options. */
  body() {
    return this.getList() + this.getInfo();
  }
  getInfo() {
    if (!this.settings.info) {
      return "";
    }
    const selected = this.listIndex + 1;
    const hasGroups = this.options.some((option) => isOptionGroup(option));
    const groupActions = hasGroups ? [
      [
        "Open",
        getFiguresByKeys(this.settings.keys.open ?? [])
      ],
      [
        "Back",
        getFiguresByKeys(this.settings.keys.back ?? [])
      ]
    ] : [];
    const actions = [
      [
        "Next",
        getFiguresByKeys(this.settings.keys.next ?? [])
      ],
      [
        "Previous",
        getFiguresByKeys(this.settings.keys.previous ?? [])
      ],
      ...groupActions,
      [
        "Next Page",
        getFiguresByKeys(this.settings.keys.nextPage ?? [])
      ],
      [
        "Previous Page",
        getFiguresByKeys(this.settings.keys.previousPage ?? [])
      ],
      [
        "Submit",
        getFiguresByKeys(this.settings.keys.submit ?? [])
      ]
    ];
    return "\n" + this.settings.indent + brightBlue(Figures.INFO) + bold(` ${selected}/${this.options.length} `) + actions.map((cur) => `${cur[0]}: ${bold(cur[1].join(", "))}`).join(", ");
  }
  /** Render options list. */
  getList() {
    const list = [];
    const height = this.getListHeight();
    for (let i = this.listOffset; i < this.listOffset + height; i++) {
      list.push(this.getListItem(this.options[i], this.listIndex === i));
    }
    if (!list.length) {
      list.push(this.settings.indent + dim("  No matches..."));
    }
    return list.join("\n");
  }
  /**
   * Render option.
   * @param option        Option.
   * @param isSelected  Set to true if option is selected.
   */
  getListItem(option, isSelected) {
    let line = this.getListItemIndent(option);
    line += this.getListItemPointer(option, isSelected);
    line += this.getListItemIcon(option);
    line += this.getListItemLabel(option, isSelected);
    return line;
  }
  getListItemIndent(option) {
    const indentLevel = this.isSearching() ? option.indentLevel : this.hasParent() && !this.isBackButton(option) ? 1 : 0;
    return this.settings.indent + " ".repeat(indentLevel);
  }
  getListItemPointer(option, isSelected) {
    if (!isSelected) {
      return "  ";
    }
    if (this.isBackButton(option)) {
      return this.settings.backPointer + " ";
    } else if (isOptionGroup(option)) {
      return this.settings.groupPointer + " ";
    }
    return this.settings.listPointer + " ";
  }
  getListItemIcon(option) {
    if (this.isBackButton(option)) {
      return this.settings.groupOpenIcon ? this.settings.groupOpenIcon + " " : "";
    } else if (isOptionGroup(option)) {
      return this.settings.groupIcon ? this.settings.groupIcon + " " : "";
    }
    return "";
  }
  getListItemLabel(option, isSelected) {
    let label = option.name;
    if (this.isBackButton(option)) {
      label = this.getBreadCrumb();
      label = isSelected && !option.disabled ? label : yellow(label);
    } else {
      label = isSelected && !option.disabled ? this.highlight(label, (val) => val) : this.highlight(label);
    }
    if (this.isBackButton(option) || isOptionGroup(option)) {
      label = bold(label);
    }
    return label;
  }
  getBreadCrumb() {
    if (!this.parentOptions.length || !this.settings.maxBreadcrumbItems) {
      return "";
    }
    const names = this.parentOptions.map((option) => option.name);
    const breadCrumb = names.length > this.settings.maxBreadcrumbItems ? [
      names[0],
      "..",
      ...names.slice(-this.settings.maxBreadcrumbItems + 1)
    ] : names;
    return breadCrumb.join(this.settings.breadcrumbSeparator);
  }
  /** Get options row height. */
  getListHeight() {
    return Math.min(this.options.length, this.settings.maxRows || this.options.length);
  }
  getListIndex(value) {
    return Math.max(0, typeof value === "undefined" ? this.options.findIndex((option) => !option.disabled) || 0 : this.options.findIndex((option) => isOption(option) && option.value === value) || 0);
  }
  getPageOffset(index) {
    if (index === 0) {
      return 0;
    }
    const height = this.getListHeight();
    return Math.min(Math.floor(index / height) * height, this.options.length - height);
  }
  /**
   * Find option by value.
   * @param value Value of the option.
   */
  getOptionByValue(value) {
    const option = this.options.find((option2) => isOption(option2) && option2.value === value);
    return option && isOptionGroup(option) ? void 0 : option;
  }
  /** Read user input. */
  read() {
    if (!this.settings.search) {
      this.settings.tty.cursorHide();
    }
    return super.read();
  }
  selectSearch() {
    this.listIndex = -1;
  }
  isSearchSelected() {
    return this.listIndex === -1;
  }
  /**
   * Handle user input event.
   * @param event Key event.
   */
  async handleEvent(event) {
    if (this.isKey(this.settings.keys, "open", event) && isOptionGroup(this.selectedOption) && !this.isBackButton(this.selectedOption) && !this.isSearchSelected()) {
      this.submitGroupOption(this.selectedOption);
    } else if (this.isKey(this.settings.keys, "back", event) && (this.isBackButton(this.selectedOption) || event.name === "escape") && !this.isSearchSelected()) {
      this.submitBackButton();
    } else if (this.isKey(this.settings.keys, "next", event)) {
      this.selectNext();
    } else if (this.isKey(this.settings.keys, "previous", event)) {
      this.selectPrevious();
    } else if (this.isKey(this.settings.keys, "nextPage", event) && !this.isSearchSelected()) {
      this.selectNextPage();
    } else if (this.isKey(this.settings.keys, "previousPage", event) && !this.isSearchSelected()) {
      this.selectPreviousPage();
    } else {
      await super.handleEvent(event);
    }
  }
  async submit() {
    if (this.isSearchSelected()) {
      this.selectNext();
      return;
    }
    await super.submit();
  }
  moveCursorLeft() {
    if (this.settings.search) {
      super.moveCursorLeft();
    }
  }
  moveCursorRight() {
    if (this.settings.search) {
      super.moveCursorRight();
    }
  }
  deleteChar() {
    if (this.settings.search) {
      super.deleteChar();
    }
  }
  deleteCharRight() {
    if (this.settings.search) {
      super.deleteCharRight();
      this.match();
    }
  }
  addChar(char) {
    if (this.settings.search) {
      super.addChar(char);
      this.match();
    }
  }
  /** Select previous option. */
  selectPrevious(loop = true) {
    if (this.options.length < 2 && !this.isSearchSelected()) {
      return;
    }
    if (this.listIndex > 0) {
      this.listIndex--;
      if (this.listIndex < this.listOffset) {
        this.listOffset--;
      }
      if (this.selectedOption?.disabled) {
        this.selectPrevious();
      }
    } else if (this.settings.search && this.listIndex === 0 && this.getCurrentInputValue().length) {
      this.listIndex = -1;
    } else if (loop) {
      this.listIndex = this.options.length - 1;
      this.listOffset = this.options.length - this.getListHeight();
      if (this.selectedOption?.disabled) {
        this.selectPrevious();
      }
    }
  }
  /** Select next option. */
  selectNext(loop = true) {
    if (this.options.length < 2 && !this.isSearchSelected()) {
      return;
    }
    if (this.listIndex < this.options.length - 1) {
      this.listIndex++;
      if (this.listIndex >= this.listOffset + this.getListHeight()) {
        this.listOffset++;
      }
      if (this.selectedOption?.disabled) {
        this.selectNext();
      }
    } else if (this.settings.search && this.listIndex === this.options.length - 1 && this.getCurrentInputValue().length) {
      this.listIndex = -1;
    } else if (loop) {
      this.listIndex = this.listOffset = 0;
      if (this.selectedOption?.disabled) {
        this.selectNext();
      }
    }
  }
  /** Select previous page. */
  selectPreviousPage() {
    if (this.options?.length) {
      const height = this.getListHeight();
      if (this.listOffset >= height) {
        this.listIndex -= height;
        this.listOffset -= height;
      } else if (this.listOffset > 0) {
        this.listIndex -= this.listOffset;
        this.listOffset = 0;
      } else {
        this.listIndex = 0;
      }
      if (this.selectedOption?.disabled) {
        this.selectPrevious(false);
      }
      if (this.selectedOption?.disabled) {
        this.selectNext(false);
      }
    }
  }
  /** Select next page. */
  selectNextPage() {
    if (this.options?.length) {
      const height = this.getListHeight();
      if (this.listOffset + height + height < this.options.length) {
        this.listIndex += height;
        this.listOffset += height;
      } else if (this.listOffset + height < this.options.length) {
        const offset = this.options.length - height;
        this.listIndex += offset - this.listOffset;
        this.listOffset = offset;
      } else {
        this.listIndex = this.options.length - 1;
      }
      if (this.selectedOption?.disabled) {
        this.selectNext(false);
      }
      if (this.selectedOption?.disabled) {
        this.selectPrevious(false);
      }
    }
  }
};
function isOption(option) {
  return !!option && typeof option === "object" && "value" in option;
}
function isOptionGroup(option) {
  return option !== null && typeof option === "object" && "options" in option && Array.isArray(option.options);
}
function matchOptions(searchInput, options) {
  const matched = [];
  for (const option of options) {
    if (isOptionGroup(option)) {
      const children = matchOptions(searchInput, option.options).sort(sortByDistance);
      if (children.length) {
        matched.push({
          option,
          distance: Math.min(...children.map((item) => item.distance)),
          children
        });
        continue;
      }
    }
    if (matchOption(searchInput, option)) {
      matched.push({
        option,
        distance: levenshteinDistance(option.name, searchInput),
        children: []
      });
    }
  }
  return matched.sort(sortByDistance);
  function sortByDistance(a, b) {
    return a.distance - b.distance;
  }
}
function matchOption(inputString, option) {
  return matchInput(inputString, option.name) || isOption(option) && option.name !== option.value && matchInput(inputString, String(option.value));
}
function matchInput(inputString, value) {
  return stripAnsiCode(value).toLowerCase().includes(inputString);
}
function flatMatchedOptions(matches, indentLevel = 0, result = []) {
  for (const { option, children } of matches) {
    option.indentLevel = indentLevel;
    result.push(option);
    flatMatchedOptions(children, indentLevel + 1, result);
  }
  return result;
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/_generic_suggestions.ts
var sep = Deno.build.os === "windows" ? "\\" : "/";
var GenericSuggestions = class extends GenericInput {
  suggestionsIndex = -1;
  suggestionsOffset = 0;
  suggestions = [];
  #hasReadPermissions;
  getDefaultSettings(options) {
    const settings = super.getDefaultSettings(options);
    return {
      ...settings,
      listPointer: options.listPointer ?? brightBlue(Figures.POINTER),
      maxRows: options.maxRows ?? 8,
      keys: {
        complete: [
          "tab"
        ],
        next: [
          "up"
        ],
        previous: [
          "down"
        ],
        nextPage: [
          "pageup"
        ],
        previousPage: [
          "pagedown"
        ],
        ...settings.keys ?? {}
      }
    };
  }
  get localStorage() {
    if (this.settings.id && "localStorage" in window) {
      try {
        return window.localStorage;
      } catch (_) {
      }
    }
    return null;
  }
  loadSuggestions() {
    if (this.settings.id) {
      const json = this.localStorage?.getItem(this.settings.id);
      const suggestions = json ? JSON.parse(json) : [];
      if (!Array.isArray(suggestions)) {
        return [];
      }
      return suggestions;
    }
    return [];
  }
  saveSuggestions(...suggestions) {
    if (this.settings.id) {
      this.localStorage?.setItem(this.settings.id, JSON.stringify([
        ...suggestions,
        ...this.loadSuggestions()
      ].filter(uniqueSuggestions)));
    }
  }
  async render() {
    if (this.settings.files && this.#hasReadPermissions === void 0) {
      const status = await Deno.permissions.request({
        name: "read"
      });
      this.#hasReadPermissions = status.state === "granted";
    }
    await this.match();
    return super.render();
  }
  async match() {
    this.suggestions = await this.getSuggestions();
    this.suggestionsIndex = Math.max(this.getCurrentInputValue().trim().length === 0 ? -1 : 0, Math.min(this.suggestions.length - 1, this.suggestionsIndex));
    this.suggestionsOffset = Math.max(0, Math.min(this.suggestions.length - this.getListHeight(), this.suggestionsOffset));
  }
  input() {
    return super.input() + dim(this.getSuggestion());
  }
  getSuggestion() {
    return this.suggestions[this.suggestionsIndex]?.toString().substr(this.getCurrentInputValue().length) ?? "";
  }
  async getUserSuggestions(input) {
    return typeof this.settings.suggestions === "function" ? await this.settings.suggestions(input) : this.settings.suggestions ?? [];
  }
  #isFileModeEnabled() {
    return !!this.settings.files && this.#hasReadPermissions === true;
  }
  async getFileSuggestions(input) {
    if (!this.#isFileModeEnabled()) {
      return [];
    }
    const path = await Deno.stat(input).then((file) => file.isDirectory ? input : dirname3(input)).catch(() => dirname3(input));
    return await listDir(path, this.settings.files);
  }
  async getSuggestions() {
    const input = this.getCurrentInputValue();
    const suggestions = [
      ...this.loadSuggestions(),
      ...await this.getUserSuggestions(input),
      ...await this.getFileSuggestions(input)
    ].filter(uniqueSuggestions);
    if (!input.length) {
      return suggestions;
    }
    return suggestions.filter((value) => stripAnsiCode(value.toString()).toLowerCase().startsWith(input.toLowerCase())).sort((a, b) => levenshteinDistance((a || a).toString(), input) - levenshteinDistance((b || b).toString(), input));
  }
  body() {
    return this.getList() + this.getInfo();
  }
  getInfo() {
    if (!this.settings.info) {
      return "";
    }
    const selected = this.suggestionsIndex + 1;
    const matched = this.suggestions.length;
    const actions = [];
    if (this.suggestions.length) {
      if (this.settings.list) {
        actions.push([
          "Next",
          getFiguresByKeys(this.settings.keys?.next ?? [])
        ], [
          "Previous",
          getFiguresByKeys(this.settings.keys?.previous ?? [])
        ], [
          "Next Page",
          getFiguresByKeys(this.settings.keys?.nextPage ?? [])
        ], [
          "Previous Page",
          getFiguresByKeys(this.settings.keys?.previousPage ?? [])
        ]);
      } else {
        actions.push([
          "Next",
          getFiguresByKeys(this.settings.keys?.next ?? [])
        ], [
          "Previous",
          getFiguresByKeys(this.settings.keys?.previous ?? [])
        ]);
      }
      actions.push([
        "Complete",
        getFiguresByKeys(this.settings.keys?.complete ?? [])
      ]);
    }
    actions.push([
      "Submit",
      getFiguresByKeys(this.settings.keys?.submit ?? [])
    ]);
    let info = this.settings.indent;
    if (this.suggestions.length) {
      info += brightBlue(Figures.INFO) + bold(` ${selected}/${matched} `);
    }
    info += actions.map((cur) => `${cur[0]}: ${bold(cur[1].join(" "))}`).join(", ");
    return info;
  }
  getList() {
    if (!this.suggestions.length || !this.settings.list) {
      return "";
    }
    const list = [];
    const height = this.getListHeight();
    for (let i = this.suggestionsOffset; i < this.suggestionsOffset + height; i++) {
      list.push(this.getListItem(this.suggestions[i], this.suggestionsIndex === i));
    }
    if (list.length && this.settings.info) {
      list.push("");
    }
    return list.join("\n");
  }
  /**
   * Render option.
   * @param value        Option.
   * @param isSelected  Set to true if option is selected.
   */
  getListItem(value, isSelected) {
    let line = this.settings.indent ?? "";
    line += isSelected ? `${this.settings.listPointer} ` : "  ";
    if (isSelected) {
      line += underline(this.highlight(value));
    } else {
      line += this.highlight(value);
    }
    return line;
  }
  /** Get suggestions row height. */
  getListHeight(suggestions = this.suggestions) {
    return Math.min(suggestions.length, this.settings.maxRows || suggestions.length);
  }
  /**
   * Handle user input event.
   * @param event Key event.
   */
  async handleEvent(event) {
    switch (true) {
      case this.isKey(this.settings.keys, "next", event):
        if (this.settings.list) {
          this.selectPreviousSuggestion();
        } else {
          this.selectNextSuggestion();
        }
        break;
      case this.isKey(this.settings.keys, "previous", event):
        if (this.settings.list) {
          this.selectNextSuggestion();
        } else {
          this.selectPreviousSuggestion();
        }
        break;
      case this.isKey(this.settings.keys, "nextPage", event):
        if (this.settings.list) {
          this.selectPreviousSuggestionsPage();
        } else {
          this.selectNextSuggestionsPage();
        }
        break;
      case this.isKey(this.settings.keys, "previousPage", event):
        if (this.settings.list) {
          this.selectNextSuggestionsPage();
        } else {
          this.selectPreviousSuggestionsPage();
        }
        break;
      case this.isKey(this.settings.keys, "complete", event):
        await this.#completeValue();
        break;
      case this.isKey(this.settings.keys, "moveCursorRight", event):
        if (this.inputIndex < this.inputValue.length) {
          this.moveCursorRight();
        } else {
          await this.#completeValue();
        }
        break;
      default:
        await super.handleEvent(event);
    }
  }
  /** Delete char right. */
  deleteCharRight() {
    if (this.inputIndex < this.inputValue.length) {
      super.deleteCharRight();
      if (!this.getCurrentInputValue().length) {
        this.suggestionsIndex = -1;
        this.suggestionsOffset = 0;
      }
    }
  }
  async #completeValue() {
    this.inputValue = await this.complete();
    this.inputIndex = this.inputValue.length;
    this.suggestionsIndex = 0;
    this.suggestionsOffset = 0;
  }
  async complete() {
    let input = this.getCurrentInputValue();
    const suggestion = this.suggestions[this.suggestionsIndex]?.toString();
    if (this.settings.complete) {
      input = await this.settings.complete(input, suggestion);
    } else if (this.#isFileModeEnabled() && input.at(-1) !== sep && await isDirectory(input) && (this.getCurrentInputValue().at(-1) !== "." || this.getCurrentInputValue().endsWith(".."))) {
      input += sep;
    } else if (suggestion) {
      input = suggestion;
    }
    return this.#isFileModeEnabled() ? normalize3(input) : input;
  }
  /** Select previous suggestion. */
  selectPreviousSuggestion() {
    if (this.suggestions.length) {
      if (this.suggestionsIndex > -1) {
        this.suggestionsIndex--;
        if (this.suggestionsIndex < this.suggestionsOffset) {
          this.suggestionsOffset--;
        }
      }
    }
  }
  /** Select next suggestion. */
  selectNextSuggestion() {
    if (this.suggestions.length) {
      if (this.suggestionsIndex < this.suggestions.length - 1) {
        this.suggestionsIndex++;
        if (this.suggestionsIndex >= this.suggestionsOffset + this.getListHeight()) {
          this.suggestionsOffset++;
        }
      }
    }
  }
  /** Select previous suggestions page. */
  selectPreviousSuggestionsPage() {
    if (this.suggestions.length) {
      const height = this.getListHeight();
      if (this.suggestionsOffset >= height) {
        this.suggestionsIndex -= height;
        this.suggestionsOffset -= height;
      } else if (this.suggestionsOffset > 0) {
        this.suggestionsIndex -= this.suggestionsOffset;
        this.suggestionsOffset = 0;
      }
    }
  }
  /** Select next suggestions page. */
  selectNextSuggestionsPage() {
    if (this.suggestions.length) {
      const height = this.getListHeight();
      if (this.suggestionsOffset + height + height < this.suggestions.length) {
        this.suggestionsIndex += height;
        this.suggestionsOffset += height;
      } else if (this.suggestionsOffset + height < this.suggestions.length) {
        const offset = this.suggestions.length - height;
        this.suggestionsIndex += offset - this.suggestionsOffset;
        this.suggestionsOffset = offset;
      }
    }
  }
};
function uniqueSuggestions(value, index, self) {
  return typeof value !== "undefined" && value !== "" && self.indexOf(value) === index;
}
function isDirectory(path) {
  return Deno.stat(path).then((file) => file.isDirectory).catch(() => false);
}
async function listDir(path, mode) {
  const fileNames = [];
  for await (const file of Deno.readDir(path || ".")) {
    if (mode === true && (file.name.startsWith(".") || file.name.endsWith("~"))) {
      continue;
    }
    const filePath = join3(path, file.name);
    if (mode instanceof RegExp && !mode.test(filePath)) {
      continue;
    }
    fileNames.push(filePath);
  }
  return fileNames.sort(function(a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/confirm.ts
var Confirm = class extends GenericSuggestions {
  settings;
  /** Execute the prompt with provided options. */
  static prompt(options) {
    return new this(options).prompt();
  }
  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  static inject(value) {
    GenericPrompt.inject(value);
  }
  constructor(options) {
    super();
    if (typeof options === "string") {
      options = {
        message: options
      };
    }
    this.settings = this.getDefaultSettings(options);
  }
  getDefaultSettings(options) {
    return {
      ...super.getDefaultSettings(options),
      active: options.active || "Yes",
      inactive: options.inactive || "No",
      files: false,
      complete: void 0,
      suggestions: [
        options.active || "Yes",
        options.inactive || "No"
      ],
      list: false,
      info: false
    };
  }
  defaults() {
    let defaultMessage = "";
    if (this.settings.default === true) {
      defaultMessage += this.settings.active[0].toUpperCase() + "/" + this.settings.inactive[0].toLowerCase();
    } else if (this.settings.default === false) {
      defaultMessage += this.settings.active[0].toLowerCase() + "/" + this.settings.inactive[0].toUpperCase();
    } else {
      defaultMessage += this.settings.active[0].toLowerCase() + "/" + this.settings.inactive[0].toLowerCase();
    }
    return defaultMessage ? dim(` (${defaultMessage})`) : "";
  }
  success(value) {
    this.saveSuggestions(this.format(value));
    return super.success(value);
  }
  /** Get input input. */
  getValue() {
    return this.inputValue;
  }
  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  validate(value) {
    return typeof value === "string" && [
      this.settings.active[0].toLowerCase(),
      this.settings.active.toLowerCase(),
      this.settings.inactive[0].toLowerCase(),
      this.settings.inactive.toLowerCase()
    ].indexOf(value.toLowerCase()) !== -1;
  }
  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  transform(value) {
    switch (value.toLowerCase()) {
      case this.settings.active[0].toLowerCase():
      case this.settings.active.toLowerCase():
        return true;
      case this.settings.inactive[0].toLowerCase():
      case this.settings.inactive.toLowerCase():
        return false;
    }
    return;
  }
  /**
   * Format output value.
   * @param value Output value.
   */
  format(value) {
    return value ? this.settings.active : this.settings.inactive;
  }
};

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/input.ts
var Input = class extends GenericSuggestions {
  settings;
  /** Execute the prompt with provided options. */
  static prompt(options) {
    return new this(options).prompt();
  }
  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  static inject(value) {
    GenericPrompt.inject(value);
  }
  constructor(options) {
    super();
    if (typeof options === "string") {
      options = {
        message: options
      };
    }
    this.settings = this.getDefaultSettings(options);
  }
  getDefaultSettings(options) {
    return {
      ...super.getDefaultSettings(options),
      minLength: options.minLength ?? 0,
      maxLength: options.maxLength ?? Infinity
    };
  }
  success(value) {
    this.saveSuggestions(value);
    return super.success(value);
  }
  /** Get input value. */
  getValue() {
    return this.settings.files ? normalize3(this.inputValue) : this.inputValue;
  }
  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  validate(value) {
    if (typeof value !== "string") {
      return false;
    }
    if (value.length < this.settings.minLength) {
      return `Value must be longer than ${this.settings.minLength} but has a length of ${value.length}.`;
    }
    if (value.length > this.settings.maxLength) {
      return `Value can't be longer than ${this.settings.maxLength} but has a length of ${value.length}.`;
    }
    return true;
  }
  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  transform(value) {
    return value.trim();
  }
  /**
   * Format output value.
   * @param value Output value.
   */
  format(value) {
    return value;
  }
};

// deno:https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/select.ts
var Select = class extends GenericList {
  settings;
  options;
  listIndex;
  listOffset;
  /** Execute the prompt with provided options. */
  static prompt(options) {
    return new this(options).prompt();
  }
  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  static inject(value) {
    GenericPrompt.inject(value);
  }
  constructor(options) {
    super();
    this.settings = this.getDefaultSettings(options);
    this.options = this.settings.options.slice();
    this.listIndex = this.getListIndex(this.settings.default);
    this.listOffset = this.getPageOffset(this.listIndex);
  }
  getDefaultSettings(options) {
    return {
      ...super.getDefaultSettings(options),
      options: this.mapOptions(options, options.options)
    };
  }
  /** Map string option values to options and set option defaults. */
  mapOptions(promptOptions, options) {
    return options.map((option) => isSelectOptionGroup(option) ? this.mapOptionGroup(promptOptions, option) : typeof option === "string" || typeof option === "number" ? this.mapOption(promptOptions, {
      value: option
    }) : this.mapOption(promptOptions, option));
  }
  input() {
    return underline(brightBlue(this.inputValue));
  }
  async submit() {
    if (this.isBackButton(this.selectedOption) || isOptionGroup(this.selectedOption)) {
      const info = isOptionGroup(this.selectedOption) ? ` To select a group use ${getFiguresByKeys(this.settings.keys.open ?? []).join(", ")}.` : "";
      this.setErrorMessage(`No option selected.${info}`);
      return;
    }
    await super.submit();
  }
  /** Get value of selected option. */
  getValue() {
    const option = this.options[this.listIndex];
    assertIsOption(option);
    return option.value;
  }
  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  validate(value) {
    return this.options.findIndex((option) => isOption(option) && option.value === value) !== -1;
  }
  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  transform(value) {
    return value;
  }
  /**
   * Format output value.
   * @param value Output value.
   */
  format(value) {
    return this.settings.format?.(value) ?? this.getOptionByValue(value)?.name ?? String(value);
  }
};
function assertIsOption(option) {
  if (!isOption(option)) {
    throw new Error("Expected an option but got an option group.");
  }
}
function isSelectOptionGroup(option) {
  return isOptionGroup(option);
}

// src/ssher/mod.ts
var DEFAULT_CONFIG = {
  servers: [
    {
      name: "arachne",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@34.66.97.235"
    },
    {
      name: "logger",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@34.27.214.65"
    },
    {
      name: "supabase",
      command: "ssh -i ~/.ssh/id_ed25519_gcp raphael@136.114.182.150"
    },
    {
      name: "on-prem",
      command: "ssh -p 27347 raphael@7.tcp.ngrok.io"
    }
  ]
};
async function getConfigPath() {
  const home = Deno.env.get("HOME") || "";
  return `${home}/.config/sshr/config.json`;
}
async function loadFullConfig() {
  const configPath = await getConfigPath();
  try {
    const configContent = await Deno.readTextFile(configPath);
    const config = JSON.parse(configContent);
    return config;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(`\u{1F4DD} Creating default config at ${configPath}`);
      const configDir = configPath.substring(0, configPath.lastIndexOf("/"));
      await Deno.mkdir(configDir, {
        recursive: true
      });
      await Deno.writeTextFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}
async function loadConfig() {
  const config = await loadFullConfig();
  return config.servers.map((s) => ({
    ...s,
    online: false
  }));
}
async function saveConfig(config) {
  const configPath = await getConfigPath();
  await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));
}
async function checkServerStatus(target) {
  try {
    const parts = target.command.split(" ");
    let host = "";
    let port = "22";
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes("@")) {
        host = parts[i].split("@")[1];
      }
      if (parts[i] === "-p" && i + 1 < parts.length) {
        port = parts[i + 1];
      }
    }
    if (!host) return false;
    const testCmd = new Deno.Command("nc", {
      args: [
        "-G",
        "2",
        "-z",
        host,
        port
      ],
      stdout: "null",
      stderr: "null"
    });
    const { code: code2 } = await testCmd.output();
    return code2 === 0;
  } catch {
    return false;
  }
}
async function main2() {
  const sshTargets = await loadConfig();
  console.log("\u{1F50D} Checking server status...\n");
  await Promise.all(sshTargets.map(async (target2) => {
    target2.online = await checkServerStatus(target2);
  }));
  const targetName = await Select.prompt({
    message: "Which server do you want to connect to?",
    options: sshTargets.map((t) => ({
      name: t.online ? t.name : `${t.name} (offline)`,
      value: t.name,
      disabled: !t.online
    }))
  });
  const target = sshTargets.find((t) => t.name === targetName);
  if (!target) {
    console.error("\u274C Invalid target selection");
    Deno.exit(1);
  }
  const accessType = await Select.prompt({
    message: "What type of access do you need?",
    options: [
      {
        name: "Interactive SSH session",
        value: "ssh"
      },
      {
        name: "SSH with port binding",
        value: "bind"
      },
      {
        name: "SFTP session",
        value: "sftp"
      }
    ]
  });
  let finalCommand = target.command;
  if (accessType === "bind") {
    const fullConfig = await loadFullConfig();
    const savedBindings = fullConfig.portBindings || [];
    const bindingOptions = [
      {
        name: "Create new port binding configuration",
        value: "new"
      },
      ...savedBindings.map((pb) => ({
        name: pb.name,
        value: pb.name
      }))
    ];
    let bindings = [];
    const selectedBinding = await Select.prompt({
      message: "Select a port binding configuration:",
      options: bindingOptions
    });
    if (selectedBinding === "new") {
      let addMore = true;
      while (addMore) {
        const remotePortStr = await Input.prompt({
          message: "What port on the remote machine?",
          validate: (value) => {
            const port = parseInt(value);
            if (isNaN(port) || port < 1 || port > 65535) {
              return "Please enter a valid port number (1-65535)";
            }
            return true;
          }
        });
        const localPortStr = await Input.prompt({
          message: "What port on this machine?",
          validate: (value) => {
            const port = parseInt(value);
            if (isNaN(port) || port < 1 || port > 65535) {
              return "Please enter a valid port number (1-65535)";
            }
            return true;
          }
        });
        bindings.push({
          remotePort: parseInt(remotePortStr),
          localPort: parseInt(localPortStr)
        });
        addMore = await Confirm.prompt({
          message: "Do you want to add another binding?",
          default: false
        });
      }
      const configName = await Input.prompt({
        message: "What would you like to name this port binding configuration?",
        validate: (value) => {
          if (!value || value.trim() === "") {
            return "Please enter a name";
          }
          if (savedBindings.some((pb) => pb.name === value)) {
            return "A configuration with this name already exists";
          }
          return true;
        }
      });
      const newPortBinding = {
        name: configName,
        bindings
      };
      fullConfig.portBindings = [
        ...savedBindings,
        newPortBinding
      ];
      await saveConfig(fullConfig);
      console.log(`
\u2705 Port binding configuration "${configName}" saved!
`);
    } else {
      const savedConfig = savedBindings.find((pb) => pb.name === selectedBinding);
      if (!savedConfig) {
        console.error("\u274C Invalid port binding configuration");
        Deno.exit(1);
      }
      bindings = savedConfig.bindings;
    }
    const portForwards = bindings.map((b) => `-L ${b.localPort}:localhost:${b.remotePort}`).join(" ");
    finalCommand = `${target.command} ${portForwards}`;
  } else if (accessType === "sftp") {
    finalCommand = target.command.replace(/^ssh/, "sftp");
  }
  console.log(`
\u{1F680} Executing: ${finalCommand}
`);
  const cmd = new Deno.Command("sh", {
    args: [
      "-c",
      `exec ${finalCommand}`
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  const process = cmd.spawn();
  const status = await process.status;
  Deno.exit(status.code);
}
if (import.meta.main) {
  await main2();
}
