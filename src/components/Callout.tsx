/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Callout as RCallout } from "@radix-ui/themes";
import clsx from "clsx";
import React from "react";

export interface CalloutProps extends React.ComponentProps<typeof RCallout.Root> {
    /** Optional leading icon element. */
    icon?: React.ReactNode;
    /** Optional title; renders in bold. (Radix expects a string) */
    title?: string;
    /** Additional class names for the outer container. */
    className?: string;
}

export const Callout: React.FC<CalloutProps> = ({ icon, title, children, className, color = "amber", ...props }) => (
    <RCallout.Root
        {...props}
        color={color}
        className={clsx(
            "rounded-lg border",
            className
        )}
    >
        {icon ? <RCallout.Icon>{icon}</RCallout.Icon> : null}
        {title ? <RCallout.Text className="text-sm font-medium">{title}</RCallout.Text> : null}
        {children ? <div className="text-xs text-secondary">{children}</div> : null}
    </RCallout.Root>
);

Callout.displayName = "Callout";

