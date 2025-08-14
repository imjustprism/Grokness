/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RadixSeparator from "@radix-ui/react-separator";
import clsx from "clsx";
import React from "react";

/**
 * @interface SeparatorProps
 * @property {string} [className] - Additional class names for custom styling.
 * @property {"horizontal" | "vertical"} [orientation="horizontal"] - The orientation of the separator.
 * @property {boolean} [decorative=true] - Whether the separator is decorative or semantic.
 */
export interface SeparatorProps {
    className?: string;
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
    ({ className, orientation = "horizontal", decorative = true }, ref) => (
        <RadixSeparator.Root
            ref={ref}
            decorative={decorative}
            orientation={orientation}
            className={clsx(
                "bg-border-l1",
                orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
                className
            )}
        />
    )
);

Separator.displayName = "Separator";
