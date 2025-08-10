/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ElementFinderConfig = {
    selector: string;
    root?: ParentNode | Document | DocumentFragment | Element | null;
    filter?: (el: HTMLElement) => boolean;
    classContains?: string[];
    svgPartialD?: string;
};

export function querySelector<T extends Element = HTMLElement>(
    selector: string,
    root?: ParentNode | Document | DocumentFragment | Element | null
): T | null {
    const r = (root ?? document) as ParentNode;
    return (r.querySelector(selector) as T | null) ?? null;
}

export function querySelectorAll<T extends Element = HTMLElement>(
    selector: string,
    root?: ParentNode | Document | DocumentFragment | Element | null
): T[] {
    const r = (root ?? document) as ParentNode;
    return Array.from(r.querySelectorAll(selector)) as T[];
}

export function elementMatchesAllClasses(el: Element, classes: string[] | undefined): boolean {
    if (!classes || classes.length === 0) {
        return true;
    }
    const cl = el.classList;
    return classes.every(c => cl.contains(c));
}

export function elementHasSvgPathWithD(el: Element, includesD?: string): boolean {
    if (!includesD) {
        return true;
    }
    const path = el.querySelector("svg path[d]") as SVGPathElement | null;
    return !!(path && path.getAttribute("d")?.includes(includesD));
}

export function findElement(cfg: ElementFinderConfig): HTMLElement | null {
    const root = (cfg.root ?? document) as ParentNode;
    const candidates = querySelectorAll<HTMLElement>(cfg.selector, root);
    for (const el of candidates) {
        if (!elementMatchesAllClasses(el, cfg.classContains)) {
            continue;
        }
        if (!elementHasSvgPathWithD(el, cfg.svgPartialD)) {
            continue;
        }
        if (cfg.filter && !cfg.filter(el)) {
            continue;
        }
        return el;
    }
    return null;
}

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

    // Initial pass
    rescan();
    observe();

    return { disconnect, rescan };
}
