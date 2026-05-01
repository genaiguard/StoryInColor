"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ZoomIn } from "lucide-react";

/**
 * Click-to-zoom image lightbox. Users land on /readings/<slug> and click
 * the sample-output image expecting it to enlarge — Clarity recorded 34
 * such clicks on the aura-reading page alone in 2.5 days, all dead.
 * Wrapping the sample image in this component turns those clicks into
 * a modal preview at the image's native resolution.
 *
 * Built on top of Radix Dialog primitives (already imported elsewhere as
 * components/ui/dialog.tsx). Renders a button-styled trigger so it's
 * keyboard-focusable, plus a fullscreen-ish dialog with the image
 * `object-contain`'d into the viewport.
 */
export function ImageLightbox({
  src,
  alt,
  triggerClassName,
  imgClassName,
  showZoomIcon = true,
  children,
}: {
  src: string;
  alt: string;
  /** Class applied to the <button> trigger. The trigger contains
   *  `children` so callers can render whatever inline image markup they
   *  want (e.g. a styled `<img>` matched to the surrounding card). */
  triggerClassName?: string;
  /** Class applied to the modal-content image. */
  imgClassName?: string;
  /** Show a small "click to zoom" icon overlaid in the top-right of the
   *  trigger as a visual affordance. Defaults to true. */
  showZoomIcon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        type="button"
        aria-label={`Open ${alt} at full size`}
        className={
          triggerClassName ??
          "group relative block w-full cursor-zoom-in overflow-hidden bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        }
      >
        {children}
        {showZoomIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-80 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <ZoomIn className="h-4 w-4" />
          </span>
        )}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={
              imgClassName ??
              "max-h-[92vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
            }
          />
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
