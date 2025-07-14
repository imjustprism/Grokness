/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { Asset } from "@api/interfaces";
import { Button } from "@components/Button";
import { LucideIcon } from "@components/LucideIcon";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Devs } from "@utils/constants";
import { type ElementFinderConfig, findElement, MutationObserverManager } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import { clsx } from "clsx";
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

    const icon = isLoading ? (
        <LucideIcon name="Loader2" size={16} className="animate-spin text-fg-secondary" />
    ) : (
        <LucideIcon
            name="Trash2"
            size={16}
            className={clsx(
                "transition-colors duration-100",
                isConfirming ? "text-fg-danger group-hover:text-fg-danger" : "text-fg-secondary group-hover:text-fg-primary"
            )}
        />
    );

    return (
        <Tooltip.Provider>
            <Tooltip.Root delayDuration={600} disableHoverableContent={true}>
                <Tooltip.Trigger asChild>
                    <Button
                        id="grok-delete-all"
                        as="button"
                        variant="outline"
                        size="sm"
                        icon={icon}
                        iconPosition="left"
                        disabled={isLoading}
                        onClick={handleClick}
                        aria-label="Delete All Assets"
                        className="h-8 px-3 text-xs flex-shrink-0"
                        style={{ boxShadow: "none" }}
                        rounded={true}
                        color={isConfirming ? "danger" : "default"}
                    >
                        <span className="sr-only">Delete All Assets</span>
                        <span className="hidden @[160px]:inline-block">{isConfirming ? "Confirm" : "Delete All"}</span>
                    </Button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        side="bottom"
                        sideOffset={8}
                        className="z-50 overflow-hidden rounded-md shadow-sm dark:shadow-none px-3 py-1.5 text-xs pointer-events-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-primary text-background"
                    >
                        {isConfirming ? "Are you sure? Click again to confirm" : "Delete All Assets"}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
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

        const sortButton = toolbar.querySelector('button[aria-haspopup="menu"]:has(svg.lucide-arrow-down-narrow-wide)') as HTMLElement | null;
        if (!sortButton) {
            return;
        }

        deleteContainer = document.createElement("div");
        deleteContainer.id = DELETE_CONTAINER_ID;
        deleteContainer.style.display = "none";
        sortButton.after(deleteContainer);
        deleteRoot = createRoot(deleteContainer);
        deleteRoot.render(<DeleteAllButton />);

        requestAnimationFrame(() => {
            if (deleteContainer) {
                deleteContainer.style.display = "";
            }
        });

        const { observe, disconnect } = observerManager.createDebouncedObserver({
            target: toolbar,
            options: { childList: true, subtree: true, attributes: true },
            callback: () => mountDeleteButton(),
            debounceDelay: 50,
            useRaf: true,
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
                debounceDelay: 50,
                useRaf: true,
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
