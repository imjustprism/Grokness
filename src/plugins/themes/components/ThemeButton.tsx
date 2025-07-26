/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LucideIcon } from "@components/LucideIcon";
import React, { type ButtonHTMLAttributes, forwardRef, type Ref } from "react";

interface ThemeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    name: string;
    description: string;
    isSelected: boolean;
    onClick: () => void;
    baseClassName?: string;
    selectedClassName?: string;
    nameClassName?: string;
    descriptionClassName?: string;
    checkIconClassName?: string;
}

export const ThemeButton = forwardRef<HTMLButtonElement, ThemeButtonProps>(
    ({
        name,
        description,
        isSelected,
        onClick,
        baseClassName = "whitespace-nowrap text-sm font-medium leading-[normal] cursor-pointer focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--color-card-border-focus)] disabled:opacity-[var(--opacity-disabled)] disabled:cursor-not-allowed transition duration-[var(--transition-duration)] ease-[var(--transition-timing)] [&_svg]:shrink-0 select-none flex items-center justify-start gap-1 text-wrap text-start w-full rounded-2xl flex-row p-3 group border border-solid border-[var(--color-toggle-border)] hover:border-[var(--color-card-border-focus)] hover:bg-[var(--color-card-hover)] text-[var(--color-primary)] relative min-h-16",
        selectedClassName = isSelected ? "bg-[var(--color-button-ghost-hover)] pr-4" : "pr-8",
        nameClassName = "text-sm text-[var(--color-primary)]",
        descriptionClassName = "text-xs text-[var(--color-secondary)]",
        checkIconClassName = "size-4 text-[var(--color-secondary)]",
        ...props
    }, ref: Ref<HTMLButtonElement>) => (
        <button
            ref={ref}
            className={`${baseClassName} ${selectedClassName}`}
            onClick={onClick}
            type="button"
            aria-pressed={isSelected}
            {...props}
        >
            <div className="w-full">
                <p className={nameClassName}>{name}</p>
                <p className={descriptionClassName}>{description}</p>
            </div>
            {isSelected && (
                <LucideIcon
                    name="Check"
                    className={checkIconClassName}
                    aria-hidden="true"
                />
            )}
        </button>
    )
);

ThemeButton.displayName = "ThemeButton";
