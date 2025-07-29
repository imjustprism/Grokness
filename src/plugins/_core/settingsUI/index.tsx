/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsPanel } from "@plugins/_core/settingsUI/components/SettingsPanel";
import { SettingsTab } from "@plugins/_core/settingsUI/components/SettingsTab";
import { useSettingsLogic } from "@plugins/_core/settingsUI/hooks/useSettingsLogic";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

const settingsLogger = new Logger("Settings", "#10b981");

const SettingsUIComponent: React.FC<{ dialogElement: HTMLElement; }> = ({ dialogElement }) => {
    const settingsLogic = useSettingsLogic();
    const [isGroknessActive, setIsGroknessActive] = useState(false);

    const contentAreaElement = querySelector('div[class*="overflow-scroll"]', dialogElement);
    const sidebarAreaElement = querySelector('div[class*="pl-3 pb-3"]', dialogElement);

    useEffect(() => {
        if (!sidebarAreaElement) {
            return;
        }

        const handleTabClick = (event: MouseEvent) => {
            const targetTabButton = (event.target as HTMLElement).closest("button");
            if (!targetTabButton || !sidebarAreaElement.contains(targetTabButton)) {
                return;
            }

            const isGrokness = targetTabButton.hasAttribute("data-grokness-tab");
            setIsGroknessActive(isGrokness);

            sidebarAreaElement.querySelectorAll("button").forEach(sidebarButton => {
                const active = sidebarButton === targetTabButton;
                sidebarButton.setAttribute("aria-selected", String(active));

                if (sidebarButton.hasAttribute("data-grokness-tab")) {
                    return;
                }

                if (active) {
                    sidebarButton.classList.add("text-primary", "bg-button-ghost-hover");
                    sidebarButton.classList.remove("text-fg-primary");
                } else {
                    sidebarButton.classList.remove("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    sidebarButton.classList.add("text-fg-primary");
                }

                const svg = sidebarButton.querySelector("svg");
                if (svg) {
                    svg.classList.toggle("text-primary", active);
                    svg.classList.toggle("text-secondary", !active);
                }
            });
        };

        sidebarAreaElement.addEventListener("click", handleTabClick as EventListener);
        return () => sidebarAreaElement.removeEventListener("click", handleTabClick as EventListener);
    }, [sidebarAreaElement]);

    useEffect(() => {
        if (!contentAreaElement) {
            return;
        }

        Array.from(contentAreaElement.children).forEach(childNode => {
            const childElement = childNode as HTMLElement;
            if (childElement.hasAttribute("data-grokness-panel")) {
                childElement.style.display = isGroknessActive ? "flex" : "none";
            } else {
                childElement.style.display = isGroknessActive ? "none" : "flex";
            }
        });
    }, [isGroknessActive, contentAreaElement]);

    if (!contentAreaElement || !sidebarAreaElement) {
        return null;
    }

    return (
        <>
            {createPortal(<SettingsTab isActive={isGroknessActive} onClick={() => setIsGroknessActive(true)} />, sidebarAreaElement)}
            {createPortal(<SettingsPanel isActive={isGroknessActive} {...settingsLogic} />, contentAreaElement)}
        </>
    );
};

const settingsPatch: IPatch = (() => {
    const rootsMap = new Map<HTMLElement, Root>();
    const observerManager = new MutationObserverManager();
    let observerDisconnect: (() => void) | null = null;
    let styleElement: HTMLStyleElement | null = null;

    const attachToDialog = (dialog: HTMLElement) => {
        if (dialog.querySelector("#grokness-root")) {
            return;
        }

        const rootContainer = document.createElement("div");
        rootContainer.id = "grokness-root";
        dialog.appendChild(rootContainer);

        try {
            const root = createRoot(rootContainer);
            root.render(<SettingsUIComponent dialogElement={dialog} />);
            rootsMap.set(dialog, root);
        } catch (err) {
            settingsLogger.warn("mount failed:", err);
        }
    };

    const detachFromDialog = (dialog: HTMLElement) => {
        const root = rootsMap.get(dialog);
        if (root) {
            root.unmount();
            rootsMap.delete(dialog);
            dialog.querySelector("#grokness-root")?.remove();
        }
    };

    return {
        apply() {
            styleElement = document.createElement("style");
            styleElement.id = "settings-ui-styles";
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);

            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: records => {
                    for (const record of records) {
                        record.addedNodes.forEach(node => {
                            if (node instanceof HTMLElement && node.matches('div[role="dialog"][data-state="open"]')) {
                                attachToDialog(node);
                            }
                        });
                        record.removedNodes.forEach(node => {
                            if (node instanceof HTMLElement && node.matches('div[role="dialog"]')) {
                                detachFromDialog(node);
                            }
                        });
                    }
                },
            });

            observerDisconnect = disconnect;
            observe();
            querySelectorAll('div[role="dialog"][data-state="open"]').forEach(attachToDialog);
        },
        remove() {
            styleElement?.remove();
            observerDisconnect?.();
            rootsMap.forEach((root, dialog) => detachFromDialog(dialog));
        }
    };
})();

export default definePlugin({
    name: "Settings UI",
    description: "Adds a settings panel to manage Grokness plugins.",
    authors: [Devs.Prism],
    required: true,
    hidden: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    patches: [settingsPatch],
});
