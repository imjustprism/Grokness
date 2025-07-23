/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/streamerMode/styles.css?raw";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPluginContext } from "@utils/types";

const logger = new Logger("StreamerMode", "#f2d5cf");

const settings = definePluginSettings({
    blurUsername: {
        type: "boolean",
        displayName: "Blur Username",
        description: "Blur the username in the sidebar and settings.",
        default: true,
    },
    blurEmail: {
        type: "boolean",
        displayName: "Blur Email",
        description: "Blur email addresses in the interface.",
        default: true,
    },
    blurProjectTitles: {
        type: "boolean",
        displayName: "Blur Project Titles",
        description: "Blur project titles in the sidebar.",
        default: true,
    },
    blurChatTitles: {
        type: "boolean",
        displayName: "Blur Chat Titles",
        description: "Blur chat titles in the sidebar.",
        default: true,
    },
    blurFileNames: {
        type: "boolean",
        displayName: "Blur File Names",
        description: "Blur file names in the files section.",
        default: true,
    },
});

let styleElement: HTMLStyleElement | null = null;
let settingsListener: ((e: Event) => void) | null = null;

function updateClasses(context: IPluginContext) {
    try {
        const isDisabled = Boolean(localStorage.getItem(context.storageKey));
        const htmlElement = document.documentElement;
        htmlElement.classList.toggle("streamer-mode-active", !isDisabled);

        if (isDisabled) {
            htmlElement.classList.remove("blur-username", "blur-email", "blur-project-titles", "blur-chat-titles", "blur-file-names");
            return;
        }

        const config = settings.store;
        htmlElement.classList.toggle("blur-username", config.blurUsername);
        htmlElement.classList.toggle("blur-email", config.blurEmail);
        htmlElement.classList.toggle("blur-project-titles", config.blurProjectTitles);
        htmlElement.classList.toggle("blur-chat-titles", config.blurChatTitles);
        htmlElement.classList.toggle("blur-file-names", config.blurFileNames);
    } catch (error) {
        logger.error("Failed to update classes:", error);
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
            styleElement = document.createElement("style");
            styleElement.id = "streamer-mode-styles";
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        } catch (error) {
            logger.error("Failed to inject styles", error);
        }

        try {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => updateClasses(context), { once: true });
            } else {
                updateClasses(context);
            }

            settingsListener = (e: Event) => {
                const event = e as CustomEvent;
                if (event.detail.pluginId === "streamer-mode") {
                    updateClasses(context);
                }
            };
            window.addEventListener("grok-settings-updated", settingsListener);
        } catch (error) {
            logger.error("Failed to start Streamer Mode:", error);
        }
    },

    stop() {
        try {
            const htmlElement = document.documentElement;
            htmlElement.classList.remove("streamer-mode-active", "blur-username", "blur-email", "blur-project-titles", "blur-chat-titles", "blur-file-names");
            styleElement?.remove();
            styleElement = null;
            if (settingsListener) {
                window.removeEventListener("grok-settings-updated", settingsListener);
                settingsListener = null;
            }
        } catch (error) {
            logger.error("Failed to stop Streamer Mode:", error);
        }
    },
});
