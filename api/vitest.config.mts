import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // una sola base de datos de pruebas
    env: { NODE_ENV: "test" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/server.ts", "src/seed.ts"],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  },
});
