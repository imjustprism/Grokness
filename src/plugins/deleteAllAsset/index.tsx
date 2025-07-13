/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// TODO: Fix the IconButton to chnage the icon color on hover to red when its in confirmation state //

import { grokAPI } from "@api/api";
import type { Asset } from "@api/interfaces";
import { IconButton } from "@components/IconButton";
import { Devs } from "@utils/constants";
import { type ElementFinderConfig, findElement, MutationObserverManager } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("DeleteAllAssets", "#ef4444");

const TOOLBAR_FINDER_CONFIG: ElementFinderConfig = {
    selector: "div.flex.gap-2.overflow-x-auto.no-scrollbar.h-subheader-height.items-center",
    filter: el => !!el.querySelector('button[aria-haspopup="menu"] svg path[d="M3 7L21 7"]') &&
        !!el.querySelector('button[aria-haspopup="menu"] svg.lucide-arrow-down-narrow-wide'),
};

const DELETE_CONTAINER_ID = "grok-delete-all-container";

async function fetchAllAssets(): Promise<Asset[]> {
    let allAssets: Asset[] = [];
    let pageToken: string | undefined = undefined;

    do {
        const response = await grokAPI.assetRepository.listAssets({
            pageSize: 50,
            orderBy: "ORDER_BY_LAST_USE_TIME",
            source: "SOURCE_ANY",
            isLatest: true,
            pageToken,
        });
        allAssets = allAssets.concat(response.assets);
        pageToken = response.nextPageToken;
    } while (pageToken);

    return allAssets;
}

function DeleteAllButton() {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isConfirming) {
            const timer = setTimeout(() => setIsConfirming(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [isConfirming]);

    const handleClick = async () => {
        if (isLoading) {
            return;
        }

        if (isConfirming) {
            setIsLoading(true);
            try {
                const assets = await fetchAllAssets();
                if (assets.length === 0) {
                    logger.info("No assets to delete.");
                    setIsConfirming(false);
                    return;
                }

                await Promise.all(
                    assets.map(asset =>
                        grokAPI.assetRepository.deleteAsset({ assetId: asset.assetId })
                    )
                );
                logger.info(`Successfully deleted ${assets.length} assets.`);
                window.location.reload();
            } catch (error) {
                logger.error("Failed to delete assets:", error);
            } finally {
                setIsLoading(false);
                setIsConfirming(false);
            }
        } else {
            setIsConfirming(true);
        }
    };

    return (
        <div className={`flex items-center rounded-full border gap-0.5 border-border-l2 h-8 overflow-hidden flex-shrink-0 focus-visible:bg-button-ghost-hover hover:bg-button-ghost-hover ${isConfirming ? "border-[hsl(var(--fg-danger))] bg-[hsl(var(--fg-danger))/0.1] hover:bg-[hsl(var(--fg-danger))/0.2]" : ""}`}>
            <IconButton
                id="grok-delete-all"
                as="button"
                variant="ghost"
                size="sm"
                icon="Trash2"
                loading={isLoading}
                onClick={handleClick}
                aria-label="Delete All Assets"
                tooltipContent={isConfirming ? "Are you sure? Click again to confirm" : "Delete All Assets"}
                className={`h-8 rounded-xl px-3 text-xs border-transparent hover:bg-transparent flex-shrink-0 ${isConfirming ? "text-[hsl(var(--fg-danger))] hover:text-white [&_svg]:text-[hsl(var(--fg-danger))] [&_svg]:hover:text-white" : ""}`}
                style={{ boxShadow: "none" }}
                rounded={false}
                iconSize={16}
            >
                <span className="sr-only">Delete All Assets</span>
                <span className="hidden @[160px]:inline-block">{isConfirming ? "Confirm" : "Delete All"}</span>
            </IconButton>
        </div>
    );
}

const deleteAllPatch: IPatch = (() => {
    let deleteRoot: Root | null = null;
    let deleteContainer: HTMLDivElement | null = null;
    let toolbarObserverDisconnect: (() => void) | null = null;
    let bodyObserverDisconnect: (() => void) | null = null;
    const observerManager = new MutationObserverManager();

    function mountDeleteButton() {
        const toolbar = findElement(TOOLBAR_FINDER_CONFIG);
        if (!toolbar) {
            return;
        }

        const existingContainer = document.getElementById(DELETE_CONTAINER_ID);
        if (existingContainer && toolbar.contains(existingContainer)) {
            return;
        }

        unmountDeleteButton();

        deleteContainer = document.createElement("div");
        deleteContainer.id = DELETE_CONTAINER_ID;
        toolbar.appendChild(deleteContainer);
        deleteRoot = createRoot(deleteContainer);
        deleteRoot.render(<DeleteAllButton />);

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: toolbar,
            options: { childList: true, subtree: true, attributes: true },
            callback: () => mountDeleteButton(),
            debounceDelay: 100,
        });
        observe();
        toolbarObserverDisconnect = disconnect;
    }

    function unmountDeleteButton() {
        deleteRoot?.unmount();
        deleteContainer?.remove();
        deleteRoot = null;
        deleteContainer = null;
    }

    return {
        apply() {
            const mutationCallback = () => {
                mountDeleteButton();
            };

            const { observe: bodyObserve, disconnect: bodyDisconnect } = observerManager.createDebouncedObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: mutationCallback,
                debounceDelay: 200,
            });

            bodyObserve();
            bodyObserverDisconnect = bodyDisconnect;

            mutationCallback();

            document.addEventListener("visibilitychange", mutationCallback);
        },
        remove() {
            toolbarObserverDisconnect?.();
            bodyObserverDisconnect?.();
            unmountDeleteButton();
            document.removeEventListener("visibilitychange", () => { });
            observerManager.disconnectAll();
        },
    };
})();

export default definePlugin({
    name: "Delete All Assets",
    description: "Adds a button to the files toolbar to delete all uploaded assets with confirmation.",
    authors: [Devs.Prism],
    category: "utility",
    tags: ["assets", "delete", "files"],
    patches: [deleteAllPatch],
});
