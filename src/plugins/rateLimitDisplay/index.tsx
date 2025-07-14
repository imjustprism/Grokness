/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { RateLimitData } from "@api/interfaces";
import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import { commonFinderConfigs, commonSelectors, findElement, MutationObserverManager, querySelector, waitForElementByConfig } from "@utils/dom";
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
    refreshInterval: {
        type: "number",
        displayName: "Refresh Interval (seconds)",
        description: "Time between automatic refreshes (minimum 30 seconds).",
        default: 60,
        min: 30,
    },
    displayFormat: {
        type: "select",
        displayName: "Display Format",
        description: "How to display the rate limit information.",
        options: [
            { label: "Remaining/Total", value: "remaining_total" },
            { label: "Remaining Only", value: "remaining" },
            { label: "Percentage", value: "percentage" },
        ],
        default: "remaining_total",
    },
});

const MODEL_MAP: Record<string, string> = {
    "Grok 4": "grok-4",
    "Grok 3": "grok-3",
    "Grok 4 Heavy": "grok-4-heavy",
};

const DEFAULT_MODEL = "grok-4";
const DEFAULT_KIND = "DEFAULT";
const MIN_REFRESH_INTERVAL_MS = 30000;
const DEBOUNCE_DELAY_MS = 100;
const BODY_OBSERVER_DEBOUNCE_MS = 200;
const POST_SUBMIT_UPDATE_DELAY_MS = 5000;
const ELEMENT_WAIT_TIMEOUT_MS = 5000;

const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit-container";

const cachedRateLimits: Record<string, Record<string, RateLimitData | undefined>> = {};
const observerManager = new MutationObserverManager();

function normalizeModelName(rawName: string): string {
    const trimmed = rawName.trim();
    if (!trimmed) {
        return DEFAULT_MODEL;
    }
    return MODEL_MAP[trimmed] || trimmed.toLowerCase().replace(/\s+/g, "-");
}

async function fetchRateLimit(modelName: string, requestKind: string, force: boolean = false): Promise<RateLimitData | null> {
    if (!force && cachedRateLimits[modelName]?.[requestKind] !== undefined) {
        return cachedRateLimits[modelName][requestKind] ?? null;
    }

    try {
        const data = await grokAPI.rateLimits.get({ requestKind, modelName });
        cachedRateLimits[modelName] = cachedRateLimits[modelName] || {};
        cachedRateLimits[modelName][requestKind] = data;
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        cachedRateLimits[modelName] = cachedRateLimits[modelName] || {};
        cachedRateLimits[modelName][requestKind] = undefined;
        return null;
    }
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(DEFAULT_MODEL);

    useEffect(() => {
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return;
        }

        const updateModel = () => {
            const modelSpan = querySelector(commonSelectors.modelSpan, queryBar);
            if (!modelSpan) {
                return;
            }
            const rawName = modelSpan.textContent?.trim() ?? DEFAULT_MODEL;
            setModel(normalizeModelName(rawName));
        };

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, characterData: true, attributes: true },
            callback: updateModel,
            debounceDelay: DEBOUNCE_DELAY_MS,
        });

        updateModel();
        observe();

        return disconnect;
    }, []);

    return model;
}

function useCurrentRequestKind(currentModel: string): string {
    const [requestKind, setRequestKind] = useState<string>(DEFAULT_KIND);

    useEffect(() => {
        if (currentModel !== "grok-3") {
            setRequestKind(DEFAULT_KIND);
            return;
        }

        (async () => {
            const thinkButton = await waitForElementByConfig(commonFinderConfigs.thinkButton, ELEMENT_WAIT_TIMEOUT_MS);
            const searchButton = await waitForElementByConfig(commonFinderConfigs.deepSearchButton, ELEMENT_WAIT_TIMEOUT_MS);

            if (!thinkButton || !searchButton) {
                return setRequestKind(DEFAULT_KIND);
            }

            const updateKind = () => {
                if (thinkButton.getAttribute("aria-pressed") === "true") {
                    setRequestKind("REASONING");
                } else if (searchButton.getAttribute("aria-pressed") === "true") {
                    const modeSpan = querySelector("span", searchButton);
                    const modeText = modeSpan?.textContent?.trim() ?? "";
                    setRequestKind(/deeper/i.test(modeText) ? "DEEPERSEARCH" : /deep/i.test(modeText) ? "DEEPSEARCH" : DEFAULT_KIND);
                } else {
                    setRequestKind(DEFAULT_KIND);
                }
            };

            updateKind();

            const thinkObs = observerManager.createObserver({
                target: thinkButton,
                options: { attributes: true, attributeFilter: ["aria-pressed", "class"] },
                callback: updateKind,
            });
            thinkObs.observe();

            const searchObs = observerManager.createObserver({
                target: searchButton,
                options: { attributes: true, attributeFilter: ["aria-pressed", "class"], childList: true, subtree: true, characterData: true },
                callback: updateKind,
            });
            searchObs.observe();

            return () => {
                thinkObs.disconnect();
                searchObs.disconnect();
            };
        })();
    }, [currentModel]);

    return requestKind;
}

function RateLimitComponent() {
    const currentModel = useCurrentModel();
    const currentRequestKind = useCurrentRequestKind(currentModel);
    const [rateLimit, setRateLimit] = useState<RateLimitData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const updateRateLimit = async (force: boolean = false) => {
        setIsLoading(true);
        const data = await fetchRateLimit(currentModel, currentRequestKind, force);
        setRateLimit(data);
        setIsLoading(false);
    };

    useEffect(() => {
        updateRateLimit();

        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (settings.store.autoRefresh) {
            const intervalMs = Math.max(settings.store.refreshInterval * 1000, MIN_REFRESH_INTERVAL_MS);
            intervalId = setInterval(updateRateLimit, intervalMs);
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateRateLimit();
                if (settings.store.autoRefresh && !intervalId) {
                    const intervalMs = Math.max(settings.store.refreshInterval * 1000, MIN_REFRESH_INTERVAL_MS);
                    intervalId = setInterval(updateRateLimit, intervalMs);
                }
            } else {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentModel, currentRequestKind, settings.store.autoRefresh, settings.store.refreshInterval]);

    useEffect(() => {
        (async () => {
            const textarea = await waitForElementByConfig({ selector: commonSelectors.textarea }, ELEMENT_WAIT_TIMEOUT_MS);
            const sendButton = await waitForElementByConfig(commonFinderConfigs.submitButton, ELEMENT_WAIT_TIMEOUT_MS);

            if (!textarea || !sendButton) {
                return;
            }

            const handleSubmit = () => {
                setTimeout(() => updateRateLimit(true), POST_SUBMIT_UPDATE_DELAY_MS);
            };

            textarea.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    handleSubmit();
                }
            });

            sendButton.addEventListener("click", handleSubmit);

            return () => {
                textarea.removeEventListener("keydown", () => { });
                sendButton.removeEventListener("click", () => { });
            };
        })();
    }, [currentModel, currentRequestKind]);

    let content = "Unavailable";
    if (rateLimit) {
        switch (settings.store.displayFormat) {
            case "remaining_total":
                content = `${rateLimit.remainingQueries}/${rateLimit.totalQueries}`;
                break;
            case "remaining":
                content = `${rateLimit.remainingQueries}`;
                break;
            case "percentage":
                content = `${Math.round((rateLimit.remainingQueries / rateLimit.totalQueries) * 100)}%`;
                break;
        }
    }

    return (
        <IconButton
            id="grok-rate-limit"
            as="button"
            variant="outline"
            size="md"
            icon="Gauge"
            loading={isLoading}
            onClick={() => updateRateLimit(true)}
            aria-label="Rate Limit"
            tooltipContent="Rate Limit"
        >
            {content}
        </IconButton>
    );
}

const rateLimitPatch: IPatch = (() => {
    let rateLimitRoot: Root | null = null;
    let rateLimitContainer: HTMLDivElement | null = null;
    let queryBarObserverDisconnect: (() => void) | null = null;
    let bodyObserverDisconnect: (() => void) | null = null;

    function mountRateLimit() {
        const queryBar = querySelector(commonSelectors.queryBar);
        if (!queryBar) {
            return;
        }

        const attachButton = findElement({ ...commonFinderConfigs.attachButton, root: queryBar });
        if (!attachButton) {
            return;
        }

        const existingContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (existingContainer) {
            if (attachButton.parentElement?.contains(existingContainer)) {
                return;
            }
            existingContainer.remove();
        }

        rateLimitContainer = document.createElement("div");
        rateLimitContainer.id = RATE_LIMIT_CONTAINER_ID;
        attachButton.insertAdjacentElement("afterend", rateLimitContainer);
        rateLimitRoot = createRoot(rateLimitContainer);
        rateLimitRoot.render(<RateLimitComponent />);
    }

    function unmountRateLimit() {
        rateLimitRoot?.unmount();
        rateLimitContainer?.remove();
        rateLimitRoot = null;
        rateLimitContainer = null;
    }

    return {
        apply() {
            const mutationCallback = () => {
                const queryBar = querySelector(commonSelectors.queryBar);
                if (queryBar) {
                    mountRateLimit();
                    if (queryBarObserverDisconnect) {
                        queryBarObserverDisconnect();
                    }
                    const { observe, disconnect } = observerManager.createDebouncedObserver({
                        target: queryBar,
                        options: { childList: true, subtree: true, attributes: true },
                        callback: mountRateLimit,
                        debounceDelay: DEBOUNCE_DELAY_MS,
                    });
                    observe();
                    queryBarObserverDisconnect = disconnect;
                }
            };

            const { observe: bodyObserve, disconnect: bodyDisconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutationCallback,
                debounceDelay: BODY_OBSERVER_DEBOUNCE_MS,
            });

            bodyObserve();
            bodyObserverDisconnect = bodyDisconnect;

            mutationCallback();

            document.addEventListener("visibilitychange", mutationCallback);
        },
        remove() {
            queryBarObserverDisconnect?.();
            bodyObserverDisconnect?.();
            unmountRateLimit();
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
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
