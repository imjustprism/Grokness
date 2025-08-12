/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import definePlugin, { Patch } from "@utils/types";
import React, { useEffect, useRef, useState } from "react";

async function deleteInBatches(ids: ReadonlyArray<string>, signal?: AbortSignal): Promise<void> {
    const size = 6;
    for (let i = 0; i < ids.length; i += size) {
        const slice = ids.slice(i, i + size);
        await Promise.all(slice.map(id => grokApi.services.assets.delete({ assetId: id }, signal)));
    }
}

const suppressAbortErrorsDuringReload = (delayMs: number = 50) => {
    const isBenign = (msg: string | undefined): boolean => {
        if (!msg) {
            return false;
        }
        const m = msg.toLowerCase();
        return m.includes("networkerror") || m.includes("the user aborted a request") || m.includes("load failed");
    };

    const onRejection = (e: PromiseRejectionEvent) => {
        const msg = (e.reason && (e.reason.message || String(e.reason))) as string | undefined;
        if (isBenign(msg)) {
            e.preventDefault();
        }
    };

    const onError = (e: ErrorEvent) => {
        if (isBenign(e.message)) {
            e.preventDefault();
        }
    };

    window.addEventListener("unhandledrejection", onRejection, true);
    window.addEventListener("error", onError, true);

    window.setTimeout(() => {
        window.removeEventListener("unhandledrejection", onRejection, true);
        window.removeEventListener("error", onError, true);
        window.location.reload();
    }, delayMs);
};

const DeleteAllAssetsButton: React.FC = () => {
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!confirming) {
            return;
        }
        const t = setTimeout(() => setConfirming(false), 5000);
        return () => clearTimeout(t);
    }, [confirming]);

    useEffect(() => () => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    const onClick = async () => {
        if (loading) {
            return;
        }
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setLoading(true);
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        try {
            const assets = await grokApi.listAllAssets({ pageSize: 100, source: "SOURCE_ANY", isLatest: true }, ac.signal);
            const ids = assets
                .map(a => {
                    const x = a as unknown as { id?: string; assetId?: string; rootAssetId?: string; };
                    return x.id ?? x.assetId ?? x.rootAssetId;
                })
                .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
            if (ids.length > 0) {
                await deleteInBatches(ids, ac.signal);
            }
        } finally {
            suppressAbortErrorsDuringReload(80);
        }
    };

    return (
        <Button
            id="grok-delete-all"
            variant="outline"
            size="sm"
            loading={loading}
            icon={loading ? "Loader2" : "Trash"}
            iconSize={15}
            onClick={onClick}
            aria-label="Delete All Assets"
            className="h-8 px-3 text-xs flex-shrink-0"
            color={confirming ? "danger" : "default"}
            rounded
            disableIconHover
            disabled={loading}
            tooltip={loading ? "Deleting…" : confirming ? "Click again to confirm" : "Delete all uploaded assets"}
        >
            <span className="hidden @[160px]:inline-block">{confirming ? "Sure?" : "Delete All"}</span>
        </Button>
    );
};

export default definePlugin({
    name: "Delete All Assets",
    description: "Adds a button to the files to delete all uploaded assets.",
    authors: [Devs.Prism],
    category: "utility",
    tags: ["assets", "delete", "files"],
    patches: [
        (() => {
            const patch = Patch.ui({
                selector: "div.flex.gap-2",
                filter: (el: HTMLElement) => {
                    const buttons = Array.from(el.querySelectorAll("button"));
                    const hasFilter = buttons.some(b => /filter/i.test(b.textContent ?? ""));
                    const hasSort = buttons.some(b => /sort/i.test(b.textContent ?? ""));
                    return hasFilter && hasSort;
                }
            })
                .component(DeleteAllAssetsButton)
                .parent(el => el)
                .after(parent => {
                    const buttons = Array.from(parent.querySelectorAll("button"));
                    return buttons.find(b => b.textContent?.includes("Sort")) ?? null;
                })
                .debounce(50)
                .build();
            return Object.assign(patch, {
                disconnect: () => {
                    document.querySelectorAll("#grok-delete-all").forEach(n => n.remove());
                }
            });
        })()
    ]
});
