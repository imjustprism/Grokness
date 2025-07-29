/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide } from "@components/Lucide";
import clsx from "clsx";
import React from "react";

/**
 * Props for the SearchInput component
 */
export interface SearchInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    /** Current value of the search input */
    value: string;
    /** Callback function when the input value changes */
    onChange: (value: string) => void;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Additional CSS classes to apply */
    className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className,
    ...props
}) => (
    <div
        data-sidebar="menu-button"
        data-active="false"
        tabIndex={-1}
        className={clsx(
            "peer/menu-button flex items-center gap-2 overflow-hidden text-left outline-none",
            "ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-1",
            "group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 [&>span:last-child]:truncate [&>svg]:shrink-0",
            "hover:text-primary text-sm hover:bg-button-ghost-hover",
            "data-[state=open]:hover:bg-button-ghost-hover active:bg-button-ghost-active",
            "data-[active=true]:bg-button-ghost-active py-2.5 ps-[11px] pe-[11px]",
            "rounded-xl border border-border-l1 bg-surface-l1 justify-between text-secondary",
            "h-[2.5rem] relative flex-[3]",
            className
        )}
    >
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            type="text"
            placeholder={placeholder}
            className={clsx(
                "bg-transparent text-fg-secondary placeholder:text-fg-secondary",
                "focus:outline-none focus:border-none",
                "text-sm w-full pr-8"
            )}
            {...props}
        />
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <Lucide name="Search" size={18} strokeWidth={2} />
        </div>
    </div>
);
