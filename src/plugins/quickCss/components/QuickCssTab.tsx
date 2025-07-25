/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TabButton } from "@components/TabButton";
import React from "react";

interface QuickCssTabProps {
    isActive: boolean;
}

export const QuickCssTab: React.FC<QuickCssTabProps> = ({ isActive }) => (
    <TabButton
        icon="Code2"
        label="Quick CSS"
        isActive={isActive}
        data-quickcss
    />
);
