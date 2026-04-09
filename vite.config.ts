import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    devServer({
      entry: "src/server/index.ts",
      // Only let Hono handle API routes; everything else (/, assets, etc.)
      // falls through to Vite's own static/HTML serving.
      exclude: [
        /^\/$/, // root → Vite serves index.html
        /^\/assets\/.*/,
        /.*\.(css|js|ts|tsx|jsx|html|ico|png|svg|woff2?)(\?.*)?$/,
        /^\/@.+$/,
        /^\/node_modules\/.*/,
      ],
    }),
  ],
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: "index.html",
    },
  },
  publicDir: command === "build" ? "public" : false,
}));
