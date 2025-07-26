/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TabButton } from "@components/TabButton";
import React from "react";

interface ThemesTabProps {
    isActive: boolean;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({ isActive }) => (
    <TabButton
        icon="Palette"
        label="Themes"
        isActive={isActive}
        data-themes
    />
);
