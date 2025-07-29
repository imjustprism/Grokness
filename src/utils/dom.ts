/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const domLogger = new Logger("DOM", "#ef4444");

// --- Type Definitions ---
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

// --- Element Querying ---

export function querySelector(
    selector: string,
    root: Document | Element = document
): HTMLElement | null {
    if (!root) {
        domLogger.error("Root element is null or undefined for selector:", selector);
        return null;
    }
    if (!selector.trim()) {
        domLogger.error("Invalid or empty selector provided.");
        return null;
    }
    try {
        return root.querySelector(selector) as HTMLElement | null;
    } catch (error) {
        domLogger.error(`Invalid selector: ${selector}`, error);
        return null;
    }
}

export function querySelectorAll(
    selector: string,
    root: Document | Element = document
): HTMLElement[] {
    if (!root) {
        domLogger.error("Root element is null or undefined for querySelectorAll:", selector);
        return [];
    }
    if (!selector.trim()) {
        domLogger.error("Invalid or empty selector provided for querySelectorAll.");
        return [];
    }
    try {
        return Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    } catch (error) {
        domLogger.error(`Invalid selector: ${selector}`, error);
        return [];
    }
}

export function findElement(config: ElementFinderConfig): HTMLElement | null {
    const candidates = getCandidateElements(config);

    for (const el of candidates) {
        if (
            (!config.filter || config.filter(el)) &&
            (!config.textRegex || config.textRegex.test((config.matchDescendants ? el.innerText : el.textContent)?.trim() ?? "")) &&
            (!config.attrRegex || config.attrRegex.regex.test(el.getAttribute(config.attrRegex.attr) ?? "")) &&
            (!config.svgPartialD || el.querySelector(`svg path[d*="${config.svgPartialD.replace(/"/g, '\\"')}"]`)) &&
            (!config.ariaLabelRegex || config.ariaLabelRegex.test(el.getAttribute("aria-label") ?? ""))
        ) {
            return el;
        }
    }

    return null;
}

function getCandidateElements(config: ElementFinderConfig): HTMLElement[] {
    const root = config.root ?? document;

    if (config.xpath) {
        try {
            const result = document.evaluate(config.xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const elements: HTMLElement[] = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                const node = result.snapshotItem(i);
                if (node instanceof HTMLElement) {
                    elements.push(node);
                }
            }
            return elements;
        } catch (error) {
            domLogger.warn(`Invalid XPath in config: ${config.xpath}`, error);
            return [];
        }
    }

    let enhancedSelector = config.selector;
    if (config.classContains) {
        enhancedSelector += config.classContains.map(cls => `.${CSS.escape(cls)}`).join("");
    }
    if (config.idContains) {
        enhancedSelector += `[id*="${config.idContains.replace(/"/g, '\\"')}"]`;
    }
    if (config.ariaLabel) {
        enhancedSelector += `[aria-label="${config.ariaLabel.replace(/"/g, '\\"')}"]`;
    }
    return querySelectorAll(enhancedSelector, root);
}

export function waitForElementByConfig(config: ElementFinderConfig, timeoutMs = 10000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        const existingElement = findElement(config);
        if (existingElement) {
            return resolve(existingElement);
        }

        const observer = new MutationObserver(() => {
            const foundElement = findElement(config);
            if (foundElement) {
                observer.disconnect();
                clearTimeout(timeoutId);
                resolve(foundElement);
            }
        });

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            const error = new Error(`Element not found within ${timeoutMs}ms using config: ${JSON.stringify(config)}`);
            domLogger.error(error.message);
            reject(error);
        }, timeoutMs);

        observer.observe(config.root ?? document, {
            childList: true,
            subtree: true,
            attributes: true,
        });
    });
}

// --- DOM Observation ---

export class MutationObserverManager {
    private observersMap = new Map<MutationObserver, string>();
    private nextObserverId = 0;

    public createObserver = (config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } => {
        if (!config.target) {
            const error = new Error("MutationObserverConfig target element is null or undefined");
            domLogger.error(error.message);
            throw error;
        }
        const observer = new MutationObserver(config.callback);
        this.observersMap.set(observer, `observer-${this.nextObserverId++}`);

        const observe = () => observer.observe(config.target, config.options);
        const disconnect = () => {
            observer.disconnect();
            this.observersMap.delete(observer);
        };
        return { observe, disconnect };
    };

    public createDebouncedObserver = (config: MutationObserverConfig): { observe: () => void; disconnect: () => void; } => {
        let timer: ReturnType<typeof setTimeout> | number | null = null;
        const debouncedCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
            if (timer !== null) {
                config.useRaf ? cancelAnimationFrame(timer as number) : clearTimeout(timer as number);
            }
            if (config.useRaf) {
                timer = requestAnimationFrame(() => config.callback(mutations, observer));
            } else {
                timer = setTimeout(() => config.callback(mutations, observer), config.debounceDelay ?? 100);
            }
        };
        return this.createObserver({ ...config, callback: debouncedCallback });
    };

    public disconnectAll = (): void => {
        this.observersMap.forEach((_, observer) => observer.disconnect());
        this.observersMap.clear();
    };

    public getActiveCount = (): number => this.observersMap.size;
}

// --- Element Hiding ---

export function hideDomElements(config: ElementHideConfig): number {
    let countHidden = 0;
    const markerAttr = config.markerAttribute || "data-hidden";

    try {
        for (const element of querySelectorAll(config.selector)) {
            const targetValue = config.regexTarget === "textContent" ? element.textContent :
                config.regexTarget === "class" ? element.className :
                    config.regexTarget ? element.getAttribute(config.regexTarget) : "";

            const matchesCondition = (config.condition && config.condition(element)) ||
                (config.regexPattern && config.regexTarget && config.regexPattern.test(targetValue ?? ""));

            if (matchesCondition) {
                if (!element.hasAttribute(markerAttr)) {
                    element.setAttribute(markerAttr, "true");
                    if (config.removeFromDom) {
                        element.remove();
                    } else {
                        element.style.setProperty("display", "none", "important");
                        element.style.setProperty("visibility", "hidden", "important");
                    }
                    countHidden++;
                }
            } else if (element.hasAttribute(markerAttr)) {
                element.removeAttribute(markerAttr);
                element.style.removeProperty("display");
                element.style.removeProperty("visibility");
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
    let styleElement: HTMLStyleElement | null = null;

    const cssHideConfigs = hiderOptions.injectCss
        ? hideConfigs.filter(config => !config.condition && !config.regexPattern && !config.removeFromDom)
        : [];
    const jsHideConfigs = hideConfigs.filter(config => !hiderOptions.injectCss || config.condition || config.regexPattern || config.removeFromDom);

    if (cssHideConfigs.length > 0) {
        const css = cssHideConfigs.map(config => `${config.selector} { display: none !important; visibility: hidden !important; }`).join("\n");
        styleElement = document.createElement("style");
        styleElement.id = "element-hider-preemptive";
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    const performHide = () => jsHideConfigs.forEach(hideDomElements);

    const debouncedPerformHide = () => {
        if (debounceTimer) {
            hiderOptions.useRequestAnimationFrame ? cancelAnimationFrame(debounceTimer as number) : clearTimeout(debounceTimer as number);
        }
        if (hiderOptions.useRequestAnimationFrame) {
            debounceTimer = requestAnimationFrame(performHide);
        } else {
            debounceTimer = setTimeout(performHide, hiderOptions.debounce ?? 0);
        }
    };

    const mutationObserver = new MutationObserver(debouncedPerformHide);

    return {
        startObserving: () => {
            if (jsHideConfigs.length > 0) {
                performHide();
                mutationObserver.observe(targetElement, { childList: true, subtree: true });
            }
        },
        stopObserving: () => {
            mutationObserver.disconnect();
            if (debounceTimer) {
                hiderOptions.useRequestAnimationFrame ? cancelAnimationFrame(debounceTimer as number) : clearTimeout(debounceTimer as number);
            }
            styleElement?.remove();
        },
        hideImmediately: performHide,
    };
}

// --- Accessibility ---

export function createFocusTrap(container: HTMLElement): () => void {
    const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Tab") {
            return;
        }

        const elements = Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
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
        } else if (document.activeElement === last) {
            first!.focus();
            event.preventDefault();
        }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
}
