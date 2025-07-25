/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuickCssComponent } from "@plugins/quickCss/components/QuickCssComponent";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelectorAll } from "@utils/dom";
import { definePlugin, type IPatch } from "@utils/types";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

let styleElement: HTMLStyleElement | null = null;
const roots = new Map<HTMLElement, Root>();
let mutationObserverManager: MutationObserverManager | null = null;

const quickCssPatch: IPatch = {
    apply() {
        styleElement = document.createElement("style");
        styleElement.id = "quick-css";
        document.head.appendChild(styleElement);
        styleElement.textContent = localStorage.getItem("quick-css") || "";

        mutationObserverManager = new MutationObserverManager();

        const attachToDialog = (dialog: HTMLElement) => {
            if (dialog.querySelector("#quickcss-root")) {
                return;
            }
            const rootContainer = document.createElement("div");
            rootContainer.id = "quickcss-root";
            dialog.appendChild(rootContainer);
            const root = createRoot(rootContainer);
            root.render(<QuickCssComponent dialogElement={dialog} />);
            roots.set(dialog, root);
        };

        const detachFromDialog = (dialog: HTMLElement) => {
            const root = roots.get(dialog);
            if (root) {
                root.unmount();
                roots.delete(dialog);
            }
            const rootContainer = dialog.querySelector("#quickcss-root");
            if (rootContainer) {
                dialog.removeChild(rootContainer);
            }
        };

        const { observe } = mutationObserverManager.createObserver({
            target: document.body,
            options: { childList: true, subtree: true },
            callback: records => {
                records.forEach(record => {
                    Array.from(record.addedNodes).forEach(node => {
                        if (node instanceof HTMLElement && node.matches('div[role="dialog"][data-state="open"]')) {
                            attachToDialog(node);
                        }
                    });
                    Array.from(record.removedNodes).forEach(node => {
                        if (node instanceof HTMLElement && node.matches('div[role="dialog"][data-state="open"]')) {
                            detachFromDialog(node);
                        }
                    });
                });
            },
        });

        observe();

        querySelectorAll('div[role="dialog"][data-state="open"]').forEach(attachToDialog);

        window.addEventListener("unload", () => {
            mutationObserverManager?.disconnectAll();
            roots.forEach(root => root.unmount());
            roots.clear();
        }, { once: true });
    },
    remove() {
        styleElement?.remove();
        styleElement = null;
        mutationObserverManager?.disconnectAll();
        mutationObserverManager = null;
        roots.forEach(root => root.unmount());
        roots.clear();
        const allRootContainers = querySelectorAll("#quickcss-root");
        allRootContainers.forEach(container => container.remove());
    }
};

export default definePlugin({
    name: "Quick CSS",
    description: "Allows quick CSS overrides for the website.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["css", "override", "quick"],
    patches: [quickCssPatch],
});
