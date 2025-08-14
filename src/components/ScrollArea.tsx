/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

/**
 * @interface ScrollAreaProps
 * @extends React.HTMLAttributes<HTMLDivElement>
 * @property {React.ReactNode} children - The content to be rendered inside the scroll area.
 * @property {string} [className] - Additional class names for custom styling.
 * @property {string} [viewportClassName] - Additional class names for the viewport.
 */
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    viewportClassName?: string;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
    ({ children, className, ...props }, ref) => (
        <div
            ref={ref}
            className={clsx("relative overflow-y-auto", className)}
            {...props}
        >
            {children}
        </div>
    )
);

ScrollArea.displayName = "ScrollArea";
