import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The mobile app has its own toolchain.
    "mobile/**",
    // Agent worktrees are full checkouts of this repo living inside it, so
    // without this the root lint walks a second copy of mobile/ (which the
    // line above only excludes at the top level) and reports errors from code
    // nobody is editing. It made `npm run lint` unusable whenever a worktree
    // existed.
    ".claude/**",
  ]),
]);

export default eslintConfig;
