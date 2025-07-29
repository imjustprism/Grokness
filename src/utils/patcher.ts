/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";
import { type IPluginCodePatch } from "@utils/types";

type BrowserAPIs = {
    runtime: {
        getURL: (path: string) => string;
    };
};
declare const browser: BrowserAPIs;
declare const chrome: BrowserAPIs;
declare function cloneInto<T>(data: T, targetScope: Window, options?: { cloneFunctions?: boolean; }): T;

const patcherLogger = new Logger("Patcher", "#f5c2e7");

class CodePatcher {
    private patches: IPluginCodePatch[] = [];
    private processedScripts = new Set<string>();
    private injectorReady = false;
    private pendingEvents: CustomEvent[] = [];

    private injectInjector() {
        if (this.injectorReady) {
            return;
        }
        try {
            const runtime = typeof browser !== "undefined" ? browser : chrome;
            const injectorScript = document.createElement("script");
            injectorScript.src = runtime.runtime.getURL("injector.js");

            injectorScript.onload = () => {
                this.injectorReady = true;
                this.pendingEvents.forEach(event => window.dispatchEvent(event));
                this.pendingEvents = [];
                injectorScript.remove();
            };

            injectorScript.onerror = err => {
                patcherLogger.error("Failed to load the script execution bridge (injector.js). Patches will not be applied.", err);
            };

            (document.head || document.documentElement).appendChild(injectorScript);
        } catch (error) {
            patcherLogger.error("Failed to inject the script execution bridge.", error);
        }
    }

    public add(...patches: IPluginCodePatch[]): void {
        this.patches.push(...patches);
    }

    public initialize(): void {
        this.injectInjector();

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (
                        node instanceof HTMLScriptElement &&
                        node.src &&
                        !this.processedScripts.has(node.src) &&
                        new URL(node.src).hostname.endsWith("grok.com")
                    ) {
                        this.processScript(node);
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }

    private async processScript(script: HTMLScriptElement): Promise<void> {
        const originalSrc = script.src;
        this.processedScripts.add(originalSrc);

        const placeholder = document.createComment(`grokness-placeholder-for-${originalSrc.split("/").pop()}`);
        script.parentElement?.replaceChild(placeholder, script);

        try {
            const response = await fetch(originalSrc);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let code = await response.text();

            for (const patch of this.patches) {
                if (patch.predicate && !patch.predicate()) {
                    continue;
                }

                const finder = typeof patch.find === "string" ? patch.find : patch.find.source;
                if (code.includes(finder)) {
                    const newCode = code.replace(patch.replacement.match, patch.replacement.replace as string);
                    if (newCode !== code) {
                        code = newCode;
                        patcherLogger.log(`Successfully applied patch for "${finder}" in ${originalSrc.split("/").pop()}`);
                    }
                }
            }

            let detail: { code: string; };
            if (typeof cloneInto === "function") {
                detail = cloneInto({ code }, window, { cloneFunctions: true });
            } else {
                detail = { code };
            }

            const event = new CustomEvent("executeGroknessScript", { detail });

            if (this.injectorReady) {
                window.dispatchEvent(event);
            } else {
                this.pendingEvents.push(event);
            }

            placeholder.remove();

        } catch (error) {
            patcherLogger.error(`Failed to patch script: ${originalSrc}. Restoring original.`, error);
            const fallbackScript = document.createElement("script");
            fallbackScript.src = originalSrc;
            for (const attr of script.attributes) {
                if (attr.name !== "src") {
                    fallbackScript.setAttribute(attr.name, attr.value);
                }
            }
            if (placeholder.parentElement) {
                placeholder.parentElement.replaceChild(fallbackScript, placeholder);
            }
        }
    }
}

export const codePatcher = new CodePatcher();
