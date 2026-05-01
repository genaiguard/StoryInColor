/**
 * Payment-method brand logos rendered as inline SVG. Used on /credits
 * so visitors see Visa / Mastercard / Apple Pay / Google Pay as
 * recognisable brand chips above the SKU grid — Stripe published +32%
 * checkout conversion when buyer-reassurance imagery is present.
 *
 * All four are rendered into a uniform 48x30 (rx=4) chip so they line up
 * on a single baseline regardless of the underlying mark's aspect.
 *
 * Trademark note: these are nominative-fair-use representations of the
 * accepted payment methods, used to inform buyers — the same use Stripe
 * Checkout makes of them on its hosted page. Brand colours match each
 * brand's published guidelines (Visa #1A1F71, Mastercard #EB001B /
 * #F79E1B / #FF5F00, Apple monochrome, Google blue/red/yellow/green).
 *
 * The wordmarks for Visa / Apple Pay / Google Pay are rendered via SVG
 * <text> using the system sans-serif stack so we don't have to ship a
 * brand-specific webfont — close enough to the real wordmarks to be
 * unambiguously recognisable while keeping the SVG bundle small.
 */

import * as React from "react";

const CHIP_W = 48;
const CHIP_H = 30;
const RX = 4;

interface LogoProps {
  className?: string;
  /** Override the chip background. Default is white so the marks render
   *  correctly on a dark page background; pass `transparent` if you're
   *  embedding inside a light card and the white chip would clash. */
  background?: string;
}

/** Visa wordmark on a brand-blue chip. */
export function VisaLogo({ className, background = "white" }: LogoProps) {
  return (
    <svg
      viewBox={`0 0 ${CHIP_W} ${CHIP_H}`}
      className={className}
      role="img"
      aria-label="Visa"
    >
      <rect width={CHIP_W} height={CHIP_H} rx={RX} fill={background} />
      <rect
        x="2"
        y="2"
        width={CHIP_W - 4}
        height={CHIP_H - 4}
        rx={RX - 1}
        fill="#1A1F71"
      />
      <text
        x={CHIP_W / 2}
        y="21"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight={800}
        fontStyle="italic"
        fontSize="13"
        letterSpacing="1"
        fill="#fff"
      >
        VISA
      </text>
    </svg>
  );
}

/** Mastercard interlocking-circles mark. */
export function MastercardLogo({ className, background = "white" }: LogoProps) {
  return (
    <svg
      viewBox={`0 0 ${CHIP_W} ${CHIP_H}`}
      className={className}
      role="img"
      aria-label="Mastercard"
    >
      <rect width={CHIP_W} height={CHIP_H} rx={RX} fill={background} />
      {/* Left red circle */}
      <circle cx="20" cy="15" r="8" fill="#EB001B" />
      {/* Right yellow/orange circle */}
      <circle cx="28" cy="15" r="8" fill="#F79E1B" />
      {/* Lens-shaped overlap region — the iconic interlock colour */}
      <path
        d="M24,7.95 a8,8 0 0,1 0,14.1 a8,8 0 0,1 0,-14.1 z"
        fill="#FF5F00"
      />
    </svg>
  );
}

/** Apple Pay wordmark — Apple silhouette + "Pay". */
export function ApplePayLogo({ className, background = "white" }: LogoProps) {
  return (
    <svg
      viewBox={`0 0 ${CHIP_W} ${CHIP_H}`}
      className={className}
      role="img"
      aria-label="Apple Pay"
    >
      <rect width={CHIP_W} height={CHIP_H} rx={RX} fill={background} />
      {/* Apple silhouette path. Standard Apple logo glyph. */}
      <g transform="translate(8, 7) scale(0.65)" fill="#000">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </g>
      <text
        x="24"
        y="20"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight={600}
        fontSize="11"
        fill="#000"
      >
        Pay
      </text>
    </svg>
  );
}

/** Google Pay wordmark — multicolour "G" + "Pay". */
export function GooglePayLogo({ className, background = "white" }: LogoProps) {
  return (
    <svg
      viewBox={`0 0 ${CHIP_W} ${CHIP_H}`}
      className={className}
      role="img"
      aria-label="Google Pay"
    >
      <rect width={CHIP_W} height={CHIP_H} rx={RX} fill={background} />
      {/* Multicolour Google "G" mark — a circle with 4 brand-colour
          arcs, then a horizontal cut-out forming the bar of the G. */}
      <g transform="translate(7, 7)">
        {/* Four arcs forming the G ring (clockwise from top-right) */}
        <path
          d="M16,8 a8,8 0 1,1 -8,-8 v3 a5,5 0 1,0 4.95,5.5 H8 V8 z"
          fill="#4285F4"
        />
        <path
          d="M8,0 a8,8 0 0,1 5.66,2.34 l-2.12,2.12 A5,5 0 0,0 8,3 z"
          fill="#EA4335"
        />
        <path
          d="M13.66,2.34 a8,8 0 0,1 2.34,5.66 H13 a5,5 0 0,0 -1.46,-3.54 z"
          fill="#FBBC05"
        />
        <path
          d="M0,8 a8,8 0 0,1 8,-8 v3 a5,5 0 0,0 -5,5 z"
          fill="#34A853"
        />
      </g>
      <text
        x="25"
        y="20"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight={600}
        fontSize="11"
        fill="#5F6368"
      >
        Pay
      </text>
    </svg>
  );
}

/** Convenience: render all four chips inline at a common size. */
export function PaymentMethodChips({ className }: { className?: string }) {
  const chip =
    "h-7 w-auto sm:h-8 [box-shadow:0_1px_2px_rgba(0,0,0,0.08)] rounded";
  return (
    <div className={className ?? "flex items-center gap-2"}>
      <VisaLogo className={chip} />
      <MastercardLogo className={chip} />
      <ApplePayLogo className={chip} />
      <GooglePayLogo className={chip} />
    </div>
  );
}
