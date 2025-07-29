/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { Asset } from "@api/interfaces";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import { type ElementFinderConfig, MutationObserverManager, querySelectorAll } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("DeleteAllAssets", "#ef4444");

const TOOLBAR_FINDER_CONFIG: ElementFinderConfig = {
    selector: "div.flex.gap-2.overflow-x-auto.no-scrollbar.h-subheader-height.items-center",
    filter: el =>
        !!el.querySelector('button[aria-haspopup="menu"] svg path[d="M3 7L21 7"]') &&
        !!el.querySelector('button[aria-haspopup="menu"] svg.lucide-arrow-down-narrow-wide'),
};

async function fetchAllAssets(): Promise<Asset[]> {
    try {
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
    } catch (error) {
        logger.error("Failed to fetch all assets:", error);
        throw error;
    }
}

const DeleteAllButton: React.FC = () => {
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
                    setIsConfirming(false);
                    return;
                }
                await Promise.all(
                    assets.map(asset => grokAPI.assetRepository.deleteAsset({ assetId: asset.assetId }))
                );
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
        <Button
            id="grok-delete-all"
            variant="outline"
            size="sm"
            loading={isLoading}
            icon={isLoading ? "Loader2" : "Trash"}
            iconSize={15}
            iconPosition="left"
            disabled={isLoading}
            onClick={handleClick}
            aria-label="Delete All Assets"
            className="h-8 px-3 text-xs flex-shrink-0"
            style={{ boxShadow: "none" }}
            rounded={true}
            color={isConfirming ? "danger" : "default"}
            tooltip={isConfirming ? "Are you sure? Click again to confirm" : "Delete All Assets"}
        >
            <span className="sr-only">Delete All Assets</span>
            <span className="hidden @[160px]:inline-block">{isConfirming ? "Confirm" : "Delete All"}</span>
        </Button>
    );
};

const deleteAllPatch: IPatch = (() => {
    const roots = new Map<HTMLElement, Root>();
    const observerManager = new MutationObserverManager();
    let observerDisconnect: (() => void) | null = null;

    const attachToToolbar = (toolbar: HTMLElement) => {
        if (toolbar.querySelector("#grok-delete-all-container")) {
            return;
        }

        const container = document.createElement("div");
        container.id = "grok-delete-all-container";

        const referenceNode = (() => {
            const buttons = toolbar.querySelectorAll('button[aria-haspopup="menu"]');
            for (const btn of buttons) {
                if (btn.querySelector("svg.lucide-arrow-down-narrow-wide")) {
                    return btn.nextSibling;
                }
            }
            return null;
        })();

        toolbar.insertBefore(container, referenceNode);

        const root = createRoot(container);
        root.render(<DeleteAllButton />);
        roots.set(toolbar, root);
    };

    const detachFromToolbar = (toolbar: HTMLElement) => {
        const root = roots.get(toolbar);
        if (root) {
            root.unmount();
            roots.delete(toolbar);
            toolbar.querySelector("#grok-delete-all-container")?.remove();
        }
    };

    return {
        apply() {
            const { observe, disconnect } = observerManager.createObserver({
                target: document.body,
                options: { childList: true, subtree: true },
                callback: () => {
                    const toolbars = querySelectorAll(TOOLBAR_FINDER_CONFIG.selector).filter(el => TOOLBAR_FINDER_CONFIG.filter?.(el));
                    const currentToolbars = new Set(toolbars);

                    currentToolbars.forEach(toolbar => {
                        if (!roots.has(toolbar)) {
                            attachToToolbar(toolbar);
                        }
                    });

                    roots.forEach((_, toolbar) => {
                        if (!currentToolbars.has(toolbar)) {
                            detachFromToolbar(toolbar);
                        }
                    });
                },
            });

            observerDisconnect = disconnect;
            observe();

            const initialToolbars = querySelectorAll(TOOLBAR_FINDER_CONFIG.selector).filter(el => TOOLBAR_FINDER_CONFIG.filter?.(el));
            initialToolbars.forEach(attachToToolbar);
        },
        remove() {
            observerDisconnect?.();
            roots.forEach((_, toolbar) => detachFromToolbar(toolbar));
            roots.clear();
        },
    };
})();

export default definePlugin({
    name: "Delete All Assets",
    description: "Adds a button to the files to delete all uploaded assets.",
    authors: [Devs.Prism],
    category: "utility",
    tags: ["assets", "delete", "files"],
    patches: [deleteAllPatch],
});
