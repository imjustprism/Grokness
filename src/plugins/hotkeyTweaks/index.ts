/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin, { definePluginSettings, type InjectedComponentProps, Patch } from "@utils/types";
import type React from "react";
import { useEffect } from "react";

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

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Enter" || settings.store.enterBehavior === "default") {
                return;
            }

            const send = () => editor.closest("form")?.requestSubmit();
            const newline = () => {
                editor.focus();
                const sel = document.getSelection();
                if (!sel?.rangeCount) {
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
        };

        editor.addEventListener("keydown", onKeyDown, true);
        return () => editor.removeEventListener("keydown", onKeyDown, true);
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
        Patch.ui(EDITOR_SELECTOR)
            .component(HotkeyTweaks)
            .forEach()
            .build(),
    ],
});
