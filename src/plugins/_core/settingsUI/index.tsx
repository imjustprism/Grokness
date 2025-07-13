/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsPanel } from "@plugins/_core/settingsUI/components/SettingsPanel";
import { SettingsTab } from "@plugins/_core/settingsUI/components/SettingsTab";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { injectStyles } from "@utils/dom";
import { useSettingsLogic } from "@utils/hooks/useSettingsLogic";
import { useTabLogic } from "@utils/hooks/useTabLogic";
import { definePlugin, type IPatch } from "@utils/types";
import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

const SettingsUIComponent: React.FC<{ dialogElement: HTMLElement; }> = ({ dialogElement }) => {
    const {
        filterText,
        setFilterText,
        filterOption,
        setFilterOption,
        pendingChanges,
        sections,
        handleRestartChange,
        handlePluginToggle,
    } = useSettingsLogic();

    const { isActive, contentContainer, sidebarContainer } = useTabLogic(dialogElement);

    if (!contentContainer || !sidebarContainer) {
        return null;
    }

    return (
        <>
            {createPortal(<SettingsTab isActive={isActive} />, sidebarContainer)}
            {createPortal(
                <SettingsPanel
                    isActive={isActive}
                    filterText={filterText}
                    setFilterText={setFilterText}
                    filterOption={filterOption}
                    setFilterOption={setFilterOption}
                    pendingChanges={pendingChanges}
                    sections={sections}
                    handleRestartChange={handleRestartChange}
                    handlePluginToggle={handlePluginToggle}
                />,
                contentContainer
            )}
        </>
    );
};

let styleManager: { styleElement: HTMLStyleElement; cleanup: () => void; } | null = null;
let mutationObserver: MutationObserver | null = null;
const rootsMap = new Map<HTMLElement, Root>();

const settingsPatch: IPatch = {
    apply() {
        styleManager = injectStyles(styles, "settings-ui-styles");

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
                console.warn("[SettingsUI] mount failed:", err);
            }
        };

        const detachFromDialog = (dialog: HTMLElement) => {
            const root = rootsMap.get(dialog);
            if (root) {
                root.unmount();
                rootsMap.delete(dialog);
            }
            const rootContainer = dialog.querySelector("#grokness-root");
            if (rootContainer) {
                dialog.removeChild(rootContainer);
            }
        };

        mutationObserver = new MutationObserver(records => {
            records.forEach(record => {
                Array.from(record.addedNodes).forEach(node => {
                    if (
                        node instanceof HTMLElement &&
                        node.matches('div[role="dialog"][data-state="open"]')
                    ) {
                        attachToDialog(node);
                    }
                });
                Array.from(record.removedNodes).forEach(node => {
                    if (
                        node instanceof HTMLElement &&
                        node.matches('div[role="dialog"][data-state="open"]')
                    ) {
                        detachFromDialog(node);
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        document
            .querySelectorAll<HTMLElement>(
                'div[role="dialog"][data-state="open"]'
            )
            .forEach(attachToDialog);

        window.addEventListener(
            "unload",
            () => {
                mutationObserver?.disconnect();
                rootsMap.forEach(root => root.unmount());
                rootsMap.clear();
            },
            { once: true }
        );
    },
    remove() {
        styleManager?.cleanup();
        styleManager = null;
        mutationObserver?.disconnect();
        mutationObserver = null;
        rootsMap.forEach(root => root.unmount());
        rootsMap.clear();
    }
};

export default definePlugin({
    name: "Settings",
    description: "Adds a settings UI to manage plugins",
    authors: [Devs.Prism],
    required: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    patches: [settingsPatch],
});
