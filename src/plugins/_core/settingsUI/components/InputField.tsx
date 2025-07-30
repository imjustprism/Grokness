/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DropdownMenu, type DropdownOption } from "@plugins/_core/settingsUI/components/DropdownMenu";
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
    const commonClass = clsx(
        "h-10 py-2 px-3.5 text-sm bg-surface-l1 dark:bg-surface-l1 focus:outline-none text-primary rounded-xl border border-border-l1",
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
                onChange={value => onChange(value)}
                placeholder={placeholder || "Select..."}
                width="w-full"
            />
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
