import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetBrowser = process.env.BROWSER || "firefox";
const manifestFile =
    targetBrowser === "chrome"
        ? path.resolve(__dirname, "manifest.chrome.json")
        : path.resolve(__dirname, "manifest.firefox.json");

export default defineConfig({
    root: "src",
    build: {
        outDir: path.resolve(__dirname, `dist/${targetBrowser}`),
        emptyOutDir: true,
        target: "esnext",
        sourcemap: process.env.NODE_ENV === "development",
        minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
        rollupOptions: {
            output: {
                chunkFileNames: "assets/[name]-[hash].js",
            },
        },
    },
    publicDir: path.resolve(__dirname, "public"),
    plugins: [
        webExtension({
            browser: targetBrowser === "chrome" ? "chrome" : "firefox",
            manifest: manifestFile,
            additionalInputs: ["PluginManager.ts"],
        }),
    ],
    resolve: {
        alias: {
            "@utils": path.resolve(__dirname, "src/utils"),
            "@plugins": path.resolve(__dirname, "src/plugins"),
            "@_core": path.resolve(__dirname, "src/plugins/_core"),
            "@components": path.resolve(__dirname, "src/components"),
            "@webpack": path.resolve(__dirname, "src/webpack"),
            "@api": path.resolve(__dirname, "src/api"),
            "@hooks": path.resolve(__dirname, "src/utils/hooks"),
            "@types": path.resolve(__dirname, "src/types"),
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            target: "esnext",
        },
    },
});
