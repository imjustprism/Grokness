/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { createDomElementHider, type ElementHideConfig } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin } from "@utils/types";

const logger = new Logger("ScreenCleaner", "#e78284");

const HIDE_CONFIGS: ElementHideConfig[] = [
    {
        selector: 'div[role="button"].fixed.bottom-2.right-2',
        description: "Main upsell banner",
        condition: (element: HTMLElement) => {
            const textContent = element.textContent?.trim() ?? "";
            const matches = textContent.includes("Unlock Grok 4 and more");
            return matches;
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upsell-main",
        regexPattern: /Unlock\s+Grok\s+4\s+and\s+more/i,
        regexTarget: "textContent",
    },
    {
        selector: 'div[role="dialog"] div[role="button"].relative',
        description: "Settings modal upsell banner",
        condition: (element: HTMLElement) => {
            const textContent = element.textContent?.trim() ?? "";
            const matches = textContent.includes("Fewer rate limits");
            return matches;
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upsell-modal",
        regexPattern: /Fewer\s+rate\s+limits/i,
        regexTarget: "textContent",
    },
    {
        selector: 'div[role="menuitem"]',
        description: "Upgrade plan menu item",
        condition: (element: HTMLElement) => {
            const textContent = element.textContent?.trim() ?? "";
            const textMatches = textContent.includes("Upgrade plan");
            const svgPath = element.querySelector("svg path")?.getAttribute("d") ?? "";
            const svgMatches = svgPath.includes("m13.237 21.04");
            const matches = textMatches || svgMatches;
            return matches;
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upgrade-menu",
        regexPattern: /Upgrade\s+plan/i,
        regexTarget: "textContent",
    },
    {
        selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full',
        description: "Idle screensaver and sparkle effects",
        condition: (element: HTMLElement) => {
            const canvas = element.querySelector("canvas.w-full.h-full");
            return !!canvas;
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-screensaver",
    },
];

const screenCleanerPatch = (() => {
    let hider: ReturnType<typeof createDomElementHider> | null = null;
    let modalObserver: MutationObserver | null = null;

    return {
        apply() {
            try {
                hider = createDomElementHider(document.body, HIDE_CONFIGS, {
                    debounce: 0,
                    useRequestAnimationFrame: true,
                    injectCss: true,
                });
                hider.startObserving();
                if (document.readyState === "complete") {
                    hider.hideImmediately();
                } else {
                    document.addEventListener("DOMContentLoaded", () => hider?.hideImmediately(), { once: true });
                }
            } catch (error) {
                logger.error("Failed to initialize element hider:", error);
                return;
            }

            try {
                const modalObserverConfig: MutationObserverInit = {
                    childList: true,
                    subtree: true
                };
                const modalObserverCallback: MutationCallback = (mutations: MutationRecord[]) => {
                    try {
                        for (const mutation of mutations) {
                            for (const addedNode of mutation.addedNodes) {
                                if (addedNode instanceof HTMLElement && addedNode.getAttribute("role") === "dialog") {
                                    hider?.hideImmediately();
                                }
                            }
                        }
                    } catch (error) {
                        logger.error("Error in modal observer callback:", error);
                    }
                };
                modalObserver = new MutationObserver(modalObserverCallback);
                modalObserver.observe(document.body, modalObserverConfig);
            } catch (error) {
                logger.error("Failed to initialize modal observer:", error);
            }
        },
        remove() {
            try {
                hider?.stopObserving();
                modalObserver?.disconnect();
                hider?.hideImmediately();
                hider = null;
                modalObserver = null;
            } catch (error) {
                logger.error("Failed to clean up screen cleaner:", error);
            }
        },
    };
})();

export default definePlugin({
    name: "Screen Cleaner",
    description: "Eliminates distracting elements for a streamlined, distraction-free experience.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["hide", "cleaner", "upsell", "banner", "upgrade", "screensaver", "sparkle"],
    enabledByDefault: true,
    patches: [screenCleanerPatch],
});
