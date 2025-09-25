import type { Spec, Rule } from "../utils/mod.ts";

type Macros = Record<string, Spec>;

const structure: Spec = {
  src: ["#developed", "#undeveloped"],
  deno: "json",
  design: "ts",
  tests: ["#developedTests", "#undevelopedTests"],
  "client?": "ts",
  "assets?": "#folder",
  "vite.config?": "ts",
  ".vite?": "#folder",
};

const macros: Macros = {
  basic: {
    "surface?": {
      "...": "#basic",
    },
    mod: "ts",
    unit: ["test.ts", "nop.test.ts"],
  },
  polymorphic: {
    implementations: {
      "...": "#basic",
    },
    base: "ts",
    unit: "test.ts",
    mod: "ts",
  },
  folder: {
    "...": ["json", "mp3", "html", "css"],
  },
  developed: {
    bootstrap: "ts",
    "...": {
      domain: {
        business: {
          "...": ["#polymorphic", "#basic"],
        },
        data: {
          "...": ["#polymorphic", "#basic", "@nopTests"],
        },
      },
      routes: {
        "...": {
          "surface?": {
            "...": "#basic",
          },
          entry: "ts",
        },
      },
      "dto?": {
        "...": "#basic",
      },
      mod: "ts",
    },
  },
  undeveloped: {
    bootstrap: "ts",
    domain: {
      business: {
        "...": ["#polymorphic", "#basic"],
      },
      data: {
        "...": ["#polymorphic", "#basic", "@nopTests"],
      },
    },
    "routes?": {
      "...": {
        "surface?": {
          "...": "#basic",
        },
        entry: "ts",
      },
    },
    "dto?": {
      "...": "#basic",
    },
  },

  developedTests: {
    "examples?": {
      "...": ["#basic", "@nopTests"],
      "artifacts?": ["#folder"],
    },
    "e2e?": {
      surface: {
        "...": ["e2e.test.ts", "int.test.ts"],
      },
      artifacts: {
        "...": ["json", "mp3", "#folder"],
      },
    },
    "integration?": {
      surface: {
        "...": ["int.test.ts", "e2e.test.ts"],
      },
      "artifacts?": {
        "...": ["json", "mp3", "#folder"],
      },
      "fixtures?": {
        "...": ["json", "mp3", "#folder"],
      },
    },
    fixtures: {
      "...": ["json", "mp3", "#folder"],
    },
  },
  undevelopedTests: {
    examples: {
      "...": ["#basic", "@nopTests"],
      artifacts: ["#folder"],
    },
    "integration?": {
      surface: {
        "...": ["int.test.ts", "e2e.test.ts"],
      },
      "artifacts?": {
        "...": ["json", "mp3", "#folder"],
      },
    },
  },
};

type Rules = Record<string, Rule>;

const rules: Rules = {
  noRoot: (p: string) => {
    if (!p.startsWith("_root")) return null;
    return `_root is depricated, use bootstrap.ts instead`;
  },
  nopTests: async (p: string) => {
    const testFile = pathJoin(p, "unit.test.ts");
    const nopTestFile = pathJoin(p, "unit.nop.test.ts");

    try {
      const hasUnitTest = (await Deno.stat(testFile)).isFile;
      if (hasUnitTest) {
        return `tests here should be named 'unit.nop.test.ts' to indicate they are no-ops.`;
      }
    } catch {}

    return null;
  },
};

function pathJoin(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}

export { structure, macros, rules };
export type { Macros, Rules };
