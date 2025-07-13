/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { RateLimitData } from "@api/interfaces";
import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import { MutationObserverManager, querySelector } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("RateLimitDisplay", "#a6d189");

const MODEL_MAP: Record<string, string> = {
    "Grok 4": "grok-4",
    "Grok 3": "grok-3",
    "Grok 4 Heavy": "grok-4-heavy",
};

const DEFAULT_MODEL = "grok-4";
const DEFAULT_KIND = "DEFAULT";
const POLL_INTERVAL_MS = 60000;
const MODEL_SELECTOR = ".query-bar button span.inline-block.text-primary";
const ATTACH_BUTTON_SELECTOR = '.query-bar button[aria-label="Attach"]';
const QUERY_BAR_SELECTOR = ".query-bar";
const DEBOUNCE_DELAY_MS = 100;
const BODY_OBSERVER_DEBOUNCE_MS = 200;
const POST_SUBMIT_UPDATE_DELAY_MS = 5000;

const cachedRateLimits: Record<string, Record<string, RateLimitData | undefined>> = {};
const observerManager = new MutationObserverManager();

function normalizeModelName(rawName: string): string {
    const trimmed = rawName.trim();
    if (!trimmed) {
        logger.warn("Empty model name provided for normalization, using default");
        return DEFAULT_MODEL;
    }
    const normalized = MODEL_MAP[trimmed] || trimmed.toLowerCase().replace(/\s+/g, "-");
    return normalized;
}

async function fetchRateLimit(modelName: string, requestKind: string, force: boolean = false): Promise<RateLimitData | null> {
    if (!force) {
        const cached = cachedRateLimits[modelName]?.[requestKind];
        if (cached !== undefined) {
            return cached;
        }
    }

    try {
        const data = await grokAPI.rateLimits.get({ requestKind, modelName });
        if (!cachedRateLimits[modelName]) {
            cachedRateLimits[modelName] = {};
        }
        cachedRateLimits[modelName][requestKind] = data;
        return data;
    } catch (error) {
        logger.error(`Failed to fetch rate limit for ${modelName} (${requestKind}):`, error);
        if (!cachedRateLimits[modelName]) {
            cachedRateLimits[modelName] = {};
        }
        cachedRateLimits[modelName][requestKind] = undefined;
        return null;
    }
}

function useCurrentModel(): string {
    const [model, setModel] = useState<string>(DEFAULT_MODEL);

    useEffect(() => {
        const modelSpan = querySelector(MODEL_SELECTOR);
        if (modelSpan) {
            const updateModel = () => {
                const rawName = modelSpan.textContent?.trim() ?? DEFAULT_MODEL;
                const newModel = normalizeModelName(rawName);
                if (newModel !== model) {
                    setModel(newModel);
                }
            };

            const { observe, disconnect } = observerManager.createObserver({
                target: modelSpan,
                options: { childList: true, subtree: true, characterData: true },
                callback: updateModel,
            });

            updateModel();
            observe();

            return () => {
                disconnect();
            };
        } else {
            logger.warn("Model span not found, using default model");
        }
    }, [model]);

    return model;
}

function useCurrentRequestKind(currentModel: string): string {
    const [requestKind, setRequestKind] = useState<string>(DEFAULT_KIND);

    useEffect(() => {
        if (currentModel !== "grok-3") {
            setRequestKind(DEFAULT_KIND);
            return;
        }

        const thinkButton = querySelector('button[aria-label="Think"]');
        const searchButton = querySelector('button[aria-label^="Deep"]');

        if (!thinkButton || !searchButton) {
            logger.warn("Think or DeepSearch button not found for Grok-3, using default request kind");
            setRequestKind(DEFAULT_KIND);
            return;
        }

        const updateKind = () => {
            if (thinkButton.getAttribute("aria-pressed") === "true") {
                setRequestKind("REASONING");
            } else if (searchButton.getAttribute("aria-pressed") === "true") {
                const modeSpan = searchButton.querySelector("span");
                const modeText = modeSpan?.textContent?.trim();
                if (modeText === "DeepSearch") {
                    setRequestKind("DEEPSEARCH");
                } else if (modeText === "DeeperSearch") {
                    setRequestKind("DEEPERSEARCH");
                } else {
                    setRequestKind(DEFAULT_KIND);
                }
            } else {
                setRequestKind(DEFAULT_KIND);
            }
        };

        updateKind();

        const thinkObserver = observerManager.createObserver({
            target: thinkButton,
            options: { attributes: true, attributeFilter: ["aria-pressed", "class"] },
            callback: updateKind,
        });
        thinkObserver.observe();

        const searchObserver = observerManager.createObserver({
            target: searchButton,
            options: { attributes: true, attributeFilter: ["aria-pressed", "class"], childList: true, subtree: true, characterData: true },
            callback: updateKind,
        });
        searchObserver.observe();

        return () => {
            thinkObserver.disconnect();
            searchObserver.disconnect();
        };
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
        if (data) {
            setRateLimit(data);
        }
        setIsLoading(false);
        if (!data) {
            logger.warn(`Rate limit data unavailable for model "${currentModel}" (${currentRequestKind}) after update attempt`);
        }
    };

    useEffect(() => {
        updateRateLimit();

        let intervalId: ReturnType<typeof setInterval> | null = null;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateRateLimit();
                intervalId = setInterval(() => updateRateLimit(), POLL_INTERVAL_MS);
            } else {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        if (document.visibilityState === "visible") {
            intervalId = setInterval(() => updateRateLimit(), POLL_INTERVAL_MS);
        }

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentModel, currentRequestKind]);

    useEffect(() => {
        const queryBar = querySelector(QUERY_BAR_SELECTOR);
        if (!queryBar) {
            return;
        }

        const textarea = queryBar.querySelector("textarea");
        const sendButton = queryBar.querySelector("div.h-10.relative.aspect-square");

        if (!textarea || !sendButton) {
            logger.warn("Textarea or send button not found for post-submit update");
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                const kindAtSubmit = currentRequestKind;
                setTimeout(async () => {
                    setIsLoading(true);
                    const data = await fetchRateLimit(currentModel, kindAtSubmit, true);
                    if (data) {
                        setRateLimit(data);
                    }
                    setIsLoading(false);
                }, POST_SUBMIT_UPDATE_DELAY_MS);
            }
        };

        const handleClick = () => {
            const kindAtSubmit = currentRequestKind;
            setTimeout(async () => {
                setIsLoading(true);
                const data = await fetchRateLimit(currentModel, kindAtSubmit, true);
                if (data) {
                    setRateLimit(data);
                }
                setIsLoading(false);
            }, POST_SUBMIT_UPDATE_DELAY_MS);
        };

        textarea.addEventListener("keydown", handleKeyDown as EventListener);
        sendButton.addEventListener("click", handleClick);

        return () => {
            textarea.removeEventListener("keydown", handleKeyDown as EventListener);
            sendButton.removeEventListener("click", handleClick);
        };
    }, [currentModel, currentRequestKind]);

    const handleClick = () => {
        updateRateLimit(true);
    };

    const content = rateLimit ? `${rateLimit.remainingQueries}/${rateLimit.totalQueries}` : "Unavailable";

    return (
        <IconButton
            id="grok-rate-limit"
            as="div"
            variant="outline"
            size="md"
            icon="Gauge"
            loading={isLoading}
            onClick={handleClick}
            aria-label="Rate Limit"
            data-state="closed"
            tooltipContent="Rate Limit"
            toggleGroup="rate-limit"
        >
            {content}
        </IconButton>
    );
}

const RATE_LIMIT_CONTAINER_ID = "grok-rate-limit-container";

const rateLimitPatch: IPatch = (() => {
    let rateLimitRoot: Root | null = null;
    let rateLimitContainer: HTMLDivElement | null = null;
    let queryBarObserverDisconnect: (() => void) | null = null;
    let bodyObserverDisconnect: (() => void) | null = null;
    let hasCheckedInitial = false;
    let hasWarned = false;

    function mountRateLimit() {
        const attachButton = querySelector(ATTACH_BUTTON_SELECTOR);
        if (!attachButton) {
            logger.warn("Attach button not found, cannot mount rate limit display");
            return;
        }

        const existingContainer = document.getElementById(RATE_LIMIT_CONTAINER_ID);
        if (existingContainer) {
            if (attachButton.parentElement?.contains(existingContainer)) {
                return;
            } else {
                existingContainer.remove();
            }
        }

        unmountRateLimit();
        rateLimitContainer = document.createElement("div");
        rateLimitContainer.id = RATE_LIMIT_CONTAINER_ID;
        attachButton.insertAdjacentElement("afterend", rateLimitContainer);
        rateLimitRoot = createRoot(rateLimitContainer);
        rateLimitRoot.render(<RateLimitComponent />);
    }

    function unmountRateLimit() {
        if (rateLimitRoot) {
            rateLimitRoot.unmount();
            rateLimitRoot = null;
        }
        if (rateLimitContainer) {
            rateLimitContainer.remove();
            rateLimitContainer = null;
        }
    }

    function setupQueryBarObserver(queryBar: HTMLElement) {
        if (queryBarObserverDisconnect) {
            queryBarObserverDisconnect();
            queryBarObserverDisconnect = null;
        }
        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: queryBar,
            options: { childList: true, subtree: true, attributes: true },
            callback: () => {
                mountRateLimit();
            },
            debounceDelay: DEBOUNCE_DELAY_MS,
        });

        observe();
        queryBarObserverDisconnect = disconnect;
    }

    return {
        apply() {
            const mutationCallback = () => {
                const queryBar = querySelector(QUERY_BAR_SELECTOR);
                if (queryBar) {
                    mountRateLimit();
                    setupQueryBarObserver(queryBar);
                } else if (hasCheckedInitial && !hasWarned) {
                    logger.warn("Query bar not found during body mutation check");
                    hasWarned = true;
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
            hasCheckedInitial = true;

            document.addEventListener("visibilitychange", mutationCallback);
        },
        remove() {
            if (queryBarObserverDisconnect) {
                queryBarObserverDisconnect();
                queryBarObserverDisconnect = null;
            }
            if (bodyObserverDisconnect) {
                bodyObserverDisconnect();
                bodyObserverDisconnect = null;
            }
            unmountRateLimit();
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
        },
    };
})();

export default definePlugin({
    name: "RateLimitDisplay",
    description: "Displays the remaining queries for the current model in the chat bar.",
    authors: [Devs.blankspeaker, Devs.CursedAtom, Devs.Prism],
    category: "chat",
    tags: ["rate-limit", "queries"],
    patches: [rateLimitPatch],
});
