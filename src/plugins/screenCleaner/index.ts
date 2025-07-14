/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { createDomElementHider, type ElementHideConfig } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin } from "@utils/types";

const logger = new Logger("ScreenCleaner", "#e78284");

const settings = definePluginSettings({
    hideNewsletterBanner: {
        type: "boolean",
        displayName: "Hide Schedule Banner",
        description: "Hide the newsletter and schedule task banner.",
        default: false,
    },
    hideScreensaver: {
        type: "boolean",
        displayName: "Hide Screensaver and Sparkle Effects",
        description: "Hide the idle screensaver and sparkle effects.",
        default: false,
    },
});

const BASE_HIDE_CONFIGS: ElementHideConfig[] = [
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
];

const NEWSLETTER_HIDE_CONFIG: ElementHideConfig = {
    selector: 'div.w-full.flex.justify-center[style*="opacity:"]',
    description: "Dynamic Newsletter/Schedule Task banner",
    condition: (element: HTMLElement) => {
        const textContent = element.textContent?.trim() ?? "";
        const hasScheduleTask = textContent.includes("Schedule Task");
        const hasChevronDown = !!element.querySelector('svg path[d="m6 9 6 6 6-6"]');
        const hasAlarmClock = !!element.querySelector('svg path[d="m9 13 2 2 4-4"]');
        return hasScheduleTask && hasChevronDown && hasAlarmClock;
    },
    removeFromDom: false,
    markerAttribute: "data-grokness-hidden-dynamic-banner",
    regexPattern: /Schedule\sTask/i,
    regexTarget: "textContent",
};

const SCREENSAVER_HIDE_CONFIG: ElementHideConfig = {
    selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full',
    description: "Idle screensaver and sparkle effects",
    condition: (element: HTMLElement) => {
        const canvas = element.querySelector("canvas.w-full.h-full");
        return !!canvas;
    },
    removeFromDom: false,
    markerAttribute: "data-grokness-hidden-screensaver",
};

const screenCleanerPatch = (() => {
    let hider: ReturnType<typeof createDomElementHider> | null = null;
    let modalObserver: MutationObserver | null = null;
    let settingsListener: ((e: Event) => void) | null = null;

    function getActiveConfigs(): ElementHideConfig[] {
        const activeConfigs = [...BASE_HIDE_CONFIGS];
        if (settings.store.hideNewsletterBanner) {
            activeConfigs.push(NEWSLETTER_HIDE_CONFIG);
        }
        if (settings.store.hideScreensaver) {
            activeConfigs.push(SCREENSAVER_HIDE_CONFIG);
        }
        return activeConfigs;
    }

    function setupHider() {
        hider?.stopObserving();
        hider = null;

        try {
            hider = createDomElementHider(document.body, getActiveConfigs(), {
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
        }
    }

    return {
        apply() {
            setupHider();

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

            settingsListener = (e: Event) => {
                const event = e as CustomEvent;
                if (event.detail.pluginId === "screen-cleaner") {
                    setupHider();
                }
            };
            window.addEventListener("grok-settings-updated", settingsListener);
        },
        remove() {
            try {
                hider?.stopObserving();
                modalObserver?.disconnect();
                hider?.hideImmediately();
                hider = null;
                modalObserver = null;
                if (settingsListener) {
                    window.removeEventListener("grok-settings-updated", settingsListener);
                    settingsListener = null;
                }
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
    settings,
    patches: [screenCleanerPatch],
});
