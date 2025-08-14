/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/logger";

const logger = new Logger("Storage", "#d3869b");

interface StorageItem<T> {
    value: T;
    expiresAt?: number;
}

class StorageAPI {
    private readonly storage: Storage;
    private readonly prefix: string;

    constructor(storage: Storage, prefix = "grokness") {
        this.storage = storage;
        this.prefix = prefix;
    }

    private getKey(key: string): string {
        return `${this.prefix}:${key}`;
    }

    get<T>(key: string): T | null {
        try {
            const item = this.storage.getItem(this.getKey(key));
            if (item === null) {
                return null;
            }
            const parsed = JSON.parse(item) as StorageItem<T>;
            if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
                this.remove(key);
                return null;
            }
            return parsed.value;
        } catch (e) {
            logger.error(`Failed to get item "${key}"`, e);
            return null;
        }
    }

    set<T>(key: string, value: T, ttlMs?: number): void {
        try {
            const item: StorageItem<T> = { value };
            if (ttlMs && ttlMs > 0) {
                item.expiresAt = Date.now() + ttlMs;
            }
            this.storage.setItem(this.getKey(key), JSON.stringify(item));
        } catch (e) {
            logger.error(`Failed to set item "${key}"`, e);
        }
    }

    remove(key: string): void {
        try {
            this.storage.removeItem(this.getKey(key));
        } catch (e) {
            logger.error(`Failed to remove item "${key}"`, e);
        }
    }

    clear(): void {
        try {
            for (let i = this.storage.length - 1; i >= 0; i--) {
                const key = this.storage.key(i);
                if (key?.startsWith(this.prefix + ":")) {
                    this.storage.removeItem(key);
                }
            }
        } catch (e) {
            logger.error("Failed to clear prefixed storage", e);
        }
    }
}

export const session = new StorageAPI(sessionStorage);
export const local = new StorageAPI(localStorage);
