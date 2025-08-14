/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import clsx from "clsx";
import React from "react";

/**
 * @interface PanelProps
 * @extends React.HTMLAttributes<HTMLDivElement>
 * @property {boolean} [isActive=true] - Controls visibility; when false, the panel is hidden via CSS display.
 */
interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Controls visibility; when false, the panel is hidden via CSS display */
    isActive?: boolean;
}

export const Panel: React.FC<PanelProps> = ({ isActive = true, className, style, children, ...rest }) => (
    <div
        className={clsx("flex-1 w-full h-full overflow-y-auto focus:outline-none", className)}
        style={{ display: isActive ? "flex" : "none", ...(style ?? {}) }}
        {...rest}
    >
        {children}
    </div>
);
