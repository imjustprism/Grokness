/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PatchType = "before" | "after" | "instead";

export interface PatchOptions {
    type: PatchType;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    module: any;
    method: string;
    callback: Function;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Patcher = {
    before(module: any, method: string, callback: (thisArg: any, args: any[]) => any) {
        const original = module[method];
        module[method] = function (...args: any[]) {
            const result = callback(this, args);
            if (result !== undefined) {
                args = result;
            }
            return original.apply(this, args);
        };
        return () => {
            module[method] = original;
        };
    },
    after(module: any, method: string, callback: (thisArg: any, args: any[], returnValue: any) => any) {
        const original = module[method];
        module[method] = function (...args: any[]) {
            let returnValue = original.apply(this, args);
            const result = callback(this, args, returnValue);
            if (result !== undefined) {
                returnValue = result;
            }
            return returnValue;
        };
        return () => {
            module[method] = original;
        };
    },
    instead(module: any, method: string, callback: (thisArg: any, args: any[], original: Function) => any) {
        const original = module[method];
        module[method] = function (...args: any[]) {
            return callback(this, args, original.bind(this));
        };
        return () => {
            module[method] = original;
        };
    },
};
