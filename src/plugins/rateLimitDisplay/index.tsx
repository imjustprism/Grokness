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
    type ElementFinderConfig,
    findElement,
    MutationObserverManager,
    querySelector,
    querySelectorAll,
    waitForElementByConfig,
} from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePluginSettings } from "@utils/settings";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
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
    "Grok 4": "grok-4",
    "Grok 3": "grok-3",
    "Grok 4 Heavy": "grok-4-heavy",
    "Expert": "grok-4",
    "Fast": "grok-3",
    "Auto": "grok-4-auto",
    "Heavy": "grok-4-heavy",
};

const DEFAULT_MODEL = "grok-4";
const DEFAULT_KIND = "DEFAULT";
const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit-container";

const commonSelectors = {
    queryBar: ".query-bar",
    oldUiModelSpan: ".query-bar button span.inline-block.text-primary",
    textarea: ".query-bar textarea",
};

const attachButtonFinder: ElementFinderConfig = {
    selector: `${commonSelectors.queryBar} button`,
    classContains: ["group/attach-button"],
    svgPartialD: "M10 9V15",
};

const cachedRateLimits: Record<string, Record<string, RateLimitData | undefined>> = {};
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

    let newUiEl: HTMLElement | null = null;
    const buttons = querySelectorAll("button", queryBar);
    for (const btn of buttons) {
        const hasNewUiIcon = btn.querySelector("svg.lucide-rocket, svg > path[d^='M5 14.25']");
        if (hasNewUiIcon) {
            newUiEl = querySelector("span > span.text-primary", btn);
            if (newUiEl) {
                break;
            }
        }
    }

    const oldUiEl = querySelector(commonSelectors.oldUiModelSpan, queryBar);
    const rawName = (newUiEl?.textContent ?? oldUiEl?.textContent)?.trim() ?? "";
    return (MODEL_MAP[rawName] ?? rawName.toLowerCase().replace(/\s+/g, "-")) || DEFAULT_MODEL;
}

async function fetchRateLimit(modelName: string, requestKind: string, force: boolean = false): Promise<RateLimitData | null> {
    if (!force && cachedRateLimits[modelName]?.[requestKind] !== undefined) {
        return cachedRateLimits[modelName][requestKind] ?? null;
    }
    try {
        const data = await grokAPI.rateLimits.get({ requestKind, modelName });
        cachedRateLimits[modelName] = { ...cachedRateLimits[modelName], [requestKind]: data };
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        cachedRateLimits[modelName] = { ...cachedRateLimits[modelName], [requestKind]: undefined };
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
    const getInitialRequestKind = (): string => {
        if (currentModel !== "grok-3") {
            return DEFAULT_KIND;
        }
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return DEFAULT_KIND;
        }

        const think = findElement({ selector: `${commonSelectors.queryBar} button`, ariaLabel: "Think", root: queryBar });
        const search = findElement({ selector: `${commonSelectors.queryBar} button`, ariaLabelRegex: /Deep(er)?Search/i, root: queryBar });

        if (think?.getAttribute("aria-pressed") === "true") {
            return "REASONING";
        }
        if (search?.getAttribute("aria-pressed") === "true") {
            const label = search.getAttribute("aria-label") ?? "";
            return /deeper/i.test(label) ? "DEEPERSEARCH" : "DEEPSEARCH";
        }
        return DEFAULT_KIND;
    };

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
            options: { attributes: true, attributeFilter: ["aria-pressed"], subtree: true, childList: true },
            callback: updateKind,
        });

        updateKind();
        observe();
        return disconnect;
    }, [currentModel]);
    return requestKind;
}

function RateLimitComponent() {
    const currentModel = useCurrentModel();
    const currentRequestKind = useCurrentRequestKind(currentModel);
    const [rateLimit, setRateLimit] = useState<ProcessedRateLimit | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [waitTimeCountdown, setWaitTimeCountdown] = useState<number | null>(null);

    const updateRateLimit = async (force: boolean = false) => {
        setIsLoading(true);
        const effortLevel = currentModel === "grok-4-auto" ? "both" : currentModel === "grok-3" ? "low" : "high";
        const data = await fetchRateLimit(currentModel, currentRequestKind, force);
        const processed = processRateLimitData(data, effortLevel);
        setRateLimit(processed);
        if (!("error" in processed) && processed.waitTimeSeconds > 0) {
            setWaitTimeCountdown(processed.waitTimeSeconds);
        }
        setIsLoading(false);
    };

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
    }, [waitTimeCountdown]);

    useEffect(() => {
        updateRateLimit();
        let interval: number;
        if (settings.store.autoRefresh) {
            const intervalMs = 60000;
            interval = window.setInterval(() => updateRateLimit(), intervalMs);
        }
        const onVisibilityChange = () => document.visibilityState === "visible" && updateRateLimit();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [currentModel, currentRequestKind, settings.store.autoRefresh]);

    useEffect(() => {
        const setupSubmitListener = async () => {
            try {
                const textarea = await waitForElementByConfig({ selector: commonSelectors.textarea });
                const handleKeyDown = (e: KeyboardEvent) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        setIsLoading(true);
                        setTimeout(() => updateRateLimit(true), 1500);
                    }
                };
                textarea.addEventListener("keydown", handleKeyDown);
                return () => textarea.removeEventListener("keydown", handleKeyDown);
            } catch (error) {
                logger.error("Could not find textarea to attach submit listener.", error);
            }
        };
        const cleanupPromise = setupSubmitListener();
        return () => {
            cleanupPromise.then(cleanup => cleanup?.());
        };
    }, []);

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
    let container: HTMLDivElement | null = null;
    let observerDisconnect: (() => void) | null = null;

    const mount = () => {
        if (document.getElementById(RATE_LIMIT_CONTAINER_ID)) {
            return;
        }

        const attachButton = findElement(attachButtonFinder);
        if (!attachButton) {
            return;
        }

        container = document.createElement("div");
        container.id = RATE_LIMIT_CONTAINER_ID;
        attachButton.insertAdjacentElement("afterend", container);
        root = createRoot(container);
        root.render(<RateLimitComponent />);
    };

    const unmount = () => {
        root?.unmount();
        container?.remove();
        root = null;
        container = null;
    };

    return {
        apply() {
            document.getElementById(RATE_LIMIT_CONTAINER_ID)?.remove();

            const observerCallback = () => {
                if (querySelector(commonSelectors.queryBar)) {
                    mount();
                } else {
                    unmount();
                }
            };

            const { observe, disconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: observerCallback,
            });

            observe();
            observerDisconnect = disconnect;
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
