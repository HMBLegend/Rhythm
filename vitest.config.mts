import { defineConfig } from "vitest/config";

// Only needed so tests can resolve the "@/..." import alias from tsconfig.json.
export default defineConfig({
  resolve: { tsconfigPaths: true },
});
