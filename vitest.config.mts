import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // The scheduling engine is pure TypeScript, so tests run in Node.
    // Add a jsdom project here when component tests are needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
