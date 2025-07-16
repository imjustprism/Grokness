/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const domLogger = new Logger("DOM", "#ef4444");

export interface ElementFinderConfig {
    selector: string;
    root?: Document | Element;
    filter?: (el: HTMLElement) => boolean;
    textRegex?: RegExp;
    attrRegex?: { attr: string; regex: RegExp; };
    svgPartialD?: string;
    ariaLabel?: string;
    ariaLabelRegex?: RegExp;
    classContains?: string[];
    idContains?: string;
    matchDescendants?: boolean;
    xpath?: string;
}

export interface MutationObserverConfig {
    target: Element;
    options: MutationObserverInit;
    callback: (mutations: MutationRecord[], observer: MutationObserver) => void;
    debounceDelay?: number;
    useRaf?: boolean;
}

export interface ElementHideConfig {
    selector: string;
    description: string;
    condition?: (element: HTMLElement) => boolean;
    removeFromDom?: boolean;
    markerAttribute?: string;
    regexPattern?: RegExp;
    regexTarget?: "textContent" | "class" | "id" | string;
}

export interface ElementHiderOptions {
    debounce?: number;
    useRequestAnimationFrame?: boolean;
    injectCss?: boolean;
}

/**
 * Selects the first element matching the selector.
 * @param selector CSS selector string.
 * @param root Optional root element (defaults to document).
 * @returns Matching HTMLElement or null.
 */
export function querySelector(
    selector: string,
    root: Document | Element = document
): HTMLElement | null {
    if (!root) {
        domLogger.error("Root element is null or undefined");
        return null;
    }
    if (!selector.trim()) {
        domLogger.warn("Invalid or empty selector provided");
        return null;
    }
    try {
        const element = root.querySelector(selector) as HTMLElement | null;
        if (!element) {
        }
        return element;
    } catch (error) {
        domLogger.warn(`Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Selects all elements matching the selector.
 * @param selector CSS selector string.
 * @param root Optional root element (defaults to document).
 * @returns Array of matching HTMLElements.
 */
export function querySelectorAll(
    selector: string,
    root: Document | Element = document
): HTMLElement[] {
    if (!root) {
        domLogger.error("Root element is null or undefined");
        return [];
    }
    if (!selector.trim()) {
        domLogger.warn("Invalid or empty selector provided");
        return [];
    }
    try {
        const elements = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
        if (elements.length === 0) {
        }
        return elements;
    } catch (error) {
        domLogger.warn(`Invalid selector: ${selector}`, error);
        return [];
    }
}

/**
 * Finds an element using advanced multi-criteria configuration.
 * @param config Finder configuration.
 * @returns First matching HTMLElement or null.
 */
export function findElement(config: ElementFinderConfig): HTMLElement | null {
    const root = config.root ?? document;
    let candidates: HTMLElement[] = [];
    if (config.xpath) {
        try {
            const result = document.evaluate(config.xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < result.snapshotLength; i++) {
                const node = result.snapshotItem(i);
                if (node instanceof HTMLElement) {
                    candidates.push(node);
                }
            }
        } catch (error) {
            domLogger.warn(`Invalid XPath in config: ${config.xpath}`, error);
            return null;
        }
    } else {
        candidates = querySelectorAll(config.selector, root);
    }

    for (const el of candidates) {
        let match = true;

        if (config.filter && !config.filter(el)) {
            match = false;
        }

        if (match && config.textRegex) {
            const text = (config.matchDescendants ? el.innerText : el.textContent)?.trim() ?? "";
            if (!config.textRegex.test(text)) {
                match = false;
            }
        }

        if (match && config.attrRegex) {
            const attrValue = el.getAttribute(config.attrRegex.attr) ?? "";
            if (!config.attrRegex.regex.test(attrValue)) {
                match = false;
            }
        }

        if (match && config.svgPartialD) {
            const paths = (config.matchDescendants ? el : el).querySelectorAll("svg path");
            let hasMatch = false;
            for (const path of paths) {
                const d = path.getAttribute("d") ?? "";
                if (d.includes(config.svgPartialD)) {
                    hasMatch = true;
                    break;
                }
            }
            if (!hasMatch) {
                match = false;
            }
        }

        if (match && config.ariaLabel) {
            const aria = el.getAttribute("aria-label") ?? "";
            if (aria !== config.ariaLabel) {
                match = false;
            }
        }

        if (match && config.ariaLabelRegex) {
            const aria = el.getAttribute("aria-label") ?? "";
            if (!config.ariaLabelRegex.test(aria)) {
                match = false;
            }
        }

        if (match && config.classContains) {
            const classes = el.classList;
            if (!config.classContains.every(cls => classes.contains(cls))) {
                match = false;
            }
        }

        if (match && config.idContains) {
            const id = el.id ?? "";
            if (!id.includes(config.idContains)) {
                match = false;
            }
        }

        if (match) {
            return el;
        }
    }

    return null;
}

/**
 * Waits for an element matching the advanced config to appear in the DOM.
 * @param config Finder configuration.
 * @param timeoutMs Timeout in milliseconds (default: 10000).
 * @returns Promise resolving to the element or rejecting on timeout.
 */
export async function waitForElementByConfig(
    config: ElementFinderConfig,
    timeoutMs = 10000
): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        let element = findElement(config);
        if (element) {
            return resolve(element);
        }

        const root = config.root ?? document;
        const observer = new MutationObserver(() => {
            element = findElement(config);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(root, { childList: true, subtree: true, attributes: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found within ${timeoutMs}ms using config: ${JSON.stringify(config)}`));
        }, timeoutMs);
    });
}

/**
 * Injects CSS styles into the document head.
 * @param cssContent Raw CSS string to inject.
 * @param styleId Optional ID for the style element.
 * @returns Object with style element and cleanup function.
 */
export function injectStyles(
    cssContent: string,
    styleId?: string
): { styleElement: HTMLStyleElement; cleanup: () => void; } {
    let styleElement = styleId ? document.getElementById(styleId) as HTMLStyleElement | null : null;

    if (styleElement) {
        styleElement.textContent = cssContent;
    } else {
        styleElement = document.createElement("style");
        if (styleId) {
            styleElement.id = styleId;
        }
        styleElement.textContent = cssContent;
        document.head.appendChild(styleElement);
    }

    const cleanup = () => {
        styleElement?.remove();
    };

    return { styleElement, cleanup };
}

export class MutationObserverManager {
    private observersMap: Map<MutationObserver, string> = new Map();
    private nextObserverId = 0;

    public createObserver(config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } {
        if (!config.target) {
            domLogger.error("Target element is null or undefined");
            throw new Error("Target element is null or undefined");
        }

        const observerId = `observer-${this.nextObserverId++}`;
        const observer = new MutationObserver(config.callback);
        this.observersMap.set(observer, observerId);

        const observe = () => observer.observe(config.target, config.options);
        const disconnect = () => {
            observer.disconnect();
            this.observersMap.delete(observer);
        };

        return { observe, disconnect };
    }

    public createDebouncedObserver(config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } {
        let debounceTimer: ReturnType<typeof setTimeout> | number | null = null;

        const debouncedCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
            const delay = config.debounceDelay ?? 100;
            if (debounceTimer !== null) {
                if (config.useRaf) {
                    cancelAnimationFrame(debounceTimer);
                } else {
                    clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
                }
            }
            const schedule = config.useRaf ? requestAnimationFrame : (cb: TimerHandler) => setTimeout(cb, delay);
            debounceTimer = schedule(() => config.callback(mutations, observer));
        };

        return this.createObserver({ ...config, callback: debouncedCallback });
    }

    public disconnectAll(): void {
        for (const observer of this.observersMap.keys()) {
            observer.disconnect();
        }
        this.observersMap.clear();
    }

    public getActiveCount(): number {
        return this.observersMap.size;
    }
}

export function hideDomElements(config: ElementHideConfig): number {
    let countHidden = 0;
    const markerAttr = config.markerAttribute || "data-hidden";

    try {
        const matchedElements = querySelectorAll(config.selector);

        for (const element of matchedElements) {
            let matchesCondition = true;
            if (config.condition) {
                matchesCondition = config.condition(element);
            } else if (config.regexPattern && config.regexTarget) {
                const targetValue = config.regexTarget === "textContent"
                    ? element.textContent ?? ""
                    : config.regexTarget === "class"
                        ? [...element.classList].join(" ")
                        : element.getAttribute(config.regexTarget) ?? "";
                matchesCondition = config.regexPattern.test(targetValue);
            }

            if (element.hasAttribute(markerAttr)) {
                continue;
            }

            if (matchesCondition) {
                element.setAttribute(markerAttr, "true");
                if (config.removeFromDom) {
                    element.remove();
                }
                countHidden++;
            } else {
                element.style.setProperty("display", "flex", "important");
                element.style.setProperty("visibility", "visible", "important");
            }
        }
    } catch (error) {
        domLogger.warn(`Failed to hide elements for "${config.description}":`, error);
    }

    return countHidden;
}

export function createDomElementHider(
    targetElement: Element = document.body,
    hideConfigs: ElementHideConfig[],
    hiderOptions: ElementHiderOptions = {}
): { startObserving: () => void; stopObserving: () => void; hideImmediately: () => void; } {
    let debounceTimer: ReturnType<typeof setTimeout> | number | null = null;
    let isHiding = false;
    let styleManager: { cleanup: () => void; } | null = null;

    if (hiderOptions.injectCss) {
        const css = hideConfigs.map(config => `${config.selector} { display: none !important; visibility: hidden !important; }`).join("\n");
        styleManager = injectStyles(css, "element-hider-preemptive");
    }

    const performHide = () => {
        if (isHiding) {
            return;
        }
        isHiding = true;
        requestAnimationFrame(() => {
            for (const config of hideConfigs) {
                hideDomElements(config);
            }
            isHiding = false;
        });
    };

    const debouncedPerformHide = () => {
        if (debounceTimer !== null) {
            if (hiderOptions.useRequestAnimationFrame) {
                cancelAnimationFrame(debounceTimer);
            } else {
                clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
            }
        }
        const delay = hiderOptions.debounce ?? 0;
        const schedule = hiderOptions.useRequestAnimationFrame ? requestAnimationFrame : (cb: TimerHandler) => setTimeout(cb, delay);
        debounceTimer = schedule(performHide);
    };

    const mutationObserver = new MutationObserver(mutations => {
        let hasChanges = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }
                const element = node as HTMLElement;
                if (hideConfigs.some(config => element.matches(config.selector) || !!element.querySelector(config.selector))) {
                    hasChanges = true;
                    break;
                }
            }
            if (hasChanges) {
                break;
            }
        }
        if (hasChanges) {
            debouncedPerformHide();
        }
    });

    return {
        startObserving: () => mutationObserver.observe(targetElement, { childList: true, subtree: true }),
        stopObserving: () => {
            mutationObserver.disconnect();
            if (debounceTimer !== null) {
                if (hiderOptions.useRequestAnimationFrame) {
                    cancelAnimationFrame(debounceTimer);
                } else {
                    clearTimeout(debounceTimer as ReturnType<typeof setTimeout>);
                }
            }
            styleManager?.cleanup();
        },
        hideImmediately: performHide,
    };
}

export function createFocusTrap(container: HTMLElement): () => void {
    const focusableSelector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () => Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Tab") {
            return;
        }
        const elements = getFocusableElements();
        if (elements.length === 0) {
            return;
        }

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first) {
                last!.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === last) {
                first!.focus();
                event.preventDefault();
            }
        }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
}
