/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Grid } from "@components/Grid";
import { SectionTitle } from "@components/SectionTitle";
import { ThemeButton } from "@plugins/themes/components/ThemeButton";
import React, { useEffect, useState } from "react";

const themes = [
    { name: "OLED", description: "OLED optimized theme with deep blacks", className: "theme-oled" },
];

export const ThemesPanel: React.FC<{ isActive: boolean; }> = ({ isActive }) => {
    const [selectedTheme, setSelectedTheme] = useState(localStorage.getItem("selected-theme") || "");

    useEffect(() => {
        if (selectedTheme) {
            document.documentElement.classList.add(selectedTheme);
            localStorage.setItem("selected-theme", selectedTheme);
        } else {
            document.documentElement.classList.remove("theme-oled");
            localStorage.removeItem("selected-theme");
        }
    }, [selectedTheme]);

    return (
        <div className="flex-1 w-full h-full pl-4 pr-4 pb-32 md:pr-4 overflow-y-auto flex flex-col gap-4 min-h-full" style={{ display: isActive ? "flex" : "none" }} data-themes-panel>
            <SectionTitle>Themes</SectionTitle>
            <Grid cols={2} gap="sm">
                {themes.map(theme => (
                    <ThemeButton
                        key={theme.name}
                        name={theme.name}
                        description={theme.description}
                        isSelected={selectedTheme === theme.className}
                        onClick={() => setSelectedTheme(selectedTheme === theme.className ? "" : theme.className)}
                    />
                ))}
            </Grid>
        </div>
    );
};
