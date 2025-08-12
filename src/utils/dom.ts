/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * A union of DOM node roots that support query selection.
 */
export type NodeRoot = ParentNode | Document | DocumentFragment | Element | null;

/**
 * A structured selector configuration used by DOM helpers to find elements robustly.
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
};

/**
 * Safe wrapper around querySelector with explicit typing and sensible defaults.
 */
export function querySelector<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): T | null {
    const r = (root ?? document) as ParentNode;
    return (r.querySelector(selector) as T | null) ?? null;
}

/**
 * Safe wrapper around querySelectorAll with explicit typing.
 */
export function querySelectorAll<T extends Element = HTMLElement>(
    selector: string,
    root?: NodeRoot
): T[] {
    const r = (root ?? document) as ParentNode;
    return Array.from(r.querySelectorAll(selector)) as T[];
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
 * Finds all elements matching the given finder configuration.
 */
export function findElementsByConfig(cfg: ElementFinderConfig): HTMLElement[] {
    const root = (cfg.root ?? document) as ParentNode;
    const candidates = querySelectorAll<HTMLElement>(cfg.selector, root);
    return candidates.filter(el => matchElementByConfig(el, cfg));
}

/**
 * Finds the first element matching the finder configuration.
 */
export function findElement(cfg: ElementFinderConfig): HTMLElement | null {
    const all = findElementsByConfig(cfg);
    return all.length ? all[0]! : null;
}

/**
 * Waits for an element matching the configuration to appear under the configured root.
 */
export async function waitForElementByConfig(
    cfg: ElementFinderConfig & { timeoutMs?: number; }
): Promise<HTMLElement> {
    const { timeoutMs = 10_000 } = cfg;

    const immediate = findElement(cfg);
    if (immediate) {
        return immediate;
    }

    let observer: MutationObserver | null = null;
    return new Promise<HTMLElement>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            observer?.disconnect();
            reject(new Error(`Timeout waiting for selector: ${cfg.selector}`));
        }, timeoutMs);

        observer = new MutationObserver(() => {
            const found = findElement(cfg);
            if (found) {
                clearTimeout(timer);
                observer?.disconnect();
                resolve(found);
            }
        });

        const rootNode = (cfg.root ?? document) as Node;
        observer.observe(rootNode, { childList: true, subtree: true, attributes: true, characterData: false });
    });
}

/**
 * A flexible selector accepting either a CSS selector string or an ElementFinderConfig.
 */
export type AnySelector = string | ElementFinderConfig;

/**
 * Finds all elements for the given selector under an optional root.
 */
export function selectAll<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): T[] {
    if (typeof sel === "string") {
        return querySelectorAll<T>(sel, root);
    }
    return findElementsByConfig({ ...(sel as ElementFinderConfig), root: (sel as ElementFinderConfig).root ?? root }) as unknown as T[];
}

/**
 * Finds the first element for the given selector under an optional root.
 */
export function selectOne<T extends HTMLElement = HTMLElement>(sel: AnySelector, root?: NodeRoot): T | null {
    if (typeof sel === "string") {
        return querySelector<T>(sel, root);
    }
    return findElement({ ...(sel as ElementFinderConfig), root: (sel as ElementFinderConfig).root ?? root }) as unknown as T | null;
}

/**
 * Waits for the first element matching the selector under an optional root.
 */
export async function waitFor<T extends HTMLElement = HTMLElement>(sel: AnySelector, opts?: { timeoutMs?: number; root?: NodeRoot; }): Promise<T> {
    if (typeof sel === "string") {
        const cfg: ElementFinderConfig = { selector: sel, root: opts?.root };
        return waitForElementByConfig(cfg) as Promise<T>;
    }
    const cfg = { ...sel, root: sel.root ?? opts?.root } as ElementFinderConfig & { timeoutMs?: number; };
    return waitForElementByConfig(cfg) as Promise<T>;
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
        return waitForElementByConfig(cfg) as Promise<T>;
    }
}

/**
 * Preferred modern names for selection helpers (aliases for existing functions)
 */
export const selectFirst = selectOne;
export const selectMany = selectAll;
export const waitForFirst = waitFor;

export type ElementHideConfig = {
    selector: string;
    description?: string;
    condition?: (el: HTMLElement) => boolean;
};

export function createDomElementHider(
    root: Node,
    configs: ElementHideConfig[],
    options?: { debounce?: number; useRequestAnimationFrame?: boolean; }
) {
    const { debounce = 100, useRequestAnimationFrame = false } = options ?? {};
    let rafId: number | null = null;
    let debounceId: number | null = null;

    const hide = () => {
        for (const cfg of configs) {
            const nodes = querySelectorAll<HTMLElement>(cfg.selector, root as ParentNode);
            for (const el of nodes) {
                if (cfg.condition && !cfg.condition(el)) {
                    continue;
                }
                el.style.setProperty("display", "none", "important");
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

    const observer = new MutationObserver(scheduleHide);

    return {
        hideImmediately: hide,
        startObserving: () => {
            observer.observe(root, { childList: true, subtree: true, attributes: true });
            scheduleHide();
        },
        stopObserving: () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            if (debounceId !== null) {
                clearTimeout(debounceId);
            }
            observer.disconnect();
        },
    };
}

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
        const nodes = querySelectorAll<T>(selector, root);
        for (const el of nodes) {
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
