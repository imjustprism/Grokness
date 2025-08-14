/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RadixSlider from "@radix-ui/react-slider";
import clsx from "clsx";
import React from "react";

/**
 * @interface SliderProps
 * @property {number[]} [value] - The controlled value of the slider.
 * @property {number[]} [defaultValue] - The default value of the slider.
 * @property {(value: number[]) => void} [onValueChange] - Event handler called when the slider value changes.
 * @property {number} [min=0] - The minimum value of the slider.
 * @property {number} [max=100] - The maximum value of the slider.
 * @property {number} [step=1] - The step value of the slider.
 * @property {string} [className] - Additional class names for custom styling.
 * @property {string} [thumbClassName] - Additional class names for the slider thumb.
 */
export interface SliderProps {
    value?: number[];
    defaultValue?: number[];
    onValueChange?: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    thumbClassName?: string;
}

export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(
    (
        {
            value,
            defaultValue,
            onValueChange,
            min = 0,
            max = 100,
            step = 1,
            className,
            thumbClassName,
        },
        ref
    ) => (
        <RadixSlider.Root
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            min={min}
            max={max}
            step={step}
            className={clsx(
                "relative flex items-center select-none touch-none h-5 w-full",
                className
            )}
        >
            <RadixSlider.Track className="relative h-[3px] w-full rounded-full bg-[#242426] ring-1 ring-border-l1">
                <RadixSlider.Range className="absolute h-full rounded-full bg-white" />
            </RadixSlider.Track>
            <RadixSlider.Thumb
                className={clsx(
                    "block z-10 w-4 h-4 rounded-full bg-white border border-border-l1 shadow-sm outline-none select-none cursor-grab active:cursor-grabbing",
                    thumbClassName
                )}
            />
        </RadixSlider.Root>
    )
);

Slider.displayName = "Slider";
