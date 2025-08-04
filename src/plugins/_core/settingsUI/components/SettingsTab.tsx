/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import React from "react";

interface SettingsTabProps {
    isActive: boolean;
    onClick: () => void;
    iconSize?: number;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ isActive, onClick, iconSize }) => (
    <Button
        icon="TestTubeDiagonal"
        iconSize={iconSize}
        isActive={isActive}
        onClick={onClick}
        variant="ghost"
        color="default"
        size="md"
        className="min-w-40 justify-start gap-3 border-none hover:bg-card-hover"
        data-grokness-tab
    >
        Grokness
    </Button>
);
