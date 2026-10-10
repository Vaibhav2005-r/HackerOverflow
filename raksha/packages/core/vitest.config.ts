import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8", include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test-setup.ts", "src/index.ts", "src/scoring/build-cells.ts", "src/**/types.ts"],
      thresholds: { lines: 90, statements: 90, functions: 90 },
    },
  },
});
