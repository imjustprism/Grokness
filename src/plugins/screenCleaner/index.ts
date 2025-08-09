/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/screenCleaner/styles.css?raw";
import { Devs } from "@utils/constants";
import { createDomElementHider, type ElementHideConfig } from "@utils/dom";
import { definePlugin, definePluginSettings } from "@utils/types";

const settings = definePluginSettings({
    hideScreensaver: {
        type: "boolean",
        displayName: "Hide Screensaver and Sparkle Effects",
        description: "Hide the idle screensaver and sparkle effects.",
        default: true,
    },
});

let hider: ReturnType<typeof createDomElementHider> | null = null;
let onSettings: ((e: Event) => void) | null = null;

const CONFIGS: ElementHideConfig[] = [
    {
        selector: 'div[style*="opacity:"] > div.absolute.top-0.left-0.w-full.h-full',
        description: "Idle sparkle effects",
        condition: (el: HTMLElement) => {
            if (!settings.store.hideScreensaver) {
                return false;
            }
            return !!el.querySelector("canvas.w-full.h-full");
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
    styles,
    settings,

    start() {
        hider = createDomElementHider(document.body, CONFIGS, { useRequestAnimationFrame: true });
        hider.hideImmediately();
        hider.startObserving();
        onSettings = (e: Event) => {
            const { pluginId } = (e as CustomEvent).detail as { pluginId: string; key: string; value: unknown; };
            if (pluginId === "screen-cleaner") {
                hider?.hideImmediately();
            }
        };
        window.addEventListener("grok-settings-updated", onSettings);
    },

    stop() {
        hider?.stopObserving();
        hider = null;
        if (onSettings) {
            window.removeEventListener("grok-settings-updated", onSettings);
            onSettings = null;
        }
    },
});
