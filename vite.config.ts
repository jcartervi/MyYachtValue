import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { execSync } from "child_process";

// Capture build metadata
let shortSha = "unknown";
try {
  shortSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
} catch (error) {
  console.warn("Failed to get git SHA, using 'unknown'");
}
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
    // Custom plugin to append build stamp comment to index.html
    {
      name: "build-stamp",
      enforce: "post",
      transformIndexHtml(html) {
        return html.replace(
          "</html>",
          `<!-- MYV Build: ${shortSha} @ ${buildTime} -->\n</html>`
        );
      },
    },
  ],
  define: {
    MYV_BUILD_SHA: JSON.stringify(shortSha),
    MYV_BUILD_TIME: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
