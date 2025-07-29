/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/streamerMode/styles.css?raw";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin } from "@utils/types";

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

let settingsListener: ((e: Event) => void) | null = null;

function updateClasses() {
    try {
        const config = settings.store;
        const htmlElement = document.documentElement;

        htmlElement.classList.toggle("streamer-mode-active", true);
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
    styles,

    start() {
        updateClasses();

        settingsListener = (e: Event) => {
            const event = e as CustomEvent;
            if (event.detail.pluginId === "streamer-mode") {
                updateClasses();
            }
        };
        window.addEventListener("grok-settings-updated", settingsListener);
    },

    stop() {
        const htmlElement = document.documentElement;
        htmlElement.classList.remove(
            "streamer-mode-active",
            "blur-username",
            "blur-email",
            "blur-project-titles",
            "blur-chat-titles",
            "blur-file-names"
        );

        if (settingsListener) {
            window.removeEventListener("grok-settings-updated", settingsListener);
            settingsListener = null;
        }
    },
});
