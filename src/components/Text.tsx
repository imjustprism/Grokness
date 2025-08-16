/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Slot } from "@radix-ui/react-slot";
import { Text as RText } from "@radix-ui/themes";
import clsx from "clsx";
import React, { type ElementType } from "react";

type RadixTextProps = React.ComponentProps<typeof RText>;

export type TextProps = Omit<RadixTextProps, "as" | "color"> & {
    /** Render as another element/component. If "slot", uses Radix Slot composition. */
    as?: ElementType | "slot";
    /** Semantic tone mapping to our theme tokens */
    tone?: "default" | "secondary" | "primary" | "success" | "warning" | "danger";
    /** Force text to inherit font-size/line-height from parent */
    inheritSize?: boolean;
};

export const Text: React.FC<TextProps> = ({ as: As = "span", tone = "default", className, children, inheritSize = false, ...rest }) => {
    const toneClass =
        tone === "secondary" ? "text-secondary" :
            tone === "primary" ? "text-primary" :
                tone === "success" ? "text-green-400" :
                    tone === "warning" ? "text-yellow-400" :
                        tone === "danger" ? "text-red-400" : undefined;

    const Comp = As === "slot" ? Slot : As;

    // when using Slot, pass asChild to Radix Text so it forwards props
    const styleOverride = inheritSize ? { fontSize: "inherit", lineHeight: "inherit" } : undefined;

    return (
        <RText
            asChild={As === "slot" || Boolean((rest as unknown as { asChild?: boolean; }).asChild)}
            {...rest}
            className={clsx(toneClass, className)}
            style={{ ...(rest as { style?: React.CSSProperties; }).style, ...(styleOverride ?? {}) }}
        >
            <Comp>{children}</Comp>
        </RText>
    );
};

Text.displayName = "Text";

