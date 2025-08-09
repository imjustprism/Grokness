/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeSearchField } from "@plugins/betterCodeBlock/components/CodeSearchField";
import styles from "@plugins/betterCodeBlock/styles.css?raw";
import { Devs } from "@utils/constants";
import { querySelector } from "@utils/dom";
import { definePlugin, type IPluginUIPatch } from "@utils/types";
import React from "react";

const CODE_BLOCK_SELECTOR = "div.relative.not-prose.\\@container\\/code-block";
const BUTTONS_CONTAINER_SELECTOR = "div.absolute.bottom-1.right-1.flex.flex-row.gap-0\\.5";

const patch: IPluginUIPatch = {
    component: () => <CodeSearchField />,
    target: CODE_BLOCK_SELECTOR,
    forEach: true,
    getTargetParent: el => querySelector(BUTTONS_CONTAINER_SELECTOR, el) ?? el,
    referenceNode: parent => parent.lastChild,
};

export default definePlugin({
    name: "Better Code Block",
    description: "Adds a search field to all code blocks.",
    authors: [Devs.Prism],
    category: "chat",
    tags: ["code", "search", "highlight"],
    styles,
    patches: [patch],
});
