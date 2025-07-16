/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TabButton } from "@components/TabButton";
import React from "react";

/**
 * Props for the SettingsTab component
 */
interface SettingsTabProps {
    /** Controls whether the tab is currently active/selected */
    isActive: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ isActive }) => (
    <TabButton
        icon="TestTubeDiagonal"
        label="Grokness"
        isActive={isActive}
        data-grokness
    />
);
