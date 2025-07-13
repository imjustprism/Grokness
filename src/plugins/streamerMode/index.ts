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

const settings = definePluginSettings({
    emailOnly: {
        type: "boolean",
        displayName: "Blur Email Only",
        description: "Only blur your email address, not other PII.",
        default: false,
    },
});

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

let styleManager: { cleanup: () => void; } | null = null;
let settingsListener: ((e: Event) => void) | null = null;

function updateStylesheetAndClass(context: IPluginContext) {
    try {
        const isDisabled = Boolean(localStorage.getItem(context.storageKey));
        document.documentElement.classList.toggle("streamer-mode-active", !isDisabled);

        styleManager?.cleanup();
        styleManager = null;

        if (!isDisabled) {
            const dynamicStyles = getDynamicStyles(settings.store.emailOnly);
            styleManager = injectStyles(dynamicStyles, "streamer-mode-styles");
        }
    } catch (error) {
        logger.error("Failed to update stylesheet or class:", error);
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

    start(context: IPluginContext) {
        try {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => updateStylesheetAndClass(context), { once: true });
            } else {
                updateStylesheetAndClass(context);
            }

            settingsListener = (e: Event) => {
                const event = e as CustomEvent;
                if (event.detail.pluginId === "streamer-mode") {
                    updateStylesheetAndClass(context);
                }
            };
            window.addEventListener("grok-settings-updated", settingsListener);
        } catch (error) {
            logger.error("Failed to start Streamer Mode:", error);
        }
    },

    stop() {
        try {
            document.documentElement.classList.remove("streamer-mode-active");
            styleManager?.cleanup();
            styleManager = null;
            if (settingsListener) {
                window.removeEventListener("grok-settings-updated", settingsListener);
                settingsListener = null;
            }
        } catch (error) {
            logger.error("Failed to stop Streamer Mode:", error);
        }
    },
});
