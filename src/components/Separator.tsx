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
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
    /** When true, expands horizontally to bleed through container padding */
    fullBleed?: boolean;
    /** Optional bleed amount in rem when fullBleed is enabled. Defaults to 1rem (4). */
    bleedRem?: number;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
    ({ className, orientation = "horizontal", decorative = true, fullBleed = false, bleedRem, style, ...rest }, ref) => {
        const bleed = typeof bleedRem === "number" ? bleedRem : (fullBleed ? 1 : 0);
        const inlineStyle: React.CSSProperties | undefined =
            orientation === "horizontal" && bleed > 0
                ? {
                    marginLeft: `-${bleed}rem`,
                    marginRight: `-${bleed}rem`,
                    width: `calc(100% + ${bleed * 2}rem)`,
                    ...style,
                }
                : style;
        return (
            <RadixSeparator.Root
                ref={ref}
                decorative={decorative}
                orientation={orientation}
                className={clsx(
                    "bg-border shrink-0",
                    orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
                    className
                )}
                style={inlineStyle}
                {...rest}
            />
        );
    }
);

Separator.displayName = "Separator";
