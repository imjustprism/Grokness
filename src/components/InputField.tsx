/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DropdownMenu, type DropdownOption } from "@components/DropdownMenu";
import { Lucide, type LucideIconName } from "@components/Lucide";
import clsx from "clsx";
import React from "react";

/**
 * Represents a single option in a select input
 */
export interface InputOption {
    /** Display text for the option */
    label: string;
    /** Value associated with the option */
    value: string;
}

/**
 * Props for the InputField component
 */
export interface InputFieldProps {
    /** Type of input field */
    type: "text" | "number" | "select" | "search";
    /** Current value of the input */
    value: string | number;
    /** Callback fired when the value changes */
    onChange: (value: string | number) => void;
    /** Placeholder text for text/number inputs */
    placeholder?: string;
    /** Array of options for select type */
    options?: InputOption[];
    /** Additional CSS classes */
    className?: string;
    /** Visual variant for text-like inputs */
    variant?: "default" | "search";
    /** Optional icon name for search variant (defaults to "Search") */
    iconName?: LucideIconName;
}

export const InputField: React.FC<InputFieldProps> = ({
    type,
    value,
    onChange,
    placeholder = "",
    options = [],
    className,
    variant,
    iconName,
}) => {
    const commonClass = clsx(
        "h-10 px-3.5 flex items-center text-sm bg-surface-l1 dark:bg-surface-l1 focus:outline-none text-primary rounded-xl border border-border-l1",
        "transition-colors duration-200",
        "w-full",
        className
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (type === "number") {
            const sanitizedValue = inputValue.replace(/[^0-9]/g, "");
            onChange(sanitizedValue === "" ? 0 : parseInt(sanitizedValue, 10));
        } else {
            onChange(inputValue);
        }
    };

    if (type === "select") {
        const dropdownOptions: DropdownOption[] = options.map(opt => ({ label: opt.label, value: opt.value }));

        return (
            <DropdownMenu
                options={dropdownOptions}
                value={value.toString()}
                onChange={(next: string) => onChange(next)}
                placeholder={placeholder || "Select..."}
                width="w-full"
            />
        );
    }

    // Search-style variant with leading icon and special container styling
    if (type === "search" || variant === "search") {
        return (
            <div
                className={clsx(
                    "flex items-center gap-2 px-3",
                    "h-10 rounded-xl border border-border-l1 bg-surface-l1 text-secondary",
                    "hover:bg-button-ghost-hover active:bg-button-ghost-active",
                    className
                )}
            >
                <Lucide name={(iconName || "Search") as LucideIconName} size={16} strokeWidth={2} className="flex-shrink-0" />
                <input
                    value={value.toString()}
                    onChange={e => onChange(e.target.value)}
                    type="text"
                    placeholder={placeholder || "Search..."}
                    className={clsx(
                        "h-full w-full bg-transparent text-sm",
                        "text-fg-secondary placeholder:text-fg-secondary",
                        "focus:outline-none"
                    )}
                />
            </div>
        );
    }

    return (
        <input
            type={type === "number" ? "text" : type}
            inputMode={type === "number" ? "numeric" : undefined}
            value={value.toString()}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={clsx(commonClass)}
        />
    );
};

