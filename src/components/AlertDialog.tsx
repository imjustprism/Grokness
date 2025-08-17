/*
 * Grokness, a grok.com browser extension mod
 * Copyright (c) 2025 Prism and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import * as RadixAlertDialog from "@radix-ui/react-alert-dialog";
import clsx from "clsx";
import React from "react";

/**
 * @props AlertDialogProps - The props for the AlertDialog component.
 * @props children - The content of the AlertDialog.
 */
const AlertDialog = RadixAlertDialog.Root;

/**
 * @props AlertDialogTriggerProps - The props for the AlertDialogTrigger component.
 * @props children - The content of the AlertDialogTrigger.
 */
const AlertDialogTrigger = RadixAlertDialog.Trigger;

/**
 * @props AlertDialogContentProps - The props for the AlertDialogContent component.
 * @props children - The content of the AlertDialogContent.
 */
const AlertDialogContent = React.forwardRef<
    React.ElementRef<typeof RadixAlertDialog.Content>,
    React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Content>
>(({ className, ...props }, ref) => (
    <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="fixed inset-0 bg-overlay backdrop-blur-[2px] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-[50000]" />
        <RadixAlertDialog.Content
            ref={ref}
            className={clsx(
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "w-[90vw] max-w-lg p-6",
                "bg-surface-base border border-border-l1 rounded-2xl shadow-lg",
                "z-[50001]",
                className
            )}
            {...props}
        />
    </RadixAlertDialog.Portal>
));
AlertDialogContent.displayName = RadixAlertDialog.Content.displayName;

/**
 * @props AlertDialogHeaderProps - The props for the AlertDialogHeader component.
 * @props children - The content of the AlertDialogHeader.
 */
const AlertDialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={clsx("flex flex-col space-y-2 text-center sm:text-left", className)}
        {...props}
    />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

/**
 * @props AlertDialogFooterProps - The props for the AlertDialogFooter component.
 * @props children - The content of the AlertDialogFooter.
 */
const AlertDialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={clsx("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)}
        {...props}
    />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

/**
 * @props AlertDialogTitleProps - The props for the AlertDialogTitle component.
 * @props children - The content of the AlertDialogTitle.
 */
const AlertDialogTitle = React.forwardRef<
    React.ElementRef<typeof RadixAlertDialog.Title>,
    React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Title>
>(({ className, ...props }, ref) => (
    <RadixAlertDialog.Title
        ref={ref}
        className={clsx("text-lg font-semibold", className)}
        {...props}
    />
));
AlertDialogTitle.displayName = RadixAlertDialog.Title.displayName;

/**
 * @props AlertDialogDescriptionProps - The props for the AlertDialogDescription component.
 * @props children - The content of the AlertDialogDescription.
 */
const AlertDialogDescription = React.forwardRef<
    React.ElementRef<typeof RadixAlertDialog.Description>,
    React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Description>
>(({ className, ...props }, ref) => (
    <RadixAlertDialog.Description
        ref={ref}
        className={clsx("text-sm text-secondary", className)}
        {...props}
    />
));
AlertDialogDescription.displayName = RadixAlertDialog.Description.displayName;

/**
 * @props AlertDialogActionProps - The props for the AlertDialogAction component.
 * @props children - The content of the AlertDialogAction.
 */
const AlertDialogAction = React.forwardRef<
    React.ElementRef<typeof Button>,
    React.ComponentPropsWithoutRef<typeof Button>
>(({ ...props }, ref) => (
    <RadixAlertDialog.Action asChild>
        <Button ref={ref} {...props} />
    </RadixAlertDialog.Action>
));
AlertDialogAction.displayName = "AlertDialogAction";

/**
 * @props AlertDialogCancelProps - The props for the AlertDialogCancel component.
 * @props children - The content of the AlertDialogCancel.
 */
const AlertDialogCancel = React.forwardRef<
    React.ElementRef<typeof Button>,
    React.ComponentPropsWithoutRef<typeof Button>
>(({ ...props }, ref) => (
    <RadixAlertDialog.Cancel asChild>
        <Button ref={ref} variant="outline" {...props} />
    </RadixAlertDialog.Cancel>
));
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
};
