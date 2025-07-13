/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { LucideProps } from "lucide-react";
import * as LucideIcons from "lucide-react";
import React from "react";

// Create a type for valid Lucide icon names
type LucideIconName = keyof Omit<
    typeof LucideIcons,
    "createLucideIcon" | "IconNode" | "LucideProps"
>;

/**
 * LucideIcon component for rendering any Lucide icon by name
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LucideIcon name="Settings" />
 *
 * // With custom size and styling
 * <LucideIcon name="Heart" size={24} className="text-red-500" />
 *
 * // With all Lucide props
 * <LucideIcon
 *   name="Search"
 *   size={20}
 *   strokeWidth={1.5}
 *   className="text-blue-500"
 * />
 * ```
 */
export interface LucideIconProps extends Omit<LucideProps, "ref"> {
    /** The name of the Lucide icon to render */
    name: LucideIconName;
    /** Size of the icon (default: 24) */
    size?: number;
    /** Fallback icon name if the specified icon is not found */
    fallback?: LucideIconName;
}

export const LucideIcon = React.forwardRef<SVGSVGElement, LucideIconProps>(
    (
        { name, size = 24, fallback = "AlertCircle", ...props },
        ref
    ) => {
        let IconComponent = LucideIcons[name] as React.ComponentType<LucideProps> | undefined;

        if (!IconComponent) {
            console.warn(`Lucide icon "${name}" not found. Using fallback "${fallback}".`);
            IconComponent = LucideIcons[fallback] as React.ComponentType<LucideProps> | undefined;

            if (!IconComponent) {
                console.error(`Fallback Lucide icon "${fallback}" also not found.`);
                return null;
            }
        }

        return <IconComponent ref={ref} size={size} {...props} aria-hidden="true" />;
    }
);

LucideIcon.displayName = "LucideIcon";

export type { LucideIconName };

export { LucideIcons };
