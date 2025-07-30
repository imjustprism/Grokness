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
export interface DropdownOption {
    /** Display text for the option */
    label: string;
    /** Value associated with the option */
    value: string;
}

/**
 * Props for the DropdownMenu component
 */
export interface DropdownMenuProps {
    /** Array of options to display in the dropdown */
    options: DropdownOption[];
    /** Currently selected value */
    value: string;
    /** Callback fired when an option is selected */
    onChange: (value: string) => void;
    /** Placeholder text when no option is selected */
    placeholder?: string;
    /** Additional CSS classes to apply */
    className?: string;
    /** Width of the dropdown (Tailwind class) */
    width?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    width = "w-96",
}) => {
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
                    "h-[2.5rem] py-2.5 ps-[11px] pe-[11px]",
                    "bg-surface-l1 dark:bg-surface-l1 border border-border-l1 rounded-xl",
                    "text-secondary flex items-center justify-between",
                    "focus:outline-none focus:border-border-l3 focus-visible:ring-1",
                    "whitespace-nowrap active:bg-button-ghost-active",
                    "text-sm transition-colors duration-200",
                    width,
                    className
                )}
                style={
                    isHovered && !isOpen
                        ? { backgroundColor: "var(--button-ghost-hover)" }
                        : undefined
                }
            >
                {selectedOption?.label || placeholder}
                <div
                    className={clsx(
                        "ml-2 transition-transform duration-200",
                        isOpen && "transform rotate-180"
                    )}
                >
                    <Lucide name="ChevronDown" size={16} strokeWidth={2} />
                </div>
            </button>
            {isOpen && (
                <div
                    className={clsx(
                        "absolute top-full left-0 mt-2",
                        "bg-surface-l1 dark:bg-surface-l1 rounded-xl shadow-lg border border-border-l1",
                        "z-20 p-1.5",
                        width
                    )}
                >
                    <div className="flex flex-col gap-1">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "w-full text-left px-3 py-2",
                                    "text-secondary focus:outline-none whitespace-nowrap",
                                    "transition-colors duration-200",
                                    "text-sm rounded-md",
                                    option.value === value
                                        ? "bg-button-ghost-hover text-primary"
                                        : "hover:bg-button-ghost-hover hover:text-primary"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
