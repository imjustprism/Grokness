/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/streamerMode/styles.css?raw";
import { Devs } from "@utils/constants";
import { injectStyles } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPluginContext } from "@utils/types";

const logger = new Logger("StreamerMode", "#f2d5cf");

let styleManager: { styleElement: HTMLStyleElement; cleanup: () => void; } | null = null;
let settingsListener: ((e: Event) => void) | null = null;

const settings = definePluginSettings({
    emailOnly: {
        type: "boolean",
        displayName: "Blur Email Only",
        description: "Only blur your email address, not other PII.",
        default: false,
    },
});

/**
 * Generates dynamic CSS based on settings.
 * @param emailOnly Whether to blur only email or all PII.
 * @returns The CSS string.
 */
function getDynamicStyles(emailOnly: boolean): string {
    if (emailOnly) {
        return `
html.streamer-mode-active .p-1.min-w-0.text-sm .text-secondary.truncate {
    filter: blur(3px) !important;
    padding: 0 4px !important;
    margin: 0 -4px !important;
    display: inline-block !important;
    width: calc(100% + 8px) !important;
    position: relative !important;
}
        `;
    }
    return styles.replace(/\.streamer-mode-active/g, "html.streamer-mode-active");
}

/**
 * Updates the stylesheet and class based on plugin state and settings.
 * @param storageKey The localStorage key for enabled state.
 */
function updateStylesheetAndClass(storageKey: string) {
    try {
        const isDisabled = Boolean(localStorage.getItem(storageKey));

        document.documentElement.classList.toggle("streamer-mode-active", !isDisabled);

        if (styleManager) {
            styleManager.cleanup();
            styleManager = null;
        }

        if (isDisabled) {
            return;
        }

        const { emailOnly } = settings.store;
        const dynamicStyles = getDynamicStyles(emailOnly);
        styleManager = injectStyles(dynamicStyles, "streamer-mode-styles");
    } catch (err) {
        logger.error("Failed to update stylesheet or class:", err);
    }
}

export default definePlugin({
    name: "Streamer Mode",
    description: "Blurs sensitive information to protect your privacy.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["privacy", "blur", "streamer"],
    settings,
    patches: [],

    onLoad(context: IPluginContext) {
        updateStylesheetAndClass(context.storageKey);
    },

    start(context: IPluginContext) {
        try {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => updateStylesheetAndClass(context.storageKey), { once: true });
            } else {
                updateStylesheetAndClass(context.storageKey);
            }

            settingsListener = (e: Event) => {
                const event = e as CustomEvent;
                if (event.detail.pluginId === "streamer-mode") {
                    updateStylesheetAndClass(context.storageKey);
                }
            };
            window.addEventListener("grok-settings-updated", settingsListener);
        } catch (err) {
            logger.error("Failed to start Streamer Mode:", err);
        }
    },

    stop() {
        try {
            document.documentElement.classList.remove("streamer-mode-active");

            if (styleManager) {
                styleManager.cleanup();
                styleManager = null;
            }
            if (settingsListener) {
                window.removeEventListener("grok-settings-updated", settingsListener);
                settingsListener = null;
            }
        } catch (err) {
            logger.error("Failed to stop Streamer Mode:", err);
        }
    },

    onUnload() {
    },
});
