import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import banner from 'vite-plugin-banner';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const userscriptHeader = `// ==UserScript==
// @name         ${pkg.name ?? 'grokness'}
// @description  ${pkg.description ?? 'A cute Grok extension'}
// @version      ${pkg.version ?? '1.0.3'}
// @author       ${pkg.author?.name ?? 'Prism'}
// @license      ${pkg.license ?? 'GPL-3.0'}
// @match        https://grok.com/*
// @grant        none
// ==/UserScript==
`;

export default defineConfig(({ mode }) => {
    const buildTarget = process.env.BUILD_TARGET ?? 'extension';
    const isUserscript = buildTarget === 'userscript';
    const aliases = {
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@plugins': path.resolve(__dirname, 'src/plugins'),
        '@_core': path.resolve(__dirname, 'src/plugins/_core'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@webpack': path.resolve(__dirname, 'src/webpack'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@hooks': path.resolve(__dirname, 'src/utils/hooks'),
        '@types': path.resolve(__dirname, 'src/types'),
    };

    if (isUserscript) {
        return {
            root: 'src',
            resolve: { alias: aliases },
            define: {
                'process.env.BUILD_TARGET': JSON.stringify('userscript'),
                'process.env.NODE_ENV': JSON.stringify(mode)
            },
            plugins: [
                banner({
                    content: userscriptHeader,
                    verify: false
                })
            ],
            build: {
                outDir: path.resolve(__dirname, 'dist/userscript'),
                emptyOutDir: true,
                target: 'esnext',
                sourcemap: mode === 'development',
                minify: mode === 'production' ? 'esbuild' : false,
                lib: {
                    entry: path.resolve(__dirname, 'src/PluginManager.ts'),
                    name: pkg.name,
                    formats: ['iife'],
                    fileName: () => 'userscript.js'
                }
            }
        };
    }

    const targetBrowser = process.env.BROWSER === 'chrome' ? 'chrome' : 'firefox';
    const manifestFile = path.resolve(
        __dirname,
        targetBrowser === 'chrome' ? 'manifest.chrome.json' : 'manifest.firefox.json'
    );

    return {
        root: 'src',
        resolve: { alias: aliases },
        publicDir: path.resolve(__dirname, 'public'),
        build: {
            outDir: path.resolve(__dirname, `dist/${targetBrowser}`),
            emptyOutDir: true,
            target: 'esnext',
            sourcemap: mode === 'development',
            minify: mode === 'production' ? 'esbuild' : false,
            rollupOptions: {
                output: {
                    chunkFileNames: 'assets/[name]-[hash].js'
                }
            }
        },
        optimizeDeps: {
            esbuildOptions: { target: 'esnext' }
        },
        define: {
            'process.env.BROWSER': JSON.stringify(process.env.BROWSER),
            'process.env.NODE_ENV': JSON.stringify(mode)
        },
        plugins: [
            webExtension({
                browser: targetBrowser,
                manifest: manifestFile,
                additionalInputs: ['PluginManager.ts']
            })
        ]
    };
});
