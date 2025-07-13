/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

/**
 * Props for the FilterBar component
 */
export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
    /** The content to display inside the filter bar */
    children: React.ReactNode;
    /** Additional CSS classes to apply */
    className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    children,
    className,
    ...props
}) => (
    <div
        className={clsx(
            "flex items-center justify-start w-full gap-4",
            "rounded-lg py-2",
            className
        )}
        {...props}
    >
        {children}
    </div>
);
