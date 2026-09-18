import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (segment = "") =>
  fileURLToPath(new URL(`./src/${segment}`, import.meta.url));

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@app": src("app"),
      "@shared": src("shared"),
      "@features": src("features"),
      "@layouts": src("layouts"),
      "@assets": src("assets"),
      "@": src(),
    },
  },
});
