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
            try {
                const hasCanvas = !!element.querySelector("canvas.absolute.inset-0");
                const hasGradientDiv = !!element.querySelector("div.absolute.inset-0.flex.justify-center.overflow-hidden > div.size-80.bg-gradient-to-r.aspect-square.opacity-10.absolute.bottom-4.blur-\\[32px\\].rounded-full");
                const hasSvg = !!element.querySelector("svg");
                const hasTextMuted = !!element.querySelector("p.text-muted-foreground");
                const hasButton = !!element.querySelector("button.rounded-full");
                return hasCanvas && hasGradientDiv && hasSvg && hasTextMuted && hasButton;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`Error checking condition for "Main upsell banner": ${message}`);
                return false;
            }
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upsell-main",
    },
    {
        selector: 'div[role="dialog"] div[role="button"].relative',
        description: "Settings modal upsell banner",
        condition: (element: HTMLElement) => {
            try {
                const hasCanvas = !!element.querySelector("canvas.absolute.inset-0");
                const hasGradientDiv = !!element.querySelector("div.absolute.inset-0.flex.justify-center.overflow-hidden.rounded-\\[23px\\] > div.size-80.bg-gradient-to-r.aspect-square.opacity-10.absolute.bottom-4.blur-\\[32px\\].rounded-full");
                const hasSvg = !!element.querySelector("svg");
                const hasTextMuted = !!element.querySelector("p.text-muted-foreground");
                const hasButton = !!element.querySelector("button.bg-button-filled.text-fg-invert.rounded-full");
                return hasCanvas && hasGradientDiv && hasSvg && hasTextMuted && hasButton;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`Error checking condition for "Settings modal upsell banner": ${message}`);
                return false;
            }
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upsell-modal",
    },
    {
        selector: 'div[role="menuitem"]',
        description: "Upgrade plan menu item",
        condition: (element: HTMLElement) => {
            try {
                const svgPath = element.querySelector("svg path")?.getAttribute("d") ?? "";
                const svgMatches = svgPath.includes("m13.237 21.04");
                return svgMatches;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`Error checking condition for "Upgrade plan menu item": ${message}`);
                return false;
            }
        },
        removeFromDom: false,
        markerAttribute: "data-grokness-hidden-upgrade-menu",
    },
];

const NEWSLETTER_HIDE_CONFIG: ElementHideConfig = {
    selector: 'div.w-full.flex.justify-center[style*="opacity:"]',
    description: "Dynamic Newsletter/Schedule Task banner",
    condition: (element: HTMLElement) => {
        try {
            const hasChevronDown = !!element.querySelector('svg path[d="m6 9 6 6 6-6"]');
            const hasAlarmClock = !!element.querySelector('svg path[d="m9 13 2 2 4-4"]');
            return hasChevronDown && hasAlarmClock;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`Error checking condition for "Dynamic Newsletter/Schedule Task banner": ${message}`);
            return false;
        }
    },
    removeFromDom: false,
    markerAttribute: "data-grokness-hidden-dynamic-banner",
};

const SCREENSAVER_HIDE_CONFIG: ElementHideConfig = {
    selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full',
    description: "Idle screensaver and sparkle effects",
    condition: (element: HTMLElement) => {
        try {
            const canvas = element.querySelector("canvas.w-full.h-full");
            return !!canvas;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`Error checking condition for "Idle screensaver and sparkle effects": ${message}`);
            return false;
        }
    },
    removeFromDom: false,
    markerAttribute: "data-grokness-hidden-screensaver",
};

const screenCleanerPatch = (() => {
    let hider: ReturnType<typeof createDomElementHider> | null = null;
    let modalObserver: MutationObserver | null = null;
    let settingsListener: ((e: Event) => void) | null = null;

    function getActiveConfigs(): ElementHideConfig[] {
        try {
            const activeConfigs = [...BASE_HIDE_CONFIGS];
            if (settings.store.hideNewsletterBanner) {
                activeConfigs.push(NEWSLETTER_HIDE_CONFIG);
            }
            if (settings.store.hideScreensaver) {
                activeConfigs.push(SCREENSAVER_HIDE_CONFIG);
            }
            return activeConfigs;
        } catch (error) {
            logger.error("Failed to get active configs:", error);
            return [];
        }
    }

    function setupHider() {
        try {
            hider?.stopObserving();
            hider = null;

            hider = createDomElementHider(document.body, getActiveConfigs(), {
                debounce: 0,
                useRequestAnimationFrame: true,
                injectCss: true,
            });
            hider.startObserving();
            if (document.readyState === "complete") {
                hider.hideImmediately();
            } else {
                document.addEventListener("DOMContentLoaded", () => {
                    try {
                        hider?.hideImmediately();
                    } catch (error) {
                        logger.error("Failed to hide immediately on DOMContentLoaded:", error);
                    }
                }, { once: true });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("Failed to initialize element hider:", message);
        }
    }

    return {
        apply() {
            try {
                setupHider();

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
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : String(error);
                        logger.error("Error in modal observer callback:", message);
                    }
                };
                modalObserver = new MutationObserver(modalObserverCallback);
                modalObserver.observe(document.body, modalObserverConfig);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error("Failed to initialize modal observer:", message);
            }

            settingsListener = (e: Event) => {
                try {
                    const event = e as CustomEvent;
                    if (event.detail.pluginId === "screen-cleaner") {
                        setupHider();
                    }
                } catch (error) {
                    logger.error("Error in settings listener:", error);
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
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error("Failed to clean up screen cleaner:", message);
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
