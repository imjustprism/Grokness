/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const logger = new Logger("DOM", "#3b82f6");

/**
 * A union of DOM node roots that support query selection.
 */
export type NodeRoot = ParentNode | Document | DocumentFragment | Element | null;

/**
 * Enhanced selector configuration with better type safety and validation.
 */
export type ElementFinderConfig = {
    readonly selector: string;
    readonly root?: NodeRoot;
    readonly filter?: (el: HTMLElement) => boolean;
    readonly classContains?: readonly string[];
    readonly svgPartialD?: string;
    readonly ariaLabel?: string | RegExp;
    readonly role?: string;
    readonly textIncludes?: string;
    readonly textMatches?: RegExp;
    readonly timeout?: number;
    readonly waitFor?: boolean;
};

/**
 * Result type for operations that can succeed or fail.
 */
export type Result<T, E = Error> =
    | { readonly success: true; readonly data: T; }
    | { readonly success: false; readonly error: E; };

/**
 * Type guard to check if an element is an HTMLElement.
 */
export function isHTMLElement(element: Element | EventTarget | null | undefined): element is HTMLElement {
    return element instanceof HTMLElement;
}

/**
 * Type guard to check if a node is a valid parent node for queries.
 */
export function isNodeRoot(node: unknown): node is NodeRoot {
    return node instanceof Document ||
        node instanceof DocumentFragment ||
        node instanceof Element ||
        node === null;
}

/**
 * Enhanced querySelector with better error handling and validation.
 */
export function querySelector<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): Result<T | null> {
    try {
        if (!selector?.trim()) {
            return { success: false, error: new Error("Selector cannot be empty") };
        }

        const r = (root ?? document) as ParentNode;
        const element = r.querySelector(selector);

        if (!element) {
            return { success: true, data: null };
        }

        return { success: true, data: element as T };
    } catch (error) {
        logger.error(`querySelector failed for "${selector}":`, error);
        return { success: false, error: error as Error };
    }
}

/**
 * Enhanced querySelectorAll with better error handling and validation.
 */
export function querySelectorAll<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): Result<T[]> {
    try {
        if (!selector?.trim()) {
            return { success: false, error: new Error("Selector cannot be empty") };
        }

        const r = (root ?? document) as ParentNode;
        const elements = Array.from(r.querySelectorAll(selector));

        return { success: true, data: elements as T[] };
    } catch (error) {
        logger.error(`querySelectorAll failed for "${selector}":`, error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrappers for backward compatibility (deprecated - use Result versions).
 * @deprecated Use querySelector/querySelectorAll that return Result<T> instead
 */
export function querySelectorUnsafe<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): T | null {
    const result = querySelector<T>(selector, root);
    return result.success ? result.data : null;
}

/**
 * Legacy wrapper for backward compatibility.
 * @deprecated Use querySelectorAll that returns Result<T> instead
 */
export function querySelectorAllUnsafe<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): T[] {
    const result = querySelectorAll<T>(selector, root);
    return result.success ? result.data : [];
}

/**
 * Returns true if the element contains all of the given class names.
 */
export function elementMatchesAllClasses(el: Element, classes: readonly string[] | undefined): boolean {
    if (!classes || classes.length === 0) {
        return true;
    }
    const cl = el.classList;
    return classes.every(c => cl.contains(c));
}

/**
 * Returns true if the element contains an <svg><path d=.../> whose d attribute includes the given string.
 */
export function elementHasSvgPathWithD(el: Element, includesD?: string): boolean {
    if (!includesD) {
        return true;
    }
    const path = el.querySelector("svg path[d]") as SVGPathElement | null;
    return !!(path && path.getAttribute("d")?.includes(includesD));
}

function elementAriaMatches(el: Element, aria?: string | RegExp): boolean {
    if (aria == null) {
        return true;
    }
    const label = el.getAttribute("aria-label") ?? "";
    return typeof aria === "string" ? label === aria : aria.test(label);
}

function elementRoleMatches(el: Element, role?: string): boolean {
    if (!role) {
        return true;
    }
    const r = el.getAttribute("role");
    return r === role;
}

function elementTextMatches(el: Element, textIncludes?: string, textMatches?: RegExp): boolean {
    if (!textIncludes && !textMatches) {
        return true;
    }
    const text = (el.textContent ?? "").trim();
    if (textIncludes && !text.includes(textIncludes)) {
        return false;
    }
    if (textMatches && !textMatches.test(text)) {
        return false;
    }
    return true;
}

/**
 * Returns true if the given element satisfies all conditions in the finder configuration.
 */
export function matchElementByConfig(el: HTMLElement, cfg: ElementFinderConfig): boolean {
    if (!elementMatchesAllClasses(el, cfg.classContains)) {
        return false;
    }
    if (!elementHasSvgPathWithD(el, cfg.svgPartialD)) {
        return false;
    }
    if (!elementAriaMatches(el, cfg.ariaLabel)) {
        return false;
    }
    if (!elementRoleMatches(el, cfg.role)) {
        return false;
    }
    if (!elementTextMatches(el, cfg.textIncludes, cfg.textMatches)) {
        return false;
    }
    if (cfg.filter && !cfg.filter(el)) {
        return false;
    }
    return true;
}

/**
 * Enhanced version that returns Result type for better error handling.
 */
export function findElementsByConfig(cfg: ElementFinderConfig): Result<HTMLElement[]> {
    try {
        if (!cfg?.selector?.trim()) {
            return { success: false, error: new Error("Selector cannot be empty") };
        }

        const root = (cfg.root ?? document) as ParentNode;
        const candidatesResult = querySelectorAll<HTMLElement>(cfg.selector, root);

        if (!candidatesResult.success) {
            return candidatesResult;
        }

        const matching = candidatesResult.data.filter(el => matchElementByConfig(el, cfg));
        return { success: true, data: matching };
    } catch (error) {
        logger.error("findElementsByConfig failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Enhanced version that returns Result type for better error handling.
 */
export function findElement(cfg: ElementFinderConfig): Result<HTMLElement | null> {
    try {
        const allResult = findElementsByConfig(cfg);
        if (!allResult.success) {
            return allResult;
        }
        return { success: true, data: allResult.data.length ? allResult.data[0]! : null };
    } catch (error) {
        logger.error("findElement failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrappers for backward compatibility.
 * @deprecated Use findElementsByConfig/findElement that return Result<T> instead
 */
export function findElementsByConfigUnsafe(cfg: ElementFinderConfig): HTMLElement[] {
    const result = findElementsByConfig(cfg);
    return result.success ? result.data : [];
}

export function findElementUnsafe(cfg: ElementFinderConfig): HTMLElement | null {
    const result = findElement(cfg);
    return result.success ? result.data : null;
}

/**
 * Enhanced wait function with better error handling and timeout management.
 */
export async function waitForElementByConfig(
    cfg: ElementFinderConfig & { timeoutMs?: number; }
): Promise<Result<HTMLElement>> {
    try {
        const { timeoutMs = 10_000 } = cfg;

        const immediate = findElement(cfg);
        if (immediate.success && immediate.data) {
            return { success: true, data: immediate.data };
        }

        let observer: MutationObserver | null = null;
        return new Promise<Result<HTMLElement>>(resolve => {
            const timer = window.setTimeout(() => {
                observer?.disconnect();
                resolve({
                    success: false,
                    error: new Error(`Timeout waiting for selector: ${cfg.selector} (waited ${timeoutMs}ms)`)
                });
            }, timeoutMs);

            observer = new MutationObserver(() => {
                const found = findElement(cfg);
                if (found.success && found.data) {
                    clearTimeout(timer);
                    observer?.disconnect();
                    resolve({ success: true, data: found.data });
                } else if (!found.success) {
                    clearTimeout(timer);
                    observer?.disconnect();
                    resolve(found);
                }
            });

            const rootNode = (cfg.root ?? document) as Node;
            observer.observe(rootNode, { childList: true, subtree: true, attributes: true, characterData: false });
        });
    } catch (error) {
        logger.error("waitForElementByConfig failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrapper for backward compatibility.
 * @deprecated Use waitForElementByConfig that returns Result<T> instead
 */
export async function waitForElementByConfigUnsafe(
    cfg: ElementFinderConfig & { timeoutMs?: number; }
): Promise<HTMLElement> {
    const result = await waitForElementByConfig(cfg);
    if (!result.success) {
        throw result.error;
    }
    return result.data;
}

/**
 * A flexible selector accepting either a CSS selector string or an ElementFinderConfig.
 */
export type AnySelector = string | ElementFinderConfig;

/**
 * Enhanced selectAll with Result-based error handling.
 */
export function selectAll<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): Result<T[]> {
    try {
        if (typeof sel === "string") {
            return querySelectorAll<T>(sel, root);
        }

        const cfg = { ...(sel as ElementFinderConfig), root: (sel as ElementFinderConfig).root ?? root };
        const result = findElementsByConfig(cfg);
        return result.success ? { success: true, data: result.data as T[] } : result;
    } catch (error) {
        logger.error("selectAll failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Enhanced selectOne with Result-based error handling.
 */
export function selectOne<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): Result<T | null> {
    try {
        if (typeof sel === "string") {
            return querySelector<T>(sel, root);
        }

        const cfg = { ...(sel as ElementFinderConfig), root: (sel as ElementFinderConfig).root ?? root };
        const result = findElement(cfg);
        return result.success ? { success: true, data: result.data as T | null } : result;
    } catch (error) {
        logger.error("selectOne failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Enhanced waitFor with Result-based error handling.
 */
export async function waitFor<T extends HTMLElement = HTMLElement>(
    sel: AnySelector,
    opts?: { timeoutMs?: number; root?: NodeRoot; }
): Promise<Result<T>> {
    try {
        if (typeof sel === "string") {
            const cfg: ElementFinderConfig & { timeoutMs?: number; } = {
                selector: sel,
                root: opts?.root,
                timeoutMs: opts?.timeoutMs
            };
            const result = await waitForElementByConfig(cfg);
            return result.success ? { success: true, data: result.data as T } : result;
        }

        const cfg: ElementFinderConfig & { timeoutMs?: number; } = {
            ...sel,
            root: sel.root ?? opts?.root,
            timeoutMs: opts?.timeoutMs
        };
        const result = await waitForElementByConfig(cfg);
        return result.success ? { success: true, data: result.data as T } : result;
    } catch (error) {
        logger.error("waitFor failed:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Legacy wrappers for backward compatibility.
 * @deprecated Use selectAll/selectOne/waitFor that return Result<T> instead
 */
export function selectAllUnsafe<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): T[] {
    const result = selectAll<T>(sel, root);
    return result.success ? result.data : [];
}

export function selectOneUnsafe<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): T | null {
    const result = selectOne<T>(sel, root);
    return result.success ? result.data : null;
}

export async function waitForUnsafe<T extends HTMLElement = HTMLElement>(
    sel: AnySelector,
    opts?: { timeoutMs?: number; root?: NodeRoot; }
): Promise<T> {
    const result = await waitFor<T>(sel, opts);
    if (!result.success) {
        throw result.error;
    }
    return result.data;
}

/**
 * Utility to create debounced mutation observers with a simple API.
 */
export class MutationObserverManager {
    createDebouncedObserver(args: {
        target: Node;
        options: MutationObserverInit;
        callback: () => void;
        debounceDelay?: number;
    }) {
        const { target, options, callback, debounceDelay = 100 } = args;
        let timeout: number | null = null;
        const observer = new MutationObserver(() => {
            if (timeout !== null) {
                clearTimeout(timeout);
            }
            timeout = window.setTimeout(() => {
                timeout = null;
                callback();
            }, debounceDelay);
        });
        return {
            observe: () => observer.observe(target, options),
            disconnect: () => {
                if (timeout !== null) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                observer.disconnect();
            },
        };
    }
}

/**
 * A fluent builder for constructing complex selector configurations in a type-safe manner.
 * This is additive to the existing helpers and does not replace them.
 */
export class DomSelectorBuilder {
    private readonly config: ElementFinderConfig;

    private constructor(config: ElementFinderConfig) {
        this.config = config;
    }

    static css(selector: string): DomSelectorBuilder {
        return new DomSelectorBuilder({ selector });
    }

    within(root: NodeRoot): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, root });
    }

    withClasses(classes: readonly string[]): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, classContains: classes });
    }

    withAriaLabel(label: string | RegExp): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, ariaLabel: label });
    }

    withRole(role: string): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, role });
    }

    withTextIncludes(text: string): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, textIncludes: text });
    }

    withTextMatches(regex: RegExp): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, textMatches: regex });
    }

    withSvgPathDIncludes(partial: string): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, svgPartialD: partial });
    }

    filteredBy(predicate: (el: HTMLElement) => boolean): DomSelectorBuilder {
        return new DomSelectorBuilder({ ...this.config, filter: predicate });
    }

    build(): ElementFinderConfig {
        return { ...this.config };
    }

    findAll<T extends HTMLElement = HTMLElement>(): T[] {
        return findElementsByConfig(this.config) as unknown as T[];
    }

    findOne<T extends HTMLElement = HTMLElement>(): T | null {
        return findElement(this.config) as unknown as T | null;
    }

    async waitForOne<T extends HTMLElement = HTMLElement>(timeoutMs?: number): Promise<T> {
        const cfg = { ...this.config, timeoutMs } as ElementFinderConfig & { timeoutMs?: number; };
        const result = await waitForElementByConfig(cfg);
        if (result.success) {
            return result.data as T;
        }
        throw result.error;
    }
}

/**
 * Enhanced utility functions with modern error handling.
 */

/**
 * Enhanced DOM element hider with better error handling.
 */
export function createDomElementHider(
    root: Node,
    configs: ElementHideConfig[],
    options?: { debounce?: number; useRequestAnimationFrame?: boolean; }
): {
    hideImmediately: () => void;
    startObserving: () => void;
    stopObserving: () => void;
    isObserving: () => boolean;
} {
    const { debounce = 100, useRequestAnimationFrame = false } = options ?? {};
    let rafId: number | null = null;
    let debounceId: number | null = null;
    let isObserving = false;

    const hide = () => {
        for (const cfg of configs) {
            try {
                const elementsResult = querySelectorAll<HTMLElement>(cfg.selector, root as ParentNode);
                if (!elementsResult.success) {
                    logger.warn(`Failed to query elements for selector "${cfg.selector}":`, elementsResult.error);
                    continue;
                }

                for (const el of elementsResult.data) {
                    if (cfg.condition && !cfg.condition(el)) {
                        continue;
                    }
                    el.style.setProperty("display", "none", "important");
                }
            } catch (error) {
                logger.error(`Error hiding elements for selector "${cfg.selector}":`, error);
            }
        }
    };

    const scheduleHide = () => {
        if (useRequestAnimationFrame) {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
                rafId = null;
                hide();
            });
        } else {
            if (debounceId !== null) {
                clearTimeout(debounceId);
            }
            debounceId = window.setTimeout(() => {
                debounceId = null;
                hide();
            }, debounce);
        }
    };

    const mutationObserver = new MutationObserver(scheduleHide);

    return {
        hideImmediately: hide,
        startObserving: () => {
            if (isObserving) {
                return;
            }
            isObserving = true;
            try {
                mutationObserver.observe(root, { childList: true, subtree: true, attributes: true });
                scheduleHide();
            } catch (error) {
                logger.error("Failed to start observing:", error);
                isObserving = false;
            }
        },
        stopObserving: () => {
            if (!isObserving) {
                return;
            }
            isObserving = false;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            if (debounceId !== null) {
                clearTimeout(debounceId);
            }
            mutationObserver.disconnect();
        },
        isObserving: () => isObserving,
    };
}

/**
 * Modern, fluent API for DOM manipulation.
 */
export class DomHelper {
    private readonly logger = logger;

    /**
     * Safely query elements with Result-based error handling.
     */
    query<T extends Element = HTMLElement>(selector: string, root?: NodeRoot): Result<T | null> {
        return querySelector<T>(selector, root);
    }

    /**
     * Safely query all elements with Result-based error handling.
     */
    queryAll<T extends Element = HTMLElement>(selector: string, root?: NodeRoot): Result<T[]> {
        return querySelectorAll<T>(selector, root);
    }

    /**
     * Wait for an element to appear with timeout.
     */
    async waitFor<T extends HTMLElement = HTMLElement>(
        selector: string,
        options?: { timeoutMs?: number; root?: NodeRoot; }
    ): Promise<Result<T>> {
        return waitFor<T>(selector, options);
    }

    /**
     * Check if an element exists.
     */
    exists(selector: string, root?: NodeRoot): boolean {
        const result = querySelector(selector, root);
        return result.success && result.data !== null;
    }

    /**
     * Get element text content safely.
     */
    getText(element: Element): string {
        return element.textContent?.trim() ?? "";
    }

    /**
     * Set element text content safely.
     */
    setText(element: Element, text: string): Result<void> {
        try {
            element.textContent = text;
            return { success: true, data: undefined };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }
}

// Create a singleton instance for convenience
export const dom = new DomHelper();

/**
 * Preferred modern names for selection helpers with Result-based error handling.
 */
export const selectFirst = selectOne;
export const selectMany = selectAll;
export const waitForFirst = waitFor;

/**
 * Legacy aliases for backward compatibility (deprecated).
 * @deprecated Use the new Result-based functions instead
 */
export const $ = querySelectorUnsafe;
export const $$ = querySelectorAllUnsafe;
export const wait = waitForUnsafe;

export type ElementHideConfig = {
    selector: string;
    description?: string;
    condition?: (el: HTMLElement) => boolean;
};

export function insertAfter(newNode: Node, referenceNode: Node) {
    const parent = referenceNode.parentNode;
    if (!parent) {
        return;
    }
    if (referenceNode.nextSibling) {
        parent.insertBefore(newNode, referenceNode.nextSibling);
    } else {
        parent.appendChild(newNode);
    }
}

export function wrapElement(target: HTMLElement, wrapperTag = "div"): HTMLElement {
    const wrapper = document.createElement(wrapperTag);
    const parent = target.parentElement;
    if (!parent) {
        return wrapper;
    }
    parent.insertBefore(wrapper, target);
    wrapper.appendChild(target);
    return wrapper;
}

export function insertRangeBefore(parent: Node, nodes: Node[], before?: Node | null) {
    if (nodes.length === 0 || !parent) {
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const n of nodes) {
        fragment.appendChild(n);
    }
    if (before && before.parentNode === parent) {
        parent.insertBefore(fragment, before);
    } else {
        parent.appendChild(fragment);
    }
}

export function liveElements<T extends HTMLElement = HTMLElement>(
    selector: string,
    root: ParentNode | Document = document,
    onEnter: (el: T) => void,
    onExit?: (el: T) => void,
    options?: { debounce?: number; }
) {
    const tracked = new Set<T>();
    const debounceDelay = options?.debounce ?? 50;
    let timeout: number | null = null;

    const scanAdded = () => {
        const nodesResult = querySelectorAll<T>(selector, root);
        if (!nodesResult.success) {
            return;
        }
        for (const el of nodesResult.data) {
            if (!tracked.has(el)) {
                tracked.add(el);
                onEnter(el);
            }
        }
    };

    const removeMissing = () => {
        for (const el of Array.from(tracked)) {
            if (!document.contains(el)) {
                tracked.delete(el);
                onExit?.(el);
            }
        }
    };

    const rescan = () => {
        removeMissing();
        scanAdded();
    };

    const observer = new MutationObserver(() => {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = window.setTimeout(() => {
            timeout = null;
            rescan();
        }, debounceDelay);
    });

    const observe = () => observer.observe(root as Node, { childList: true, subtree: true, attributes: false });
    const disconnect = () => {
        if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
        }
        observer.disconnect();
        tracked.clear();
    };

    rescan();
    observe();

    return { disconnect, rescan };
}
