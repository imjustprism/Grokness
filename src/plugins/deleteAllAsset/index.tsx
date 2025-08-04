/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokAPI } from "@api/api";
import type { Asset } from "@api/interfaces";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import { type ElementFinderConfig, findElement, MutationObserverManager } from "@utils/dom";
import { Logger } from "@utils/logger";
import { definePlugin, type IPatch } from "@utils/types";
import React, { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = new Logger("DeleteAllAssets", "#ef4444");

const TOOLBAR_FINDER_CONFIG: ElementFinderConfig = {
    selector: "div.flex.gap-2",
    filter: (el: HTMLElement) => {
        const buttonTexts = Array.from(el.querySelectorAll("button")).map(btn => btn.textContent || "");
        const hasFilterButton = buttonTexts.some(text => text.includes("Filter"));
        const hasSortButton = buttonTexts.some(text => text.includes("Sort"));
        return hasFilterButton && hasSortButton;
    },
};

async function fetchAllAssets(): Promise<Asset[]> {
    try {
        let allAssets: Asset[] = [];
        let pageToken: string | undefined = undefined;
        do {
            const response = await grokAPI.assetRepository.listAssets({
                pageSize: 100,
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

const DeleteAllAssetsButton: React.FC = () => {
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
                if (assets.length > 0) {
                    await Promise.all(
                        assets.map(asset => grokAPI.assetRepository.deleteAsset({ assetId: asset.assetId }))
                    );
                }
            } catch (error) {
                logger.error("Failed to delete assets:", error);
            } finally {
                window.location.reload();
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
            onClick={handleClick}
            aria-label="Delete All Assets"
            className="h-8 px-3 text-xs flex-shrink-0"
            color={isConfirming ? "danger" : "default"}
            rounded={true}
            disableIconHover={true}
        >
            <span className="hidden @[160px]:inline-block">{isConfirming ? "Sure?" : "Delete All"}</span>
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
        const allButtons = Array.from(toolbar.querySelectorAll("button"));
        const sortButton = allButtons.find(btn => btn.textContent?.includes("Sort"));
        const referenceNode = sortButton ? sortButton.nextSibling : null;
        toolbar.insertBefore(container, referenceNode);
        const root = createRoot(container);
        root.render(<DeleteAllAssetsButton />);
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
                    const toolbar = findElement(TOOLBAR_FINDER_CONFIG);
                    if (toolbar && !roots.has(toolbar)) {
                        attachToToolbar(toolbar);
                    } else if (!toolbar && roots.size > 0) {
                        roots.forEach((_, el) => detachFromToolbar(el));
                    }
                },
            });
            observerDisconnect = disconnect;
            observe();
            const initialToolbar = findElement(TOOLBAR_FINDER_CONFIG);
            if (initialToolbar) {
                attachToToolbar(initialToolbar);
            }
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
