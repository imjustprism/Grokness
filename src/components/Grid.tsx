/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

/**
 * Props for the Grid component
 */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
    /** The content to display inside the grid */
    children: React.ReactNode;
    /** Number of columns in the grid */
    cols?: 1 | 2 | 3 | 4;
    /** Gap size between grid items */
    gap?: "none" | "sm" | "md" | "lg";
    /** Additional CSS classes to apply */
    className?: string;
}

export const Grid: React.FC<GridProps> = ({
    children,
    cols = 2,
    gap = "md",
    className,
    ...props
}) => {
    const colStyles: Record<Exclude<GridProps["cols"], undefined>, string> = {
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-4",
    };

    const gapStyles = {
        none: "gap-0",
        sm: "gap-2",
        md: "gap-4",
        lg: "gap-6",
    };

    return (
        <div
            className={clsx("grid", colStyles[cols], gapStyles[gap], className)}
            {...props}
        >
            {children}
        </div>
    );
};
