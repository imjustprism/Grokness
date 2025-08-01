/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { RateLimitData } from "@api/interfaces";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import {
    findElement,
    MutationObserverManager,
    querySelector,
    waitForElementByConfig,
} from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("RateLimitDisplay", "#a6d189");

const settings = definePluginSettings({
    autoRefresh: {
        type: "boolean",
        displayName: "Auto Refresh",
        description: "Automatically refresh rate limit display periodically.",
        default: true,
    },
});

const MODEL_MAP: Record<string, string> = {
    // New Model Selector //
    "Auto": "grok-4-auto",
    "Fast": "grok-3",
    "Expert": "grok-4",
    "Heavy": "grok-4-heavy",
    // Old Model Selector //
    "Grok 3": "grok-3",
    "Grok 4": "grok-4",
    "Grok 4 Heavy": "grok-4-heavy",
};

const DEFAULT_MODEL = "grok-3";

const DEFAULT_KIND = "DEFAULT";

const commonSelectors = {
    queryBar: ".query-bar",
    inputElement: ".query-bar .tiptap.ProseMirror",
};

const observerManager = new MutationObserverManager();

type EffortLevel = "high" | "low" | "both";

type ProcessedRateLimit = { error: true; } | {
    isBoth: boolean;
    highRemaining: number;
    highTotal: number;
    lowRemaining?: number;
    lowTotal?: number;
    waitTimeSeconds: number;
};

function getCurrentModelFromUI(): string {
    const queryBar = querySelector(commonSelectors.queryBar);
    if (!queryBar) {
        return DEFAULT_MODEL;
    }

    const selectElement = querySelector("select[aria-hidden='true']", queryBar) as HTMLSelectElement | null;
    if (selectElement) {
        const modelValue = selectElement.value;
        if (modelValue) {
            if (modelValue.startsWith("grok-")) {
                return modelValue;
            }
            const mapKey = Object.keys(MODEL_MAP).find(k => k.toLowerCase() === modelValue);
            if (mapKey) {
                return MODEL_MAP[mapKey]!;
            }
        }
    }

    const modelButton = findElement({
        selector: 'button[role="combobox"]',
        root: queryBar,
        filter: el => !!el.querySelector("span"),
    });

    if (modelButton) {
        const modelNameSpan = querySelector("span", modelButton);
        const rawName = modelNameSpan?.textContent?.trim() ?? "";
        if (MODEL_MAP[rawName]) {
            return MODEL_MAP[rawName];
        }
    }

    return DEFAULT_MODEL;
}

async function fetchRateLimit(modelName: string, requestKind: string, force: boolean = false): Promise<RateLimitData | null> {
    const cacheKey = `${modelName}-${requestKind}`;
    if (!force && sessionStorage.getItem(cacheKey)) {
        try {
            return JSON.parse(sessionStorage.getItem(cacheKey)!);
        } catch { /* ignore parsing error */ }
    }

    try {
        const data = await grokAPI.rateLimits.get({ requestKind, modelName });
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        sessionStorage.removeItem(cacheKey);
        return null;
    }
}

function processRateLimitData(data: RateLimitData | null, effortLevel: EffortLevel): ProcessedRateLimit {
    if (!data) {
        return { error: true };
    }

    const high = data.highEffortRateLimits;
    const low = data.lowEffortRateLimits;

    if (effortLevel === "both") {
        return {
            isBoth: true,
            highRemaining: high?.remainingQueries ?? 0,
            highTotal: high?.totalQueries ?? data.totalQueries ?? 0,
            lowRemaining: low?.remainingQueries ?? 0,
            lowTotal: low?.totalQueries ?? data.totalQueries ?? 0,
            waitTimeSeconds: data.waitTimeSeconds ?? 0,
        };
    }

    const limits = effortLevel === "high" ? high : low;
    return {
        isBoth: false,
        highRemaining: limits?.remainingQueries ?? data.remainingQueries ?? 0,
        highTotal: limits?.totalQueries ?? data.totalQueries ?? 0,
        waitTimeSeconds: data.waitTimeSeconds ?? 0,
    };
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(getCurrentModelFromUI);

    useEffect(() => {
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return;
        }
        const updateModel = () => setModel(getCurrentModelFromUI());

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, characterData: true },
            callback: updateModel,
        });

        updateModel();
        observe();
        return disconnect;
    }, []);

    return model;
}

function useCurrentRequestKind(currentModel: string): string {
    const getInitialRequestKind = useCallback((): string => {
        if (currentModel !== "grok-3") {
            return DEFAULT_KIND;
        }

        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return DEFAULT_KIND;
        }

        const findButtonPressed = (label: string) =>
            findElement({ selector: `button[aria-label="${label}"]`, root: queryBar })?.getAttribute("aria-pressed") === "true";

        if (findButtonPressed("Think")) {
            return "REASONING";
        }

        if (findButtonPressed("DeeperSearch")) {
            return "DEEPERSEARCH";
        }

        if (findButtonPressed("DeepSearch")) {
            return "DEEPSEARCH";
        }

        return DEFAULT_KIND;
    }, [currentModel]);

    const [requestKind, setRequestKind] = useState<string>(getInitialRequestKind);

    useEffect(() => {
        if (currentModel !== "grok-3") {
            setRequestKind(DEFAULT_KIND);
            return;
        }

        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return;
        }

        const updateKind = () => setRequestKind(getInitialRequestKind());

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { attributes: true, attributeFilter: ["aria-pressed"], subtree: true },
            callback: updateKind,
        });

        updateKind();
        observe();
        return disconnect;
    }, [currentModel, getInitialRequestKind]);

    return requestKind;
}

function RateLimitComponent() {
    const currentModel = useCurrentModel();
    const currentRequestKind = useCurrentRequestKind(currentModel);
    const [rateLimit, setRateLimit] = useState<ProcessedRateLimit | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [waitTimeCountdown, setWaitTimeCountdown] = useState<number | null>(null);

    const updateRateLimit = useCallback(async (force: boolean = false) => {
        setIsLoading(true);
        const effortLevel = currentModel === "grok-4-auto" ? "both" : currentModel === "grok-3" ? "low" : "high";
        const data = await fetchRateLimit(currentModel, currentRequestKind, force);
        const processed = processRateLimitData(data, effortLevel);
        setRateLimit(processed);
        if (!("error" in processed) && processed.waitTimeSeconds > 0) {
            setWaitTimeCountdown(processed.waitTimeSeconds);
        }
        setIsLoading(false);
    }, [currentModel, currentRequestKind]);

    const formatCountdown = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
    };

    useEffect(() => {
        let timer: number;
        if (waitTimeCountdown !== null && waitTimeCountdown > 0) {
            timer = window.setInterval(() => {
                setWaitTimeCountdown(prev => {
                    const newTime = (prev ?? 1) - 1;
                    if (newTime <= 0) {
                        updateRateLimit(true);
                        return null;
                    }
                    return newTime;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [waitTimeCountdown, updateRateLimit]);

    useEffect(() => {
        updateRateLimit();
        let interval: number;
        if (settings.store.autoRefresh) {
            interval = window.setInterval(() => updateRateLimit(), 60000);
        }
        const onVisibilityChange = () => document.visibilityState === "visible" && updateRateLimit();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [updateRateLimit]);

    useEffect(() => {
        const setupSubmitListener = async () => {
            try {
                const inputElement = await waitForElementByConfig({ selector: commonSelectors.inputElement });
                const handleKeyDown = (e: KeyboardEvent) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        setIsLoading(true);
                        setTimeout(() => updateRateLimit(true), 1500);
                    }
                };
                inputElement.addEventListener("keydown", handleKeyDown);
                return () => inputElement.removeEventListener("keydown", handleKeyDown);
            } catch (error) {
                logger.error("Could not find input element to attach submit listener.", error);
            }
        };
        const cleanupPromise = setupSubmitListener();
        return () => {
            cleanupPromise.then(cleanup => cleanup?.());
        };
    }, [updateRateLimit]);

    const { isBoth, highRemaining, lowRemaining, waitTimeSeconds } = !rateLimit || "error" in rateLimit
        ? { isBoth: false, highRemaining: 0, lowRemaining: 0, waitTimeSeconds: 0 }
        : rateLimit;

    const isLimited = (isBoth ? highRemaining === 0 && (lowRemaining ?? 0) === 0 : highRemaining === 0) && waitTimeSeconds > 0;
    const highText = highRemaining.toString();
    const lowText = (lowRemaining ?? 0).toString();
    const content = isLimited ? formatCountdown(waitTimeCountdown ?? waitTimeSeconds) : isBoth ? `${highText} | ${lowText}` : highText;
    const tooltip = isLimited ? `Reset in ${content}` : isBoth ? `High: ${highRemaining} | Low: ${lowRemaining ?? 0}` : `${highRemaining} queries left`;

    return (
        <Button
            id="grok-rate-limit"
            variant="outline"
            size="md"
            loading={isLoading}
            icon={isLimited ? "Clock" : "Gauge"}
            onClick={() => updateRateLimit(true)}
            tooltip={tooltip}
            color={isLimited ? "danger" : "default"}
        >
            {isLoading && !rateLimit ? <span>&nbsp;</span> : content}
        </Button>
    );
}

const rateLimitPatch: IPatch = (() => {
    let root: Root | null = null;
    let container: HTMLElement | null = null;
    let currentQueryBar: HTMLElement | null = null;
    let observerDisconnect: (() => void) | null = null;

    const mount = (queryBar: HTMLElement) => {
        if (currentQueryBar === queryBar || container) {
            return;
        }
        const attachButton = findElement({
            selector: "button",
            classContains: ["group/attach-button"],
            svgPartialD: "M10 9V15",
            root: queryBar
        });
        if (!attachButton || !attachButton.parentElement) {
            logger.warn("Could not find the attach button to mount the rate limit display.");
            return;
        }
        container = document.createElement("div");
        container.id = "rate-limit-display-container";
        attachButton.insertAdjacentElement("afterend", container);
        root = createRoot(container);
        root.render(<RateLimitComponent />);
        currentQueryBar = queryBar;
        logger.log("RateLimitComponent mounted.");
    };

    const unmount = () => {
        if (root) {
            root.unmount();
            root = null;
        }
        if (container) {
            container.remove();
            container = null;
        }
        currentQueryBar = null;
        logger.log("RateLimitComponent unmounted.");
    };

    return {
        apply() {
            const observerCallback = () => {
                const queryBar = querySelector(commonSelectors.queryBar);
                if (queryBar && queryBar !== currentQueryBar) {
                    unmount();
                    mount(queryBar);
                } else if (!queryBar && currentQueryBar) {
                    unmount();
                }
            };
            const { observe, disconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: observerCallback,
                debounceDelay: 200,
            });
            observerDisconnect = disconnect;
            observe();
            observerCallback();
        },
        remove() {
            observerDisconnect?.();
            unmount();
        },
    };
})();

export default definePlugin({
    name: "Rate Limit Display",
    description: "Displays the remaining queries for the current model in the chat bar.",
    authors: [Devs.blankspeaker, Devs.CursedAtom, Devs.Prism],
    category: "chat",
    tags: ["rate-limit", "queries"],
    settings,
    patches: [rateLimitPatch],
});
