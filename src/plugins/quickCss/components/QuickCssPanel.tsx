/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SectionTitle } from "@components/SectionTitle";
import CodeEditor from "@uiw/react-textarea-code-editor";
import React, { useEffect, useState } from "react";

export const QuickCssPanel: React.FC<{ isActive: boolean; }> = ({ isActive }) => {
    const [css, setCss] = useState(localStorage.getItem("quick-css") || "");

    useEffect(() => {
        const style = document.getElementById("quick-css") as HTMLStyleElement | null;
        if (style) {
            style.textContent = css;
        }
        localStorage.setItem("quick-css", css);
    }, [css]);

    return (
        <div className="flex-1 w-full h-full pl-4 pr-4 pb-32 md:pr-4 overflow-y-auto flex flex-col gap-4 min-h-full" style={{ display: isActive ? "flex" : "none" }} data-quickcss-panel>
            <SectionTitle>Quick CSS</SectionTitle>
            <div className="w-full transition ease-in-out rounded-xl border border-border-l2">
                <CodeEditor
                    value={css}
                    language="css"
                    onChange={e => setCss(e.target.value)}
                    placeholder="Enter your custom CSS here..."
                    padding={15}
                    style={{
                        fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
                        fontSize: 12,
                        minHeight: "200px",
                        backgroundColor: "var(--background)",
                        border: "none",
                        borderRadius: "0.75rem",
                        resize: "none",
                        height: "108px !important",
                        color: "var(--fg-primary)",
                    }}
                />
            </div>
        </div>
    );
};
