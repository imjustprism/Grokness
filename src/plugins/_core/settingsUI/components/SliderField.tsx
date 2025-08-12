/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RadixSlider from "@radix-ui/react-slider";
import clsx from "clsx";
import React, { useMemo } from "react";

export interface SliderFieldProps {
    /** Current value */
    value: number;
    /** Invoked when the value changes */
    onChange: (value: number) => void;
    /** Minimum value (inclusive) */
    min?: number;
    /** Maximum value (inclusive) */
    max?: number;
    /** Step for the slider */
    step?: number;
    /** Optional aria label */
    ariaLabel?: string;
    /** Additional classes */
    className?: string;
    /** Optional value suffix to display (e.g., px) */
    valueSuffix?: string;
}

export const SliderField: React.FC<SliderFieldProps> = ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    ariaLabel,
    className,
    valueSuffix,
}) => {
    const values = useMemo(() => [value], [value]);
    return (
        <div className={clsx("w-full flex items-center gap-3 select-none", className)}>
            <RadixSlider.Root
                value={values}
                min={min}
                max={max}
                step={step}
                aria-label={ariaLabel}
                onValueChange={([v]) => onChange(v ?? value)}
                className="relative flex items-center select-none touch-none h-5 w-full"
                orientation="horizontal"
            >
                <RadixSlider.Track className="relative h-[3px] w-full rounded-full bg-[#242426] ring-1 ring-border-l1">
                    <RadixSlider.Range className="absolute h-full rounded-full bg-white" />
                </RadixSlider.Track>
                <RadixSlider.Thumb className="block z-10 w-4 h-4 rounded-full bg-white border border-border-l1 shadow-sm outline-none select-none cursor-grab active:cursor-grabbing" />
            </RadixSlider.Root>
            <div className="min-w-14 text-right text-xs text-secondary select-none">
                {value}
                {valueSuffix}
            </div>
        </div>
    );
};
