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
        selector: 'div[role="dialog"] div[role="button"]',
        description: "Modal upsell banner",
        condition: (element: HTMLElement) => {
            const hasCanvas = !!element.querySelector("canvas");
            const hasUpgradeButton = !!element.querySelector("button")?.textContent?.includes("Go Super");
            return hasCanvas && hasUpgradeButton;
        },
    },
    {
        selector: 'div[role="menuitem"]',
        description: "Upgrade plan menu item",
        condition: (element: HTMLElement) => !!element.textContent?.includes("Upgrade plan"),
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
    description: "Eliminates distracting elements for a cleaner experience.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["hide", "cleaner", "screensaver"],
    enabledByDefault: true,
    styles: `
        .upsell-small {
            display: none !important;
        }
    `,
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
