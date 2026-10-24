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
    // Front Engine do PrefTech (Canvas, Schema JSON, Telemetria): veio do projeto Vite, onde o lint
    // era o oxlint, e ainda não é usado pela página /gestao. Mantido intacto até ser integrado.
    "app/gestao/engine/**",
    "app/gestao/components/views/**",
  ]),
]);

export default eslintConfig;
