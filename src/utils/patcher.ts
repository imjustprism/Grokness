/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";
import { type IPluginCodePatch } from "@utils/types";

const patcherLogger = new Logger("Patcher", "#f5c2e7");

export class CodePatcher {
    private patches: IPluginCodePatch[] = [];
    private processedScripts = new Set<string>();
    private injectorReady = false;
    private pendingEvents: CustomEvent[] = [];

    /**
     * Injects a script into the main page context to execute patched code.
     * This is necessary to bypass content script sandbox restrictions.
     * The script listens for a CustomEvent containing the code to be executed.
     * This method is self-contained and does not require an external injector.js file.
     */
    private injectInjector(): void {
        if (document.getElementById("grokness-code-injector")) {
            this.injectorReady = true;
            return;
        }

        try {
            const injectorScript = document.createElement("script");
            injectorScript.id = "grokness-code-injector";

            injectorScript.textContent = `
                window.addEventListener("executeGroknessScript", (event) => {
                    try {
                        const data = JSON.parse(event.detail);
                        if (data && data.code) {
                            const scriptToExecute = document.createElement('script');
                            scriptToExecute.textContent = data.code;
                            (document.head || document.documentElement).appendChild(scriptToExecute);
                            scriptToExecute.remove();
                        }
                    } catch (e) {
                        console.error("Grokness: Error executing patched script.", e);
                    }
                });
            `;

            (document.head || document.documentElement).appendChild(injectorScript);

            injectorScript.remove();

            this.injectorReady = true;
            patcherLogger.log("Code injector script successfully injected.");

            if (this.pendingEvents.length > 0) {
                patcherLogger.log(`Dispatching ${this.pendingEvents.length} pending script events.`);
                this.pendingEvents.forEach(event => window.dispatchEvent(event));
                this.pendingEvents = [];
            }

        } catch (error) {
            patcherLogger.error("Fatal error injecting the code execution bridge:", error as Error);
        }
    }

    /**
     * Adds one or more code patches to be applied.
     * @param patches - The patch objects to add.
     */
    public add(...patches: IPluginCodePatch[]): void {
        this.patches.push(...patches);
    }

    /**
     * Initializes the patcher by injecting the event listener and setting up
     * a MutationObserver to watch for new scripts being added to the DOM.
     */
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

    /**
     * Processes a single script element found by the MutationObserver.
     * It fetches the script's content, applies patches, and then dispatches
     * an event for the injector to execute the patched code.
     * @param script - The HTMLScriptElement to process.
     */
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

                const finder = typeof patch.find === "string" ? new RegExp(patch.find) : patch.find;
                if (finder.test(code)) {
                    const newCode = code.replace(patch.replacement.match, patch.replacement.replace as string);
                    if (newCode !== code) {
                        code = newCode;
                        patcherLogger.log(`Successfully applied patch in ${originalSrc.split("/").pop()}`);
                    }
                }
            }

            const detail = JSON.stringify({ code });
            const event = new CustomEvent("executeGroknessScript", { detail });

            if (this.injectorReady) {
                window.dispatchEvent(event);
            } else {
                this.pendingEvents.push(event);
            }
        } catch (error) {
            patcherLogger.error(`Failed to patch script: ${originalSrc}. Restoring original.`, error as Error);
            const fallbackScript = document.createElement("script");
            fallbackScript.src = originalSrc;
            for (const attr of Array.from(script.attributes)) {
                if (attr.name !== "src") {
                    fallbackScript.setAttribute(attr.name, attr.value);
                }
            }
            placeholder.parentElement?.replaceChild(fallbackScript, placeholder);
        } finally {
            if (placeholder.parentElement) {
                placeholder.remove();
            }
        }
    }
}

export const codePatcher = new CodePatcher();
