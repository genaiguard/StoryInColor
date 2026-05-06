"use client";

/**
 * Editorial silhouettes for the upload screens. Apple Face ID minimalism —
 * single soft oval / single clean profile silhouette, gradient fades, no
 * cartoon features. The whole point is to communicate "front" vs "side"
 * at a glance without looking like a kid's drawing.
 */

export function FrontFaceSilhouette({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fr-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="fr-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft inner glow so the silhouette feels lit, not flat. */}
      <ellipse cx="100" cy="105" rx="58" ry="76" fill="url(#fr-glow)" />

      {/* Single oval head — that's the whole silhouette. */}
      <ellipse
        cx="100"
        cy="105"
        rx="58"
        ry="76"
        stroke="url(#fr-stroke)"
        strokeWidth="1.25"
      />

      {/* Two soft eye dots — that's it for facial features. */}
      <circle cx="80" cy="100" r="2" fill="currentColor" opacity="0.85" />
      <circle cx="120" cy="100" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function SideProfileSilhouette({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="sd-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/*
        Clean filled profile silhouette, facing right. Single closed path.
        Traces back-of-head → crown → forehead → brow → nose → upper lip →
        chin → under-jaw → neck. Gentle Bezier curves, no spurious features.
      */}
      <path
        d="
          M 70 220
          L 70 168
          C 56 152, 50 130, 50 102
          C 50 60, 78 32, 110 32
          C 138 32, 152 52, 152 80
          L 152 100
          L 156 108
          C 162 116, 162 124, 156 130
          L 150 134
          L 150 144
          C 150 150, 152 156, 150 162
          L 146 170
          C 144 178, 148 184, 150 192
          C 144 200, 132 206, 122 210
          L 110 218
          L 110 240
          L 70 240
          Z
        "
        fill="url(#sd-fill)"
        stroke="url(#sd-stroke)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />

      {/* Single eye notch — minimal acknowledgement. */}
      <circle cx="132" cy="86" r="1.6" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
