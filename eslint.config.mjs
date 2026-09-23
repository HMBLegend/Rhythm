import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Architecture boundary: the scheduling engine is pure TypeScript.
  // It must not depend on the UI, the framework, the database or the LLM,
  // so AI output can never reach a plan without passing through the engine's validation.
  // See docs/decisions/0002-deterministic-engine-llm-as-parser.md.
  {
    files: ["src/lib/scheduling/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message: "The scheduling engine must stay framework-free.",
            },
            {
              group: ["next", "next/*", "server-only", "client-only"],
              message: "The scheduling engine must stay framework-free.",
            },
            {
              group: ["@supabase/*"],
              message: "The scheduling engine must not touch the database.",
            },
            {
              group: ["@/lib/llm", "@/lib/llm/*", "**/llm", "**/llm/*"],
              message: "The scheduling engine must not import LLM code.",
            },
            {
              group: [
                "@/lib/supabase",
                "@/lib/supabase/*",
                "**/supabase",
                "**/supabase/*",
              ],
              message: "The scheduling engine must not touch the database.",
            },
            {
              group: ["@/app/*", "@/components/*"],
              message: "The scheduling engine must not depend on UI code.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
