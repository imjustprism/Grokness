/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Card as RadixCard } from "@radix-ui/themes";
import clsx from "clsx";
import React from "react";

export interface CardProps extends React.ComponentProps<typeof RadixCard> {
    className?: string;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => (
    <RadixCard
        {...props}
        className={clsx(
            "bg-surface-l1 border border-border-l1 rounded-xl",
            "transition-colors duration-200 hover:bg-surface-l2",
            className
        )}
    >
        {children}
    </RadixCard>
);

Card.displayName = "Card";

