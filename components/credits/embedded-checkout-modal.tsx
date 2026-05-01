"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

/**
 * Modal wrapper around Stripe's Embedded Checkout. Replaces the previous
 * `stripe.redirectToCheckout()` flow on /credits — users now stay on
 * storyincolor.com throughout the purchase, with Stripe's prebuilt
 * payment form rendered in an iframe inside this dialog.
 *
 * Why a modal vs inline expansion: the SKU grid is the entry surface and
 * stays visible behind the dialog (subtle backdrop). The user can dismiss
 * the modal to switch packs without losing their place. Inline would
 * require collapsing/expanding the SKU grid mid-flow, which is jankier.
 *
 * Stripe's embedded checkout iframe is fully self-contained — it handles
 * Apple Pay / Google Pay / Link / card / 3DS challenges, error states,
 * and payment-method-specific UI. We only own the shell + lifecycle.
 *
 * Lifecycle:
 *   - clientSecret arrives → mount EmbeddedCheckoutProvider
 *   - User completes payment OR Stripe redirects for 3DS
 *   - On in-page success: onComplete fires → caller navigates to
 *     /dashboard?credit_purchase=success (the existing dashboard polling
 *     flow takes over: webhook lands the credit grant, the dashboard
 *     detects the new balance, fires the Pixel Purchase emit with the
 *     event_id stashed in localStorage by the caller pre-mount)
 *   - On 3DS redirect: Stripe sends user to the session's return_url
 *     which is the same /dashboard?credit_purchase=success URL, so the
 *     same dashboard pipeline catches them
 */

// Singleton Stripe instance — loadStripe must only be called once per
// page lifecycle. Re-creating it on each render produces a console
// warning and wastes the script-load round-trip.
let stripeSingleton: Promise<Stripe | null> | null = null;
function getStripeSingleton(publishableKey: string) {
  if (!stripeSingleton) {
    stripeSingleton = loadStripe(publishableKey);
  }
  return stripeSingleton;
}

export interface EmbeddedCheckoutModalProps {
  /** Stripe Checkout Session client secret returned by createCreditCheckout
   *  with `uiMode: "embedded"`. When non-null, the modal opens. */
  clientSecret: string | null;
  /** Stripe publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). */
  publishableKey: string;
  /** Called when Stripe's onComplete fires — typically a successful
   *  in-page payment. Use to navigate to the post-purchase URL. */
  onComplete: () => void;
  /** Called when the user dismisses the modal without completing
   *  payment (clicks X, hits ESC, clicks the backdrop). */
  onDismiss: () => void;
}

export function EmbeddedCheckoutModal({
  clientSecret,
  publishableKey,
  onComplete,
  onDismiss,
}: EmbeddedCheckoutModalProps) {
  const open = clientSecret !== null;
  const stripePromise = React.useMemo(
    () => getStripeSingleton(publishableKey),
    [publishableKey],
  );

  // Memoise the options object so EmbeddedCheckoutProvider doesn't
  // remount the iframe on every parent render. The ref dance keeps the
  // onComplete callback stable while still letting it reference fresh
  // closure values (e.g. the latest packageId for analytics).
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const options = React.useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => onCompleteRef.current(),
          }
        : null,
    [clientSecret],
  );

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 focus:outline-none sm:items-center sm:p-6"
          // The embedded checkout iframe contains its own focus
          // management — disable Radix's default auto-focus so we don't
          // fight it.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-[#0a0a0a] ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <DialogPrimitive.Title className="text-sm font-medium text-white">
                Complete your purchase
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Close checkout"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Stripe-hosted secure checkout, embedded in this page.
            </DialogPrimitive.Description>

            <div className="bg-white">
              {options ? (
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={options}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
