/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import { Button } from "@components/Button";
import { Modal } from "@components/Modal";
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
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    const runDelete = async () => {
        if (loading) {
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

    const handleClose = () => {
        if (!loading) {
            setIsOpen(false);
        }
    };

    return (
        <>
            <Button
                id="grok-delete-all"
                variant="ghost"
                size="sm"
                loading={false}
                icon={"Trash"}
                iconSize={18}
                onClick={() => setIsOpen(true)}
                aria-label="Delete All Assets"
                className="w-8 h-8 px-1.5 py-1.5 rounded-xl text-fg-secondary border-transparent"
                disableIconHover
            />
            <Modal
                isOpen={isOpen}
                onClose={handleClose}
                title="Delete all assets?"
                description="This will permanently delete all uploaded assets from the Files tab. This action cannot be undone."
                maxWidth="max-w-[480px]"
            >
                <Modal.Footer>
                    <Button
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        size="md"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="solid"
                        color="danger"
                        onClick={runDelete}
                        loading={loading}
                        icon={loading ? "Loader2" : "Trash"}
                        iconSize={18}
                        size="md"
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
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
            const SEARCH_ICON_D = "M17.5 17L20.5 20";

            const findButtonByPath = (root: HTMLElement, dContains: string): HTMLButtonElement | null => {
                const paths = Array.from(root.querySelectorAll("button svg path"));
                const needle = dContains.toLowerCase();
                for (const p of paths) {
                    const d = (p.getAttribute("d") || "").toLowerCase();
                    if (d.includes(needle)) {
                        const btn = p.closest("button");
                        if (btn instanceof HTMLButtonElement) {
                            return btn;
                        }
                    }
                }
                return null;
            };

            const isIconToolbar = (el: HTMLElement): boolean => {
                const hasIconSizedButtons = Array.from(el.querySelectorAll("button")).some(b => b.classList.contains("w-8") && b.classList.contains("h-8"));
                const hasSearch = !!findButtonByPath(el, SEARCH_ICON_D);
                return hasIconSizedButtons && hasSearch;
            };

            const patch = Patch.ui({
                selector: "div.flex.gap-1",
                filter: (el: HTMLElement) => isIconToolbar(el)
            })
                .component(DeleteAllAssetsButton)
                .parent(el => el)
                .after(parent => (
                    (() => {
                        const searchBtn = findButtonByPath(parent as HTMLElement, SEARCH_ICON_D);
                        if (searchBtn) {
                            return searchBtn as unknown as HTMLElement;
                        }
                        const buttons = parent.querySelectorAll("button");
                        return (buttons[buttons.length - 1] as HTMLElement | null) ?? null;
                    })()
                ))
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
