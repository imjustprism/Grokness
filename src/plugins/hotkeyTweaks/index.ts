/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { querySelector } from "@utils/dom";
import { definePlugin, definePluginSettings } from "@utils/types";

const settings = definePluginSettings({
    enterBehavior: {
        type: "select",
        displayName: "Chat Hotkey",
        description: "Customize how the Enter key works for sending messages.",
        default: "default",
        options: [
            { label: "Default (Enter to send)", value: "default" },
            { label: "Swap (Enter for newline, Shift+Enter to send)", value: "swap" },
            { label: "Ctrl+Enter to send", value: "ctrlEnter" },
        ],
    },
});

let tracked: HTMLTextAreaElement | null = null;
let mo: MutationObserver | null = null;

const selector = "div.query-bar textarea";

const onKey = (e: KeyboardEvent): void => {
    if (e.target !== tracked || e.key !== "Enter") {
        return;
    }
    const behavior = settings.store.enterBehavior;
    if (behavior === "default") {
        return;
    }
    const ta = e.target as HTMLTextAreaElement;

    const send = () => ta.closest("form")?.requestSubmit();
    const newline = () => {
        const { selectionStart, selectionEnd, value } = ta;
        const next = `${value.substring(0, selectionStart)}\n${value.substring(selectionEnd)}`;
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(ta, next);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        const pos = selectionStart + 1;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
    };

    if (behavior === "swap") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) {
            send();
        } else {
            newline();
        }
    } else if (behavior === "ctrlEnter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.ctrlKey) {
            send();
        } else {
            newline();
        }
    }
};

export default definePlugin({
    name: "Hotkey Tweaks",
    id: "enter-key-swap",
    description: "Customizes the keyboard shortcuts for sending messages and creating new lines.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["input", "enter", "send", "chat", "quality of life"],
    settings,

    start() {
        document.addEventListener("keydown", onKey, { capture: true });
        const update = () => {
            tracked = querySelector(selector) as HTMLTextAreaElement | null;
        };
        mo = new MutationObserver(update);
        mo.observe(document.body, { childList: true, subtree: true });
        update();
    },

    stop() {
        document.removeEventListener("keydown", onKey, { capture: true });
        mo?.disconnect();
        tracked = null;
    },
});
