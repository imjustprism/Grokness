/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RadixTooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import React from "react";

/**
 * @interface TooltipProps
 * @property {React.ReactNode} content - The content to be displayed inside the tooltip.
 * @property {React.ReactNode} children - The element that will trigger the tooltip.
 * @property {"top" | "right" | "bottom" | "left"} [side="bottom"] - The preferred side of the trigger to render the tooltip.
 * @property {number} [sideOffset=8] - The offset from the trigger to render the tooltip.
 * @property {number} [delayDuration=600] - The duration from when the mouse enters the trigger until the tooltip opens.
 */
export interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    side = "bottom",
    sideOffset = 8,
    delayDuration = 600,
}) => (
    <RadixTooltip.Provider>
        <RadixTooltip.Root delayDuration={delayDuration}>
            <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
            <RadixTooltip.Portal>
                <RadixTooltip.Content
                    side={side}
                    sideOffset={sideOffset}
                    className={clsx(
                        "z-50 overflow-hidden rounded-md shadow-sm dark:shadow-none px-3 py-1.5 text-xs",
                        "animate-in fade-in-0 zoom-in-95 bg-primary text-background"
                    )}
                >
                    {content}
                </RadixTooltip.Content>
            </RadixTooltip.Portal>
        </RadixTooltip.Root>
    </RadixTooltip.Provider>
);

Tooltip.displayName = "Tooltip";
