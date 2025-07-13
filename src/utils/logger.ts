/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export class Logger {
    /**
     * Returns the console format args for a title with the specified background colour and black text
     * @param color Background colour
     * @param title Text
     * @returns Array. Destructure this into {@link Logger}.errorCustomFmt or console.log
     */
    static makeTitle(color: string, title: string): [string, ...string[]] {
        return [
            "%c %c %s ",
            "",
            `background: ${color}; color: black; font-weight: bold; border-radius: 5px;`,
            title,
        ];
    }

    constructor(public name: string, public color: string = "white") { }

    private _log(
        level: "log" | "error" | "warn" | "info" | "debug",
        levelColor: string,
        args: unknown[],
        customFmt = ""
    ) {
        // eslint-disable-next-line no-console
        console[level](
            `%c Grokness %c %c ${this.name} ${customFmt}`,
            `background: ${levelColor}; color: black; font-weight: bold; border-radius: 5px;`,
            "",
            `background: ${this.color}; color: black; font-weight: bold; border-radius: 5px;`,
            ...args
        );
    }

    public log(...args: unknown[]) {
        this._log("log", "#a6d189", args);
    }

    public info(...args: unknown[]) {
        this._log("info", "#a6d189", args);
    }

    public error(...args: unknown[]) {
        this._log("error", "#e78284", args);
    }

    public errorCustomFmt(fmt: string, ...args: unknown[]) {
        this._log("error", "#e78284", args, fmt);
    }

    public warn(...args: unknown[]) {
        this._log("warn", "#e5c890", args);
    }

    public debug(...args: unknown[]) {
        this._log("debug", "#eebebe", args);
    }
}
