/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsPanel } from "@plugins/_core/settingsUI/components/SettingsPanel";
import { SettingsTab } from "@plugins/_core/settingsUI/components/SettingsTab";
import { useSettingsLogic } from "@plugins/_core/settingsUI/hooks/useSettingsLogic";
import { useTabLogic } from "@plugins/_core/settingsUI/hooks/useTabLogic";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

const settingsLogger = new Logger("Settings", "#10b981");

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

let styleElement: HTMLStyleElement | null = null;
let mutationObserverManager: MutationObserverManager | null = null;
const rootsMap = new Map<HTMLElement, Root>();

const settingsPatch: IPatch = {
    apply() {
        try {
            styleElement = document.createElement("style");
            styleElement.id = "settings-ui-styles";
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        } catch (error) {
            settingsLogger.error("Failed to inject styles", error);
        }

        mutationObserverManager = new MutationObserverManager();

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
            }
            const rootContainer = dialog.querySelector("#grokness-root");
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
            },
        });

        observe();

        querySelectorAll('div[role="dialog"][data-state="open"]')
            .forEach(attachToDialog);

        window.addEventListener(
            "unload",
            () => {
                mutationObserverManager?.disconnectAll();
                rootsMap.forEach(root => root.unmount());
                rootsMap.clear();
            },
            { once: true }
        );
    },
    remove() {
        styleElement?.remove();
        styleElement = null;
        mutationObserverManager?.disconnectAll();
        mutationObserverManager = null;
        rootsMap.forEach(root => root.unmount());
        rootsMap.clear();
    }
};

export default definePlugin({
    name: "Settings",
    description: "Adds a settings to manage plugins",
    authors: [Devs.Prism],
    required: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    patches: [settingsPatch],
});
