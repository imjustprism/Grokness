/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { DropdownMenu, type DropdownOption } from "@components/DropdownMenu";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { Grid } from "@components/Grid";
import { InputField } from "@components/InputField";
import { Panel } from "@components/Panel";
import { Subheader } from "@components/Subheader";
import { Tab } from "@components/Tab";
import { PluginCard } from "@plugins/_core/settingsUI/components/PluginCard";
import { useSettingsLogic } from "@plugins/_core/settingsUI/hooks/useSettingsLogic";
import styles from "@plugins/_core/settingsUI/styles.css?raw";
import { Devs } from "@utils/constants";
import { selectOne } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import definePlugin, { Patch } from "@utils/types";
import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SettingsUIComponent: React.FC<{ rootElement?: HTMLElement; }> = ({ rootElement }) => {
    const [active, setActive] = useState(false);
    const logic = useSettingsLogic();

    if (!rootElement) {
        return null;
    }

    const dialogRoot = selectOne(LOCATORS.SETTINGS_MODAL.dialog, rootElement) ?? rootElement;
    const contentArea = selectOne(LOCATORS.SETTINGS_MODAL.contentArea, dialogRoot);
    const sidebarArea = selectOne(LOCATORS.SETTINGS_MODAL.leftNavContainer, dialogRoot);

    useEffect(() => {
        if (!sidebarArea) {
            return;
        }
        const onClick = (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest("button");
            if (!btn || !sidebarArea.contains(btn)) {
                return;
            }
            const isGrokness = btn.hasAttribute("data-grokness-tab");
            setActive(isGrokness);
            sidebarArea.querySelectorAll("button").forEach(b => {
                const activeBtn = b === btn;
                b.setAttribute("aria-selected", String(activeBtn));
                if (b.hasAttribute("data-grokness-tab")) {
                    return;
                }
                if (activeBtn) {
                    b.classList.add("text-primary", "bg-button-ghost-hover");
                    b.classList.remove("text-fg-primary");
                } else {
                    b.classList.remove("text-primary", "bg-button-ghost-hover", "[&>svg]:text-primary");
                    b.classList.add("text-fg-primary");
                }
                const svg = b.querySelector("svg");
                if (svg) {
                    svg.classList.toggle("text-primary", activeBtn);
                    svg.classList.toggle("text-secondary", !activeBtn);
                }
            });
        };
        sidebarArea.addEventListener("click", onClick as EventListener);
        return () => sidebarArea.removeEventListener("click", onClick as EventListener);
    }, [sidebarArea]);

    useEffect(() => {
        if (!contentArea) {
            return;
        }
        Array.from(contentArea.children).forEach(n => {
            const el = n as HTMLElement;
            if (el.hasAttribute("data-grokness-panel")) {
                el.style.display = active ? "flex" : "none";
            } else {
                el.style.display = active ? "none" : "flex";
            }
        });
    }, [active, contentArea]);

    useEffect(() => {
        if (!contentArea) {
            return;
        }
        const area = contentArea as HTMLElement;
        if (active) {
            if (area.dataset.groknessPrevPaddingRight == null) {
                area.dataset.groknessPrevPaddingRight = area.style.paddingRight || "";
            }
            if (area.dataset.groknessPrevOverflowY == null) {
                area.dataset.groknessPrevOverflowY = area.style.overflowY || "";
            }
            area.style.paddingRight = "0px";
            area.style.overflowY = "hidden";
        } else {
            const prevPR = area.dataset.groknessPrevPaddingRight ?? "";
            const prevOY = area.dataset.groknessPrevOverflowY ?? "";
            area.style.paddingRight = prevPR;
            area.style.overflowY = prevOY;
            delete area.dataset.groknessPrevPaddingRight;
            delete area.dataset.groknessPrevOverflowY;
        }
        return () => {
            const prevPR = area.dataset.groknessPrevPaddingRight ?? "";
            const prevOY = area.dataset.groknessPrevOverflowY ?? "";
            area.style.paddingRight = prevPR;
            area.style.overflowY = prevOY;
            delete area.dataset.groknessPrevPaddingRight;
            delete area.dataset.groknessPrevOverflowY;
        };
    }, [active, contentArea]);

    if (!contentArea || !sidebarArea) {
        return null;
    }

    const filterOptions: DropdownOption<"show_all" | "show_enabled" | "show_disabled">[] = useMemo(() => [
        { label: "Show All", value: "show_all" },
        { label: "Show Enabled", value: "show_enabled" },
        { label: "Show Disabled", value: "show_disabled" },
    ], []);

    const tabMountRef = React.useRef<HTMLElement | null>(null);

    const getTabMountContainer = (): HTMLElement | null => {
        if (!sidebarArea) {
            return null;
        }
        let mount = sidebarArea.querySelector<HTMLElement>("[data-grokness-settings-tab]");
        if (!mount) {
            mount = document.createElement("div");
            mount.setAttribute("data-grokness-settings-tab", "true");
            const devToolsBtn = selectOne(LOCATORS.SETTINGS_MODAL.navButtonByText("Dev Tools"), dialogRoot);
            if (devToolsBtn && devToolsBtn.parentElement === sidebarArea) {
                sidebarArea.insertBefore(mount, devToolsBtn.nextSibling);
            } else if (devToolsBtn) {
                devToolsBtn.insertAdjacentElement("afterend", mount);
            } else {
                sidebarArea.appendChild(mount);
            }
        }
        tabMountRef.current = mount;
        return mount;
    };

    useEffect(() => () => {
        const mount = tabMountRef.current;
        if (mount && mount.parentElement) {
            mount.remove();
            tabMountRef.current = null;
        }
    }, []);

    const PanelBody = (
        <Panel isActive={active} data-grokness-panel className="flex-1 w-full h-full pl-4 pb-32">
            <div className="flex flex-col w-full gap-4 min-h-full pr-4">
                {Object.keys(logic.pendingChanges).length > 0 && (
                    <div className="w-full mb-6">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r rounded-lg shadow-lg border from-yellow-800/50 to-yellow-700/50 border-yellow-600">
                            <div className="flex flex-col gap-1">
                                <div className="text-white text-sm font-medium">Restart Required!</div>
                                <div className="text-xs text-gray-400">Restart to apply new plugins and settings</div>
                            </div>
                            <Button onClick={() => location.reload()} variant="outline" color="warning">Restart</Button>
                        </div>
                    </div>
                )}
                {logic.sections.map(({ title, items }) => (
                    <div key={title} className="w-full mb-4">
                        {title === "Required Plugins" && (
                            <div className="mb-6">
                                <div data-orientation="horizontal" role="none" className="shrink-0 bg-border h-[1px] w-full" />
                            </div>
                        )}
                        <Subheader>{title}</Subheader>
                        {title === "Filters" ? (
                            <div className={clsx("flex items-center justify-start w-full gap-4", "rounded-lg py-2")}>
                                <div className="flex-1">
                                    <InputField
                                        type="search"
                                        value={logic.filterText}
                                        onChange={v => logic.setFilterText(String(v))}
                                        placeholder="Search for a plugin..."
                                        variant="search"
                                    />
                                </div>
                                <div className="ml-auto">
                                    <DropdownMenu
                                        options={filterOptions}
                                        value={logic.filterOption}
                                        onChange={logic.setFilterOption}
                                        className="w-48"
                                        width="w-48"
                                    />
                                </div>
                            </div>
                        ) : (
                            <Grid cols={2} gap="md">
                                {items.map(plugin => (
                                    <ErrorBoundary key={plugin.id} pluginId={plugin.id}>
                                        <PluginCard
                                            plugin={plugin}
                                            onToggle={logic.handlePluginToggle}
                                            onRestartChange={logic.handleRestartChange}
                                        />
                                    </ErrorBoundary>
                                ))}
                            </Grid>
                        )}
                    </div>
                ))}
            </div>
        </Panel>
    );

    return (
        <>
            {(() => {
                const target = getTabMountContainer();
                return target
                    ? createPortal(
                        <Tab
                            isActive={active}
                            onClick={() => setActive(true)}
                            icon="TestTubeDiagonal"
                            variant="ghost"
                            color="default"
                            size="md"
                            className="min-w-40 justify-start gap-3 border-none hover:bg-card-hover"
                            dataAttr="true"
                        >
                            Grokness
                        </Tab>,
                        target
                    )
                    : null;
            })()}
            {createPortal(PanelBody, contentArea)}
        </>
    );
};

export default definePlugin({
    name: "Settings",
    description: "Adds a settings panel to manage Grokness plugins.",
    authors: [Devs.Prism],
    required: true,
    hidden: true,
    category: "utility",
    tags: ["settings", "ui", "core"],
    styles,
    patches: [
        Patch.ui('div[role="dialog"][data-state="open"]')
            .forEach()
            .component(SettingsUIComponent)
            .parent(el => el)
            .build(),
    ],
});
