/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    type AnySelector,
    DomSelectorBuilder,
    selectOne
} from "@utils/dom";
import { Logger } from "@utils/logger";
import {
    type InjectedComponentProps,
    type IPluginCodePatch,
    type IPluginUIPatch,
    type PluginPatch,
    type SimpleUIPatch
} from "@utils/types";
import type React from "react";

const logger = new Logger("PatchBuilder", "#8b5cf6");

/**
 * Result type for patch builder operations.
 */
export type PatchBuilderResult<T = void> =
    | { readonly success: true; readonly data: T; }
    | { readonly success: false; readonly error: Error; };

/**
 * Enhanced insert position options with better type safety.
 */
export type InsertPosition =
    | "beforebegin"
    | "afterbegin"
    | "beforeend"
    | "afterend"
    | "replace";

/**
 * Configuration for UI patches with enhanced type safety.
 */
export interface UIPatchConfig {
    readonly component: React.ComponentType<InjectedComponentProps>;
    readonly target: AnySelector;
    readonly insertPosition?: InsertPosition;
    readonly predicate?: (element: HTMLElement) => boolean;
    readonly observerDebounce?: number;
    readonly getTargetParent?: (element: HTMLElement) => HTMLElement | null;
    readonly referenceNode?: (parent: HTMLElement, target: HTMLElement) => Node | null;
}

interface MutableUIPatchConfig {
    component?: React.ComponentType<InjectedComponentProps>;
    target?: AnySelector;
    insertPosition?: InsertPosition;
    predicate?: (element: HTMLElement) => boolean;
    observerDebounce?: number;
    getTargetParent?: (element: HTMLElement) => HTMLElement | null;
    referenceNode?: (parent: HTMLElement, target: HTMLElement) => Node | null;
}

/**
 * Configuration for code patches with enhanced type safety.
 */
export interface CodePatchConfig {
    readonly selector: string;
    readonly predicate?: () => boolean | Promise<boolean>;
    readonly code: string;
    readonly all?: boolean;
    readonly group?: boolean;
    readonly noWarn?: boolean;
    readonly timeout?: number;
    readonly runAt?: "document-start" | "document-end" | "document-ready";
}

interface MutableCodePatchConfig {
    selector?: string;
    predicate?: () => boolean | Promise<boolean>;
    code?: string;
    all?: boolean;
    group?: boolean;
    noWarn?: boolean;
    timeout?: number;
    runAt?: "document-start" | "document-end" | "document-ready";
}

/**
 * Fluent builder for creating UI patches with modern patterns.
 */
export class UIPatchBuilder {
    private config: MutableUIPatchConfig = {};

    /**
     * Create a UI patch with a React component.
     */
    static withComponent(component: React.ComponentType<InjectedComponentProps>): UIPatchBuilder {
        const builder = new UIPatchBuilder();
        builder.config.component = component;
        return builder;
    }

    /**
     * Set the target selector for the patch.
     */
    target(selector: AnySelector): this {
        this.config.target = selector;
        return this;
    }

    /**
     * Set the target using a DOM selector builder.
     */
    targetBuilder(): DomSelectorBuilder {
        return DomSelectorBuilder.css("");
    }

    /**
     * Set the insert position for the component.
     */
    insertAt(position: InsertPosition): this {
        this.config.insertPosition = position;
        return this;
    }

    /**
     * Set a predicate function to filter target elements.
     */
    when(predicate: (element: HTMLElement) => boolean): this {
        this.config.predicate = predicate;
        return this;
    }

    /**
     * Set the observer debounce delay.
     */
    debounce(ms: number): this {
        this.config.observerDebounce = ms;
        return this;
    }

    /**
     * Set a custom target parent resolver.
     */
    parentResolver(resolver: (element: HTMLElement) => HTMLElement | null): this {
        this.config.getTargetParent = resolver;
        return this;
    }

    /**
     * Set a custom reference node resolver.
     */
    referenceResolver(resolver: (parent: HTMLElement, target: HTMLElement) => Node | null): this {
        this.config.referenceNode = resolver;
        return this;
    }

    /**
     * Build the UI patch configuration.
     */
    build(): IPluginUIPatch {
        try {
            if (!this.config.component) {
                throw new Error("Component is required");
            }
            if (!this.config.target) {
                throw new Error("Target selector is required");
            }

            const patch: IPluginUIPatch = {
                component: this.config.component,
                target: this.config.target,
                predicate: this.config.predicate,
                observerDebounce: this.config.observerDebounce,
                getTargetParent: this.config.getTargetParent,
                referenceNode: this.config.referenceNode,
                insertPosition: this.config.insertPosition as "before" | "after" | "prepend" | "append" | undefined,
            };

            return patch;
        } catch (error) {
            logger.error("Failed to build UI patch:", error);
            throw error;
        }
    }

}

/**
 * Fluent builder for creating code patches with modern patterns.
 */
export class CodePatchBuilder {
    private config: MutableCodePatchConfig = {};

    /**
     * Create a code patch with JavaScript code.
     */
    static withCode(code: string): CodePatchBuilder {
        const builder = new CodePatchBuilder();
        builder.config.code = code;
        return builder;
    }

    /**
     * Set the target selector for the patch.
     */
    target(selector: string): this {
        this.config.selector = selector;
        return this;
    }

    /**
     * Set a predicate function to determine if the patch should run.
     */
    when(predicate: () => boolean | Promise<boolean>): this {
        this.config.predicate = predicate;
        return this;
    }

    /**
     * Apply the patch to all matching elements.
     */
    applyToAll(): this {
        this.config.all = true;
        return this;
    }

    /**
     * Set a group name for the patch.
     */
    group(enabled: boolean): this {
        this.config.group = enabled;
        return this;
    }

    /**
     * Suppress warnings for this patch.
     */
    noWarnings(): this {
        this.config.noWarn = true;
        return this;
    }

    /**
     * Set a timeout for the patch execution.
     */
    timeout(ms: number): this {
        this.config.timeout = ms;
        return this;
    }

    /**
     * Set when the patch should run.
     */
    runAt(when: "document-start" | "document-end" | "document-ready"): this {
        this.config.runAt = when;
        return this;
    }

    /**
     * Build the code patch configuration.
     */
    build(): IPluginCodePatch {
        try {
            if (!this.config.code) {
                throw new Error("Code is required");
            }
            if (!this.config.selector) {
                throw new Error("Target selector is required");
            }

            const patch: IPluginCodePatch = {
                find: this.config.code || "",
                replacement: {
                    match: /.*/,
                    replace: () => this.config.code || ""
                },
                predicate: this.config.predicate,
                all: this.config.all,
                group: this.config.group as boolean | undefined,
                noWarn: this.config.noWarn,
                timeout: this.config.timeout,
            };

            return patch;
        } catch (error) {
            logger.error("Failed to build code patch:", error);
            throw error;
        }
    }

}

/**
 * Enhanced plugin patch builder with modern fluent API.
 */
export class PluginPatchBuilder {
    private readonly patches: PluginPatch[] = [];

    /**
     * Add a UI patch to the builder.
     */
    ui(builder: UIPatchBuilder): this {
        try {
            const patch = builder.build();
            this.patches.push(patch);
        } catch (error) {
            logger.error("Failed to add UI patch:", error);
        }
        return this;
    }

    /**
     * Add a code patch to the builder.
     */
    code(builder: CodePatchBuilder): this {
        try {
            const patch = builder.build();
            this.patches.push(patch);
        } catch (error) {
            logger.error("Failed to add code patch:", error);
        }
        return this;
    }

    /**
     * Add a raw patch directly.
     */
    raw(patch: PluginPatch): this {
        this.patches.push(patch);
        return this;
    }

    /**
     * Build all patches into an array.
     */
    build(): PluginPatch[] {
        try {
            if (this.patches.length === 0) {
                throw new Error("No patches to build");
            }
            return [...this.patches];
        } catch (error) {
            logger.error("Failed to build patches:", error);
            throw error;
        }
    }

    /**
     * Clear all patches from the builder.
     */
    clear(): this {
        this.patches.length = 0;
        return this;
    }

    /**
     * Get the number of patches in the builder.
     */
    size(): number {
        return this.patches.length;
    }
}

/**
 * Factory functions for quick patch creation.
 */
export const Patches = {
    /**
     * Create a UI patch with a React component.
     */
    ui: (component: React.ComponentType<InjectedComponentProps>) => UIPatchBuilder.withComponent(component),

    /**
     * Create a code patch with JavaScript code.
     */
    code: (code: string) => CodePatchBuilder.withCode(code),

    /**
     * Create a plugin patch builder.
     */
    builder: () => new PluginPatchBuilder(),

    /**
     * Create a simple UI patch (legacy compatibility).
     */
    simple: (patch: SimpleUIPatch): IPluginUIPatch => ({
        component: patch.component,
        target: patch.target,
        predicate: patch.predicate,
    }),
} as const;

/**
 * Utility functions for patch validation and debugging.
 */
export const PatchUtils = {
    /**
     * Validate a patch configuration.
     */
    validate: (patch: PluginPatch): PatchBuilderResult<void> => {
        try {
            if (!patch) {
                return { success: false, error: new Error("Patch is required") };
            }

            if ("component" in patch) {
                // UI patch validation
                if (!patch.component) {
                    return { success: false, error: new Error("UI patch must have a component") };
                }
                if (!patch.target) {
                    return { success: false, error: new Error("UI patch must have a target") };
                }
            } else {
                // Code patch validation
                const codePatch = patch as IPluginCodePatch;
                if (!codePatch.find) {
                    return { success: false, error: new Error("Code patch must have find pattern") };
                }
            }

            return { success: true, data: undefined };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    },

    /**
     * Get a human-readable description of a patch.
     */
    describe: (patch: PluginPatch): string => {
        if ("component" in patch) {
            const component = patch as IPluginUIPatch;
            const componentName = (component.component as React.ComponentType)?.displayName ||
                (component.component as React.ComponentType)?.name ||
                "Unknown Component";
            const targetDesc = typeof component.target === "string"
                ? component.target
                : "custom selector";
            return `UI Patch: ${componentName} -> ${targetDesc}`;
        } else {
            const codePatch = patch as IPluginCodePatch;
            const code = typeof codePatch.find === "string" ? codePatch.find : "dynamic code";
            return `Code Patch: "${code.substring(0, 50)}${code.length > 50 ? "..." : ""}"`;
        }
    },

    /**
     * Test if a patch can be applied to the current DOM.
     */
    canApply: (patch: PluginPatch): boolean => {
        try {
            if ("component" in patch) {
                const uiPatch = patch as IPluginUIPatch;
                const result = selectOne(uiPatch.target);
                return result.success && result.data !== null;
            } else {
                // For code patches, assume they're always applicable for now
                return true;
            }
        } catch {
            return false;
        }
    },
} as const;

/**
 * Main patch factory object for creating UI and code patches.
 */
export const Patch = Patches;
