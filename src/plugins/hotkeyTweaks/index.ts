/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import { Patch } from "@utils/patchBuilder";
import definePlugin, { definePluginSettings, type InjectedComponentProps } from "@utils/types";
import type React from "react";
import { useEffect } from "react";

const logger = new Logger("HotkeyTweaks", "#ff9500");

const settings = definePluginSettings({
    enterBehavior: {
        type: "select",
        displayName: "Chat Hotkey",
        description: "Customize how the Enter key works for sending messages.",
        default: "default",
        options: [
            { label: "Default (Enter to send)", value: "default" },
            { label: "Swap (Enter for newline, Shift+Enter to send)", value: "swap" },
            { label: "Ctrl+Enter to send)", value: "ctrlEnter" },
        ],
    },
});

const EDITOR_SELECTOR = ".query-bar .tiptap.ProseMirror" as const;

const HotkeyTweaks: React.FC<InjectedComponentProps> = ({ rootElement: editor }) => {
    useEffect(() => {
        if (!editor) {
            return;
        }

        logger.debug("Attaching hotkey tweaks to editor");

        const onKeyDown = (e: KeyboardEvent) => {
            try {
                if (e.key !== "Enter" || settings.store.enterBehavior === "default") {
                    return;
                }

                const send = () => {
                    const form = editor.closest("form");
                    if (form) {
                        form.requestSubmit();
                        logger.debug("Message sent via hotkey");
                    } else {
                        logger.warn("No form found to submit");
                    }
                };

                const newline = () => {
                    try {
                        editor.focus();
                        const sel = document.getSelection();
                        if (!sel?.rangeCount) {
                            logger.warn("No selection range available for newline");
                            return;
                        }
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        const br = document.createElement("br");
                        range.insertNode(br);
                        const newRange = document.createRange();
                        newRange.setStartAfter(br);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                        logger.debug("Newline inserted via hotkey");
                    } catch (error) {
                        logger.error("Failed to insert newline:", error);
                    }
                };

                if (settings.store.enterBehavior === "swap") {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.shiftKey ? send() : newline();
                } else if (settings.store.enterBehavior === "ctrlEnter") {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.ctrlKey ? send() : newline();
                }
            } catch (error) {
                logger.error("Error handling hotkey:", error);
            }
        };

        editor.addEventListener("keydown", onKeyDown, true);
        logger.debug("Hotkey listener attached");

        return () => {
            editor.removeEventListener("keydown", onKeyDown, true);
            logger.debug("Hotkey listener removed");
        };
    }, [editor]);

    return null;
};

export default definePlugin({
    name: "Hotkey Tweaks",
    description: "Customizes the keyboard shortcuts for sending messages and creating new lines.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["input", "enter", "send", "chat", "quality of life"],
    settings,
    patches: [
        Patch.ui(HotkeyTweaks)
            .target(EDITOR_SELECTOR)
            .build(),
    ],
});
