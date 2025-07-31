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
        className={clsx(
            "flex items-center gap-2 px-3",
            "h-10 flex-[3] rounded-xl border border-border-l1 bg-surface-l1 text-secondary",
            "hover:bg-button-ghost-hover active:bg-button-ghost-active",
            className
        )}
    >
        <Lucide name="Search" size={16} strokeWidth={2} className="flex-shrink-0" />
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            type="text"
            placeholder={placeholder}
            className={clsx(
                "h-full w-full bg-transparent text-sm",
                "text-fg-secondary placeholder:text-fg-secondary",
                "focus:outline-none"
            )}
            {...props}
        />
    </div>
);
