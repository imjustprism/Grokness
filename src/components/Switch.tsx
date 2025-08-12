/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RadixSwitch from "@radix-ui/react-switch";
import clsx from "clsx";
import * as React from "react";

type Size = "default" | "small";

/**
 * Props for the Switch component
 */
export interface SwitchProps
    extends Omit<RadixSwitch.SwitchProps, "onChange" | "value"> {
    /** Size of the switch */
    size?: Size;
    /** Class names for the root */
    className?: string;
    /** Class names for the thumb */
    thumbClassName?: string;
    /** ID of the labelled-by element for a11y */
    ariaLabelledBy?: string;
    /** string value for form integrations */
    value?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    (
        {
            checked,
            disabled = false,
            size = "default",
            onCheckedChange,
            ariaLabelledBy,
            value = "on",
            className,
            thumbClassName,
            ...props
        },
        ref
    ) => {
        const switchClasses = clsx(
            "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-[1px] border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ring-card-border ring-1 disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-primary data-[state=unchecked]:bg-dove",
            "dark:data-[state=checked]:bg-ivory dark:data-[state=unchecked]:bg-button-secondary-selected",
            size === "default" ? "h-6 w-11" : "h-5 w-9",
            className
        );

        const thumbClasses = clsx(
            "pointer-events-none block rounded-full bg-white dark:bg-background shadow-lg ring-0 transition-transform ms-0.5",
            "data-[state=unchecked]:translate-x-0",
            size === "default"
                ? "h-4 w-4 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5"
                : "h-3 w-3 data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4",
            "dark:data-[state=unchecked]:bg-overlay",
            thumbClassName
        );

        return (
            <RadixSwitch.Root
                ref={ref}
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                aria-labelledby={ariaLabelledBy}
                value={value}
                className={switchClasses}
                {...props}
            >
                <RadixSwitch.Thumb className={thumbClasses} />
            </RadixSwitch.Root>
        );
    }
);

Switch.displayName = "Switch";

export { Switch };
