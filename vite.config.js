import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss()],
  publicDir: "docs",       // docs/data/*.json → /data/*.json (toplayıcı buraya yazar)
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 4412, host: "127.0.0.1" },
});
