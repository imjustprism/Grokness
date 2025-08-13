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
// @namespace    ${pkg.namespace ?? 'https://github.com/imjustprism/grokness'}
// @description  ${pkg.description ?? 'A cute Grok extension'}
// @version      ${pkg.version}
// @author       ${pkg.author?.name ?? 'Prism'}
// @license      ${pkg.license ?? 'GPL-3.0'}
// @match        https://grok.com/*
// @grant        none
// ==/UserScript==
`;

export default defineConfig(({ mode }) => {
    const buildTarget = process.env.BUILD_TARGET ?? 'extension';
    const isUserscript = buildTarget === 'userscript';
    const readableUserscript = process.env.USERSCRIPT_READABLE === '1';
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
                sourcemap: false,
                cssCodeSplit: false,
                minify: 'terser',
                terserOptions: readableUserscript
                    ? {
                        ecma: 2020,
                        module: true,
                        toplevel: false,
                        compress: {
                            passes: 2,
                            dead_code: true,
                            conditionals: true,
                            evaluate: true,
                            drop_console: true,
                            drop_debugger: true,
                            pure_getters: true,
                            defaults: true,
                        },
                        mangle: false,
                        keep_classnames: true,
                        keep_fnames: true,
                        format: {
                            beautify: true,
                            braces: true,
                            indent_level: 2,
                            comments: (_: any, c: any) => /==UserScript==/.test(c.value),
                        },
                    }
                    : {
                        ecma: 2020,
                        module: true,
                        toplevel: true,
                        compress: {
                            passes: 3,
                            drop_console: true,
                            drop_debugger: true,
                            pure_getters: true,
                            hoist_funs: true,
                            hoist_vars: false,
                            booleans_as_integers: true,
                        },
                        mangle: {
                            toplevel: true,
                        },
                        format: {
                            comments: (_: any, c: any) => /==UserScript==/.test(c.value),
                        },
                    },
                rollupOptions: {
                    treeshake: readableUserscript ? true : 'smallest',
                    output: {
                        compact: !readableUserscript,
                        inlineDynamicImports: true,
                    },
                },
                esbuild: {
                    legalComments: 'none',
                    drop: ['console', 'debugger'],
                    pure: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
                },
                lib: {
                    entry: path.resolve(__dirname, 'src/loader.ts'),
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
            minify: false,
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
                additionalInputs: ['loader.ts']
            })
        ]
    };
});
