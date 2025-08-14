/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { grokApi } from "@api/index";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@components/AlertDialog";
import { Button } from "@components/Button";
import { Toast, type ToastIntent, ToastProvider } from "@components/Toast";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/logger";
import definePlugin, { Patch } from "@utils/types";
import React, { useEffect, useRef, useState } from "react";

const logger = new Logger("DeleteAllAsset", "#a6e3a1");

interface ToastInfo {
    id: number;
    message: string;
    type: ToastIntent;
}

async function deleteInBatches(
    ids: ReadonlyArray<string>,
    signal?: AbortSignal
): Promise<void> {
    const size = 6;
    for (let i = 0; i < ids.length; i += size) {
        const slice = ids.slice(i, i + size);
        await Promise.all(
            slice.map(id =>
                grokApi.services.assets.delete({ assetId: id }, signal)
            )
        );
    }
}

const suppressAbortErrorsDuringReload = (delayMs = 50) => {
    const isBenign = (msg: string | undefined): boolean => {
        if (!msg) {
            return false;
        }
        const m = msg.toLowerCase();
        return (
            m.includes("networkerror") ||
            m.includes("the user aborted a request") ||
            m.includes("load failed")
        );
    };

    const onRejection = (e: PromiseRejectionEvent) => {
        const msg = (
            e.reason && (e.reason.message || String(e.reason))
        ) as string | undefined;
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
    const [toasts, setToasts] = useState<ToastInfo[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    const showToast = (message: string, type: ToastIntent) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    useEffect(
        () => () => {
            abortRef.current?.abort();
            abortRef.current = null;
        },
        []
    );

    const runDelete = async () => {
        if (loading) {
            return;
        }
        setLoading(true);
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        try {
            const assets = await grokApi.listAllAssets(
                { pageSize: 1000, source: "SOURCE_ANY", isLatest: true },
                ac.signal
            );
            const ids = assets
                .map(a => {
                    const x = a as unknown as {
                        id?: string;
                        assetId?: string;
                        rootAssetId?: string;
                    };
                    return x.id ?? x.assetId ?? x.rootAssetId;
                })
                .filter((v): v is string => typeof v === "string" && v.length > 0);

            if (ids.length > 0) {
                await deleteInBatches(ids, ac.signal);
                showToast(
                    `Successfully deleted ${ids.length} assets.`,
                    "success"
                );
                suppressAbortErrorsDuringReload(2000);
            } else {
                showToast("No assets found to delete.", "info");
            }
        } catch (err) {
            if (ac.signal.aborted) {
                logger.log("Asset deletion aborted by user.");
            } else {
                logger.error("Failed to delete assets:", err);
                showToast("An error occurred during deletion.", "error");
            }
        } finally {
            setLoading(false);
            setIsOpen(false);
            abortRef.current = null;
        }
    };

    return (
        <>
            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                        id="grok-delete-all"
                        variant="ghost"
                        size="sm"
                        icon={"Trash"}
                        iconSize={18}
                        aria-label="Delete All Assets"
                        className="w-8 h-8 px-1.5 py-1.5 rounded-xl text-fg-secondary border-transparent hover:text-red-400 dark:hover:text-red-300"
                        disableIconHover
                    />
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete all assets?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all uploaded assets from
                            the Files tab. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            color="danger"
                            onClick={runDelete}
                            disabled={loading}
                        >
                            {loading ? "Deleting..." : "Delete All"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div
                style={{
                    position: "fixed",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 10000,
                }}
            >
                <ToastProvider>
                    {toasts.map(toast => (
                        <Toast
                            key={toast.id}
                            open
                            onOpenChange={() =>
                                setToasts(prev =>
                                    prev.filter(t => t.id !== toast.id)
                                )
                            }
                            intent={toast.type}
                            message={toast.message}
                        />
                    ))}
                </ToastProvider>
            </div>
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

            const findButtonByPath = (
                root: HTMLElement,
                dContains: string
            ): HTMLButtonElement | null => {
                const paths = Array.from(
                    root.querySelectorAll("button svg path")
                );
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
                const hasIconSizedButtons = Array.from(
                    el.querySelectorAll("button")
                ).some(
                    b =>
                        b.classList.contains("w-8") &&
                        b.classList.contains("h-8")
                );
                const hasSearch = !!findButtonByPath(el, SEARCH_ICON_D);
                return hasIconSizedButtons && hasSearch;
            };

            const patch = Patch.ui({
                selector: "div.flex.gap-1",
                filter: (el: HTMLElement) => isIconToolbar(el),
            })
                .component(DeleteAllAssetsButton)
                .parent(el => el)
                .after(parent => {
                    const searchBtn = findButtonByPath(
                        parent as HTMLElement,
                        SEARCH_ICON_D
                    );
                    if (searchBtn) {
                        return searchBtn as unknown as HTMLElement;
                    }
                    const buttons = parent.querySelectorAll("button");
                    return (
                        (buttons[buttons.length - 1] as HTMLElement | null) ??
                        null
                    );
                })
                .debounce(50)
                .build();
            return Object.assign(patch, {
                disconnect: () => {
                    document
                        .querySelectorAll("#grok-delete-all")
                        .forEach(n => n.remove());
                },
            });
        })(),
    ],
});
