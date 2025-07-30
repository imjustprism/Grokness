/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Lucide } from "@components/Lucide";
import { Logger } from "@utils/logger";
import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    pluginId?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

const errorBoundaryLogger = new Logger("ErrorBoundary", "#ef4444");

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false,
    };

    public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const context = this.props.pluginId ? `in plugin "${this.props.pluginId}"` : "";
        errorBoundaryLogger.error(`Uncaught rendering error ${context}:`, error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.75rem",
                    backgroundColor: "rgba(250, 204, 21, 0.1)",
                    border: "1px solid rgba(250, 204, 21, 0.3)",
                    borderRadius: "0.75rem",
                    fontFamily: "sans-serif",
                    textAlign: "center",
                    height: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden"
                }}>
                    <Lucide name="EyeOff" size={24} color="rgba(250, 204, 21, 0.7)" />
                    <p style={{
                        margin: "0.375rem 0 0 0",
                        fontWeight: 500,
                        color: "rgba(253, 230, 138, 1)",
                        fontSize: "0.75rem"
                    }}>
                        Component Failed
                    </p>
                    <p style={{
                        margin: "0.125rem 0 0 0",
                        fontSize: "0.625rem",
                        color: "rgba(250, 204, 21, 0.8)",
                        opacity: 0.8
                    }}>
                        Check console for details.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
