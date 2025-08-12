/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide } from "@components/Lucide";
import clsx from "clsx";
import React from "react";

/**
 * Represents a single option in a dropdown menu
 */
export interface DropdownOption<V extends string = string> {
    /** Display text for the option */
    label: string;
    /** Value associated with the option */
    value: V;
}

/**
 * Props for the DropdownMenu component
 */
export interface DropdownMenuProps<V extends string = string> {
    /** Array of options to display in the dropdown */
    options: DropdownOption<V>[];
    /** Currently selected value */
    value: V;
    /** Callback fired when an option is selected */
    onChange: (value: V) => void;
    /** Placeholder text when no option is selected */
    placeholder?: string;
    /** Additional CSS classes to apply */
    className?: string;
    /** Width of the dropdown (Tailwind class) */
    width?: string;
}

export const DropdownMenu = <V extends string = string>({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    width = "w-96",
}: DropdownMenuProps<V>): React.JSX.Element => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const selectedOption = options.find(opt => opt.value === value);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-dropdown]")) {
                setIsOpen(false);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    return (
        <div className="relative" data-dropdown>
            <button
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={clsx(
                    "h-10",
                    "bg-surface-l1 dark:bg-surface-l1 border border-border-l1 rounded-xl",
                    "text-secondary flex items-center",
                    "focus:outline-none focus:border-border-l3 focus-visible:ring-1",
                    "whitespace-nowrap active:bg-button-ghost-active",
                    "text-sm",
                    width,
                    className
                )}
                style={
                    isHovered && !isOpen
                        ? { backgroundColor: "var(--button-ghost-hover)" }
                        : undefined
                }
            >
                <span className="flex-1 text-left px-3">{selectedOption?.label || placeholder}</span>
                <div
                    className={clsx(
                        "px-3 transition-transform duration-200",
                        isOpen && "transform rotate-180"
                    )}
                >
                    <Lucide name="ChevronDown" size={16} strokeWidth={2} />
                </div>
            </button>
            {isOpen && (
                <div
                    className={clsx(
                        "absolute top-full left-0 mt-2 z-50",
                        "rounded-2xl bg-surface-l4 border border-border-l1 p-1 shadow-sm shadow-black/5"
                    )}
                >
                    <div className="flex flex-col gap-px">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "w-full text-left px-3 py-2",
                                    "focus:outline-none whitespace-nowrap",
                                    "text-sm rounded-xl flex items-center justify-between",
                                    "text-white hover:bg-button-ghost-hover"
                                )}
                            >
                                <span>{option.label}</span>
                                <span className="w-4 h-4 flex-shrink-0 ml-2">
                                    {option.value === value && (
                                        <Lucide name="Check" size={16} className="text-primary" />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

