/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import styles from "@plugins/screenCleaner/styles.css?raw";
import { Devs } from "@utils/constants";
import { createDomElementHider } from "@utils/dom";
import { LOCATORS } from "@utils/locators";
import definePlugin, { definePluginSettings, onPluginSettingsUpdated } from "@utils/types";
import { useEffect } from "react";

const settings = definePluginSettings({
    hideScreensaver: {
        type: "boolean",
        displayName: "Hide Screensaver and Sparkle Effects",
        description: "Hide the idle screensaver and sparkle effects.",
        default: true,
    },
});

const ScreenCleaner: React.FC = () => {
    useEffect(() => {
        const hider = createDomElementHider(document.body, [
            {
                selector: LOCATORS.EFFECTS.idleSparklesContainer.selector,
                description: "Idle sparkle effects",
                condition: () => settings.store.hideScreensaver,
            },
        ]);

        hider.hideImmediately();
        hider.startObserving();

        const off = onPluginSettingsUpdated("screen-cleaner", () => hider.hideImmediately());

        return () => {
            hider.stopObserving();
            off();
        };
    }, []);

    return null;
};

export default definePlugin({
    name: "Screen Cleaner",
    description: "Eliminates distracting elements for a cleaner experience.",
    authors: [Devs.Prism],
    category: "appearance",
    tags: ["hide", "cleaner", "screensaver"],
    enabledByDefault: true,
    styles,
    settings,
    ui: {
        component: ScreenCleaner,
        target: "body",
    },
});
