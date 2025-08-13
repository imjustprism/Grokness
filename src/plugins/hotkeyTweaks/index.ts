/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { selectOne } from "@utils/dom";
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

let tracked: HTMLElement | null = null;
let mo: MutationObserver | null = null;

const EDITOR_SELECTOR = ".query-bar .tiptap.ProseMirror" as const;

const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "Enter") {
        return;
    }
    const editor = tracked;
    if (!editor) {
        return;
    }
    const t = e.target as HTMLElement | null;
    if (!t || (t !== editor && !editor.contains(t))) {
        return;
    }

    const behavior = settings.store.enterBehavior;
    if (behavior === "default") {
        return;
    }

    const send = () => editor.closest("form")?.requestSubmit();
    const newline = () => {
        editor.focus();

        const dispatchBeforeInput = (inputType: string, data?: string): boolean => {
            const ev = new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                inputType,
                data,
            });
            const notCanceled = editor.dispatchEvent(ev);
            return !notCanceled;
        };

        const handled = dispatchBeforeInput("insertLineBreak") || dispatchBeforeInput("insertParagraph");
        if (handled) {
            editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "\n" }));
            return;
        }

        const sel = document.getSelection();
        if (!sel) {
            return;
        }
        if (sel.rangeCount === 0) {
            const r = document.createRange();
            r.selectNodeContents(editor);
            r.collapse(false);
            sel.addRange(r);
        }
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.startContainer)) {
            const r = document.createRange();
            r.selectNodeContents(editor);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        const current = sel.getRangeAt(0);
        current.deleteContents();
        const br = document.createElement("br");
        current.insertNode(br);
        const zw = document.createTextNode("\u200B");
        br.parentNode?.insertBefore(zw, br.nextSibling);
        const after = document.createRange();
        after.setStartAfter(zw);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
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
    description: "Customizes the keyboard shortcuts for sending messages and creating new lines.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["input", "enter", "send", "chat", "quality of life"],
    settings,

    start() {
        document.addEventListener("keydown", onKey, { capture: true });
        const update = () => {
            tracked = selectOne(EDITOR_SELECTOR) as HTMLElement | null;
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
