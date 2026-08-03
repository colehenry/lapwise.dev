import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./test/setup.ts"],
  },
  // tsconfig keeps jsx: "preserve" for Next; tests need it compiled.
  oxc: {
    jsx: { runtime: "automatic", importSource: "react" },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
