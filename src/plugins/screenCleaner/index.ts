/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { createDomElementHider, type ElementHideConfig } from "@utils/dom";
import { definePluginSettings } from "@utils/settings";
import { definePlugin } from "@utils/types";

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
        default: true,
    },
});

let hider: ReturnType<typeof createDomElementHider> | null = null;
let settingsListener: ((e: Event) => void) | null = null;

const ALL_HIDE_CONFIGS: ElementHideConfig[] = [
    {
        selector: 'div[role="button"].fixed.bottom-2.right-2',
        description: "Main upsell banner",
        condition: (element: HTMLElement) => !!(
            element.querySelector("canvas.absolute.inset-0") &&
            element.querySelector("div.size-80.bg-gradient-to-r") &&
            element.querySelector("svg") &&
            element.querySelector("p.text-muted-foreground") &&
            element.querySelector("button.rounded-full")
        ),
    },
    {
        selector: 'div[role="dialog"] div[role="button"].relative',
        description: "Settings modal upsell banner",
        condition: (element: HTMLElement) => !!(
            element.querySelector("canvas.absolute.inset-0") &&
            element.querySelector("div.size-80.bg-gradient-to-r") &&
            element.querySelector("svg") &&
            element.querySelector("p.text-muted-foreground") &&
            element.querySelector("button.bg-button-filled")
        ),
    },
    {
        selector: 'div[role="menuitem"]',
        description: "Upgrade plan menu item",
        condition: (element: HTMLElement) => {
            const svgPath = element.querySelector("svg path")?.getAttribute("d");
            return !!svgPath?.includes("m13.237 21.04");
        },
    },
    {
        selector: 'div.w-full.flex.justify-center[style*="opacity:"]',
        description: "Dynamic Newsletter/Schedule Task banner",
        condition: (element: HTMLElement) => {
            if (!settings.store.hideNewsletterBanner) {
                return false;
            }
            return !!(
                element.querySelector('svg path[d="m6 9 6 6 6-6"]') &&
                element.querySelector('svg path[d="m9 13 2 2 4-4"]')
            );
        },
    },
    {
        selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full',
        description: "Idle sparkle effects",
        condition: (element: HTMLElement) => {
            if (!settings.store.hideScreensaver) {
                return false;
            }
            return !!element.querySelector("canvas.w-full.h-full");
        },
    },
];

export default definePlugin({
    name: "Screen Cleaner",
    description: "Eliminates distracting elements for a better.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["hide", "cleaner", "screensaver"],
    enabledByDefault: true,
    settings,

    start() {
        hider = createDomElementHider(document.body, ALL_HIDE_CONFIGS, {
            debounce: 100,
            useRequestAnimationFrame: true,
        });

        hider.hideImmediately();
        hider.startObserving();

        settingsListener = (e: Event) => {
            const event = e as CustomEvent;
            if (event.detail.pluginId === "screen-cleaner") {
                hider?.hideImmediately();
            }
        };
        window.addEventListener("grok-settings-updated", settingsListener);
    },

    stop() {
        hider?.stopObserving();
        hider = null;

        if (settingsListener) {
            window.removeEventListener("grok-settings-updated", settingsListener);
            settingsListener = null;
        }
    },
});
