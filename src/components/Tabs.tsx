/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, type ButtonProps } from "@components/Button";
import type { LucideIconName } from "@components/Lucide";
import * as RTabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import React from "react";

/**
 * Props for the simple container panel used inside the settings modal.
 */
interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Controls visibility; when false the element is display:none. */
    isActive?: boolean;
}

export const Panel: React.FC<PanelProps> = ({ isActive = true, className, style, children, ...rest }) => (
    <div
        className={clsx("flex-1 w-full h-full focus:outline-none", className)}
        style={{ display: isActive ? "flex" : "none", ...(style ?? {}) }}
        {...rest}
    >
        {children}
    </div>
);

interface TabProps extends Omit<ButtonProps, "onClick"> {
    isActive: boolean;
    onClick: () => void;
    dataAttr?: string;
}

export const Tab: React.FC<TabProps> = ({ isActive, onClick, dataAttr, children, className, ...buttonProps }) => (
    <Button
        {...buttonProps}
        isActive={isActive}
        onClick={onClick}
        className={className}
        data-grokness-tab={dataAttr}
    >
        {children}
    </Button>
);

/**
 * Describes a single settings tab that can be registered at runtime.
 */
export type SettingsTabDescriptor = {
    /** Unique identifier used for the underlying Radix tab value. */
    id: string;
    /** Display label for the tab trigger. */
    label: string | React.ReactNode;
    /** Optional Lucide icon to render in the default trigger. */
    icon?: LucideIconName;
    /** Content render function. It should be pure and fast. */
    render: () => React.ReactNode;
    /** Sort key (ascending); falls back to `label` lexical order. */
    order?: number;
    /** When false (or function returning false) the tab is hidden. */
    visible?: boolean | (() => boolean);
    /** When true (or function returning true) the trigger is disabled. */
    disabled?: boolean | (() => boolean);
    /** Force Radix `Content` to remain mounted when inactive. */
    forceMount?: boolean;
};

type Listener = () => void;
/** Internal registry state */
const listeners = new Set<Listener>();
const tabsById = new Map<string, SettingsTabDescriptor>();

function emit(): void {
    for (const l of listeners) {
        try {
            l();
        } catch {
            // ignore
        }
    }
}

export function registerSettingsTab(descriptor: SettingsTabDescriptor): void {
    tabsById.set(descriptor.id, descriptor);
    emit();
}

export function registerSettingsTabs(descriptors: SettingsTabDescriptor[]): void {
    for (const d of descriptors) {
        tabsById.set(d.id, d);
    }
    emit();
}

export function updateSettingsTab(id: string, patch: Partial<SettingsTabDescriptor>): void {
    const cur = tabsById.get(id);
    if (!cur) {
        return;
    }
    tabsById.set(id, { ...cur, ...patch });
    emit();
}

export function unregisterSettingsTab(id: string): void {
    if (tabsById.delete(id)) {
        emit();
    }
}

function resolveFlag(flag?: boolean | (() => boolean)): boolean | undefined {
    if (typeof flag === "function") {
        try {
            return (flag as () => boolean)();
        } catch {
            return undefined;
        }
    }
    return flag;
}

export function getSettingsTabs(): SettingsTabDescriptor[] {
    const items = Array.from(tabsById.values());
    const visible = items.filter(t => resolveFlag(t.visible) !== false);
    visible.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.label).localeCompare(String(b.label)));
    return visible;
}

export function subscribeSettingsTabs(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useSettingsTabs(): SettingsTabDescriptor[] {
    const [value, setValue] = React.useState<SettingsTabDescriptor[]>(getSettingsTabs());
    React.useEffect(() => subscribeSettingsTabs(() => setValue(getSettingsTabs())), []);
    return value;
}

export type SettingsTabsViewProps = {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    hideSingleBar?: boolean;
    orientation?: "horizontal" | "vertical";
    activationMode?: "automatic" | "manual";
    dir?: "ltr" | "rtl";
    className?: string;
    listClassName?: string;
    triggerClassName?: string;
    contentClassName?: string;
    showIcons?: boolean;
    forceMountAll?: boolean;
    renderTrigger?: (tab: SettingsTabDescriptor, props: { value: string; isActive: boolean; onClick: () => void; }) => React.ReactNode;
};

export const SettingsTabsView: React.FC<SettingsTabsViewProps> = ({
    value,
    defaultValue,
    onValueChange,
    hideSingleBar = true,
    orientation = "horizontal",
    activationMode = "automatic",
    dir,
    className,
    listClassName,
    triggerClassName,
    contentClassName,
    showIcons = true,
    forceMountAll = false,
    renderTrigger,
}) => {
    const tabs = useSettingsTabs();
    const initial = defaultValue || tabs[0]?.id || "";
    const [internalValue, setInternalValue] = React.useState<string>(initial);
    const isControlled = typeof value === "string";
    const currentValue = isControlled ? (value as string) : internalValue;

    React.useEffect(() => {
        if (!tabs.find(t => t.id === currentValue)) {
            const next = tabs[0]?.id || "";
            if (isControlled) {
                onValueChange?.(next);
            } else {
                setInternalValue(next);
            }
        }
    }, [tabs, currentValue, isControlled, onValueChange]);

    if (tabs.length === 0) {
        return null;
    }

    const showBar = !hideSingleBar || tabs.length > 1;
    const handleValueChange = (v: string): void => {
        if (isControlled) {
            onValueChange?.(v);
        } else {
            setInternalValue(v);
        }
    };

    return (
        <RTabs.Root
            value={currentValue}
            onValueChange={handleValueChange}
            orientation={orientation}
            activationMode={activationMode}
            dir={dir}
            className={clsx("flex flex-col w-full h-full", className)}
        >
            {showBar && (
                <div className="px-2 pt-2">
                    <RTabs.List className={clsx("flex gap-2 flex-wrap", listClassName)}>
                        {tabs.map(t => {
                            const isActive = t.id === currentValue;
                            const disabled = resolveFlag(t.disabled) === true;
                            const content = renderTrigger
                                ? renderTrigger(t, { value: t.id, isActive, onClick: () => handleValueChange(t.id) })
                                : (
                                    <Button
                                        size="sm"
                                        variant={isActive ? "outline" : "ghost"}
                                        isActive={isActive}
                                        icon={showIcons ? t.icon : undefined}
                                        className={clsx("min-w-24", triggerClassName)}
                                    >
                                        {t.label}
                                    </Button>
                                );
                            return (
                                <RTabs.Trigger key={t.id} value={t.id} asChild disabled={disabled}>
                                    {content}
                                </RTabs.Trigger>
                            );
                        })}
                    </RTabs.List>
                </div>
            )}
            <div className={clsx("flex-1 w-full h-full pl-4 pr-4 pb-10 md:pr-4 overflow-scroll focus:outline-none", contentClassName)}>
                {tabs.map(t => (
                    <RTabs.Content key={t.id} value={t.id} className="outline-none" forceMount={Boolean(forceMountAll || t.forceMount) || undefined}>
                        <div className="flex flex-col w-full gap-6">
                            {t.render()}
                        </div>
                    </RTabs.Content>
                ))}
            </div>
        </RTabs.Root>
    );
};

