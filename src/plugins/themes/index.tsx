/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ThemesPanel } from "@plugins/themes/components/ThemesPanel";
import { ThemesTab } from "@plugins/themes/components/ThemesTab";
import styles from "@plugins/themes/styles.css?raw";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

let styleElement: HTMLStyleElement | null = null;
const roots = new Map<HTMLElement, Root>();
let mutationObserverManager: MutationObserverManager | null = null;

const themesPatch: IPatch = {
    apply() {
        styleElement = document.createElement("style");
        styleElement.id = "themes-styles";
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        const selectedTheme = localStorage.getItem("selected-theme");
        if (selectedTheme) {
            document.documentElement.classList.add(selectedTheme);
        }

        mutationObserverManager = new MutationObserverManager();

        const attachToDialog = (dialog: HTMLElement) => {
            if (dialog.querySelector("#themes-root")) {
                return;
            }
            const rootContainer = document.createElement("div");
            rootContainer.id = "themes-root";
            dialog.appendChild(rootContainer);
            const root = createRoot(rootContainer);
            root.render(<ThemesComponent dialogElement={dialog} />);
            roots.set(dialog, root);
        };

        const detachFromDialog = (dialog: HTMLElement) => {
            const root = roots.get(dialog);
            if (root) {
                root.unmount();
                roots.delete(dialog);
            }
            const rootContainer = dialog.querySelector("#themes-root");
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
        const allRootContainers = querySelectorAll("#themes-root");
        allRootContainers.forEach(container => container.remove());
        const selectedTheme = localStorage.getItem("selected-theme");
        if (selectedTheme) {
            document.documentElement.classList.remove(selectedTheme);
        }
        localStorage.removeItem("selected-theme");
    }
};

const ThemesComponent: React.FC<{ dialogElement: HTMLElement; }> = ({ dialogElement }) => {
    const [isActive, setIsActive] = useState(false);

    const contentContainer = querySelector('div[class*="flex-1"]', dialogElement) as HTMLElement | null;

    const sidebarContainer = contentContainer?.parentElement ? querySelector("div > div", contentContainer.parentElement) as HTMLElement | null : null;

    useEffect(() => {
        if (!sidebarContainer) {
            return;
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const button = target.closest("button");
            if (!button) {
                return;
            }

            const isThemes = button.hasAttribute("data-themes");

            setIsActive(isThemes);

            querySelectorAll("button", sidebarContainer).forEach(btn => {
                const active = btn === button;
                btn.setAttribute("aria-selected", active ? "true" : "false");
                if (active) {
                    btn.classList.add("text-primary", "bg-button-ghost-hover");
                    btn.classList.remove("text-fg-primary");
                } else {
                    btn.classList.remove("text-primary", "bg-button-ghost-hover");
                    btn.classList.add("text-fg-primary");
                }
            });

            querySelectorAll("button svg", sidebarContainer).forEach(svg => {
                const btn = svg.closest("button");
                if (btn) {
                    const active = btn.getAttribute("aria-selected") === "true";
                    if (active) {
                        svg.classList.add("text-primary");
                        svg.classList.remove("text-secondary", "group-hover:text-primary");
                    } else {
                        svg.classList.add("text-secondary", "group-hover:text-primary");
                        svg.classList.remove("text-primary");
                    }
                }
            });
        };

        sidebarContainer.addEventListener("click", handleClick);
        return () => sidebarContainer.removeEventListener("click", handleClick);
    }, [sidebarContainer]);

    useEffect(() => {
        if (!contentContainer) {
            return;
        }

        const themesPanel = contentContainer.querySelector("[data-themes-panel]") as HTMLElement | null;
        const grokPanel = contentContainer.querySelector("[data-grokness-panel]") as HTMLElement | null;

        if (themesPanel) {
            themesPanel.style.display = isActive ? "flex" : "none";
        }

        if (isActive) {
            if (grokPanel) {
                grokPanel.style.display = "none";
            }

            Array.from(contentContainer.children).forEach(child => {
                const el = child as HTMLElement;
                if (!el.hasAttribute("data-themes-panel") && !el.hasAttribute("data-grokness-panel")) {
                    el.style.display = "none";
                }
            });
        }
    }, [isActive, contentContainer]);

    if (!contentContainer || !sidebarContainer) {
        return null;
    }

    return (
        <>
            {createPortal(<ThemesTab isActive={isActive} />, sidebarContainer)}
            {createPortal(<ThemesPanel isActive={isActive} />, contentContainer)}
        </>
    );
};

export default definePlugin({
    name: "Themes",
    description: "Allows selection of inbuilt themes like OLED.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["themes", "oled", "customize"],
    patches: [themesPatch],
});
