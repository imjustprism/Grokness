/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { querySelector } from "@utils/dom";
import { definePlugin } from "@utils/types";

const BUBBLE = "div.message-bubble.bg-surface-l2";
const ATTR = "data-quick-actions-listener";

const onDbl = (e: MouseEvent): void => {
    const bubble = e.currentTarget as HTMLElement;
    const container = bubble.closest<HTMLElement>("div.relative.group");
    if (!container) {
        return;
    }
    const edit = querySelector('button[aria-label="Edit"]', container) as HTMLButtonElement | null;
    edit?.click();
};

function attach(el: HTMLElement): void {
    if (el.hasAttribute(ATTR)) {
        return;
    }
    el.setAttribute(ATTR, "true");
    el.addEventListener("dblclick", onDbl);
}

function detach(el: HTMLElement): void {
    el.removeAttribute(ATTR);
    el.removeEventListener("dblclick", onDbl);
}

let mo: MutationObserver | null = null;

export default definePlugin({
    name: "Message Click Actions",
    description: "Adds click actions, such as double-click to edit.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["edit", "double-click", "chat", "quality of life"],

    start() {
        document.querySelectorAll<HTMLElement>(BUBBLE).forEach(attach);
        mo = new MutationObserver(muts => {
            for (const m of muts) {
                m.addedNodes.forEach(n => {
                    if (n instanceof HTMLElement) {
                        if (n.matches(BUBBLE)) {
                            attach(n);
                        }
                        n.querySelectorAll<HTMLElement>(BUBBLE).forEach(attach);
                    }
                });
                m.removedNodes.forEach(n => {
                    if (n instanceof HTMLElement && n.matches(BUBBLE)) {
                        detach(n);
                    }
                });
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        mo?.disconnect();
        document.querySelectorAll<HTMLElement>(BUBBLE).forEach(detach);
    },
});
