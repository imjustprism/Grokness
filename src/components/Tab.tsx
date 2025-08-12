/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, type ButtonProps } from "@components/Button";
import React from "react";

/**
 * Props for the generic Tab component
 */
interface TabProps extends Omit<ButtonProps, "onClick"> {
    /** Whether the tab is currently active/selected */
    isActive: boolean;
    /** Click handler to activate the tab */
    onClick: () => void;
    /** Custom data attribute value for `data-grokness-tab` */
    dataAttr?: string;
}

export const Tab: React.FC<TabProps> = ({ isActive, onClick, dataAttr, children, className, ...buttonProps }) => (
    <Button
        {...buttonProps}
        isActive={isActive}
        onClick={onClick}
        className={className}
        data-grokness-tab={dataAttr}
    >
        {children}
    </Button>
);

