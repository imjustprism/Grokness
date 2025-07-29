/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide } from "@components/Lucide";
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
}

export const InputField: React.FC<InputFieldProps> = ({
    type,
    value,
    onChange,
    placeholder = "",
    options = [],
    className,
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
        "h-10 py-2 px-3.5 text-sm bg-transparent focus:outline-none text-primary rounded-xl border border-border-l1",
        "transition-colors duration-200",
        "w-48",
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
                        <Lucide name="ChevronDown" size={16} strokeWidth={2} />
                    </div>
                </button>
                {isOpen && (
                    <div
                        className={clsx(
                            "absolute top-full left-0 mt-1",
                            "bg-surface-l1 dark:bg-surface-l1 rounded-xl shadow-lg border border-border-l1",
                            "z-10 p-1 overflow-y-auto max-h-40",
                            "w-48"
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
                                        "text-sm rounded-md",
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
            type={type === "number" ? "text" : type}
            inputMode={type === "number" ? "numeric" : undefined}
            value={value.toString()}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={clsx(commonClass)}
        />
    );
};
