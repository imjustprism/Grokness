/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/streamerMode/styles.css?raw";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import definePlugin, { definePluginSettings, onPluginSettingsUpdated } from "@utils/types";
import { useEffect } from "react";

const logger = new Logger("StreamerMode", "#f2d5cf");

const settings = definePluginSettings({
    blurAmount: {
        type: "slider",
        displayName: "Blur Amount",
        description: "Sets the strength of the blur effect in pixels.",
        default: 4,
        min: 1,
        max: 20,
        step: 1,
        suffix: "px",
    },
    blurUsername: {
        type: "boolean",
        displayName: "Blur Username",
        description: "Blur the username in the sidebar and settings.",
        default: false,
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
        default: false,
    },
    blurChatTitles: {
        type: "boolean",
        displayName: "Blur Chat Titles",
        description: "Blur pinned and historical chat titles in the sidebar.",
        default: false,
    },
    blurTaskTitles: {
        type: "boolean",
        displayName: "Blur Task Titles",
        description: "Blur task titles in the sidebar.",
        default: false,
    },
    blurFileNames: {
        type: "boolean",
        displayName: "Blur File Names",
        description: "Blur file names in the files section.",
        default: false,
    },
    blurUid: {
        type: "boolean",
        displayName: "Blur UID",
        description: "Blur your account UID in the settings page footer.",
        default: true,
    },
});

const StreamerMode: React.FC = () => {
    useEffect(() => {
        const apply = () => {
            try {
                const cfg = settings.store;
                const html = document.documentElement;
                html.style.setProperty("--grokness-blur-amount", `${cfg.blurAmount}px`);
                html.classList.toggle("streamer-mode-active", true);
                html.classList.toggle("blur-username", cfg.blurUsername);
                html.classList.toggle("blur-email", cfg.blurEmail);
                html.classList.toggle("blur-project-titles", cfg.blurProjectTitles);
                html.classList.toggle("blur-chat-titles", cfg.blurChatTitles);
                html.classList.toggle("blur-task-titles", cfg.blurTaskTitles);
                html.classList.toggle("blur-file-names", cfg.blurFileNames);
                html.classList.toggle("blur-uid", cfg.blurUid);
            } catch (e) {
                logger.error("update failed:", e);
            }
        };

        apply();
        const off = onPluginSettingsUpdated("streamer-mode", apply);

        return () => {
            const html = document.documentElement;
            html.style.removeProperty("--grokness-blur-amount");
            html.classList.remove(
                "streamer-mode-active",
                "blur-username",
                "blur-email",
                "blur-project-titles",
                "blur-chat-titles",
                "blur-task-titles",
                "blur-file-names",
                "blur-uid"
            );
            off();
        };
    }, []);

    return null;
};

export default definePlugin({
    name: "Streamer Mode",
    description: "Blurs sensitive information to protect your privacy.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["privacy", "blur", "streamer"],
    settings,
    styles,
    ui: {
        component: StreamerMode,
        target: "body",
    },
});
