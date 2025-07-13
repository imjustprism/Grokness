/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon } from "@components/LucideIcon";
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
    type: "text" | "number" | "select";
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
    /** Minimum value for number type */
    min?: number;
}

export const InputField: React.FC<InputFieldProps> = ({
    type,
    value,
    onChange,
    placeholder = "",
    options = [],
    className,
    min,
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedOption = options.find(opt => opt.value === value.toString());

    React.useEffect(() => {
        if (type !== "select") {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-input-select]")) {
                setIsOpen(false);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [type]);

    const commonClass = clsx(
        "h-8 py-1 px-3 text-sm bg-transparent focus:outline-none text-primary rounded-xl border border-border-l1",
        "transition-colors duration-200",
        "w-[140px]",
        className
    );

    if (type === "select") {
        return (
            <div className="relative" data-input-select>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={clsx(commonClass, "flex items-center justify-between")}
                >
                    {selectedOption?.label || placeholder || "Select..."}
                    <div
                        className={clsx(
                            "ml-2 transition-transform duration-200",
                            isOpen && "transform rotate-180"
                        )}
                    >
                        <LucideIcon name="ChevronDown" size={14} strokeWidth={2} />
                    </div>
                </button>
                {isOpen && (
                    <div
                        className={clsx(
                            "absolute top-full left-0 mt-1",
                            "bg-surface-l1 dark:bg-surface-l1 rounded-xl shadow-lg border border-border-l1",
                            "z-10 p-1 overflow-y-auto max-h-40",
                            "w-[140px]"
                        )}
                    >
                        <div className="flex flex-col gap-0.5">
                            {options.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full text-left px-2 py-1",
                                        "text-secondary focus:outline-none whitespace-nowrap",
                                        "transition-colors duration-200",
                                        "text-sm rounded-sm",
                                        option.value === value.toString()
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
    }

    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
            placeholder={placeholder}
            min={min}
            className={clsx(
                commonClass,
                "[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            )}
        />
    );
};
