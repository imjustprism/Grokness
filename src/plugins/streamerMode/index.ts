/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { injectStyles } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPluginContext } from "@utils/types";

const logger = new Logger("StreamerMode", "#f2d5cf");

const TEXT_BLUR_STYLE = "filter: blur(3px) !important; padding: 0 4px !important; margin: 0 -4px !important; display: inline-block !important; width: calc(100% + 8px) !important; position: relative !important;";
const IMAGE_BLUR_STYLE = "filter: blur(8px) !important;";

const settings = definePluginSettings({
    blurFilePreviews: {
        type: "boolean",
        displayName: "Blur File Previews",
        description: "Blur image previews in uploaded files.",
        default: true,
    },
    blurEmail: {
        type: "boolean",
        displayName: "Blur Email",
        description: "Blur email addresses in the interface.",
        default: true,
    },
    blurProjectChatNames: {
        type: "boolean",
        displayName: "Blur Project and Chat Names",
        description: "Blur project names, chat titles, and related text.",
        default: true,
    },
});

function generateStyles(config: typeof settings.store): string {
    let css = "";

    if (config.blurFilePreviews) {
        css += `html.streamer-mode-active figure.relative.flex-shrink-0.aspect-square.overflow-hidden.rounded-md.w-6.h-6 img { ${IMAGE_BLUR_STYLE} }\n`;
    }

    if (config.blurEmail) {
        css += `html.streamer-mode-active .p-1.min-w-0.text-sm .text-secondary.truncate { ${TEXT_BLUR_STYLE} }\n`;
    }

    if (config.blurProjectChatNames) {
        css += `html.streamer-mode-active .sidebar-user-info .display-name,
html.streamer-mode-active [data-sidebar="menu"] .group\\/conversation-item span.flex-1.select-none,
html.streamer-mode-active span.flex-1.select-none.text-nowrap.max-w-full.overflow-hidden.inline-block { ${TEXT_BLUR_STYLE} }\n`;
        css += `html.streamer-mode-active .p-1.min-w-0.text-sm .text-sm.font-medium { ${TEXT_BLUR_STYLE} }\n`;
    }

    return css;
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
            const dynamicStyles = generateStyles(settings.store);
            if (dynamicStyles) {
                styleManager = injectStyles(dynamicStyles, "streamer-mode-styles");
            }
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
