"use client";

/**
 * Editorial line-art face silhouettes used on the upload screens to make
 * the front/side distinction immediately legible without reading the
 * headline. Per founder direction: "you may wanna render some SVG image
 * in there of a front facial / side picture."
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
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Head outline — soft oval with tapered jaw */}
      <path d="M 100 28 C 62 28, 36 62, 36 112 C 36 156, 56 198, 100 215 C 144 198, 164 156, 164 112 C 164 62, 138 28, 100 28 Z" />

      {/* Hairline hint */}
      <path
        d="M 56 72 C 78 52, 122 52, 144 72"
        opacity="0.35"
      />

      {/* Brows */}
      <path d="M 64 96 C 72 92, 86 92, 92 96" opacity="0.5" />
      <path d="M 108 96 C 114 92, 128 92, 136 96" opacity="0.5" />

      {/* Eyes — almond curves with subtle inner detail */}
      <path d="M 64 110 C 72 104, 88 104, 94 110 C 88 116, 72 116, 64 110 Z" />
      <path d="M 106 110 C 112 104, 128 104, 136 110 C 128 116, 112 116, 106 110 Z" />

      {/* Nose bridge to nostrils */}
      <path d="M 100 122 C 96 144, 94 156, 100 162" />
      <path d="M 92 162 C 96 166, 104 166, 108 162" opacity="0.6" />

      {/* Mouth */}
      <path d="M 86 184 C 94 188, 106 188, 114 184" />

      {/* Faint chin curve for depth */}
      <path d="M 78 200 C 88 208, 112 208, 122 200" opacity="0.3" />
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
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/*
        Right-facing profile. Single continuous stroke traces:
        crown → forehead → brow → nose bridge → nose tip → philtrum →
        upper lip → mouth → lower lip → under-lip dip → chin →
        under-jaw → neck.
      */}
      <path
        d="
          M 50 80
          C 46 50, 70 22, 110 24
          C 142 26, 156 48, 156 78
          C 156 88, 152 96, 150 102
          C 158 110, 168 122, 168 132
          C 168 138, 162 142, 154 142
          C 152 150, 156 156, 152 162
          C 148 168, 152 174, 148 180
          C 144 186, 152 194, 152 204
          C 144 208, 124 210, 110 212
          L 96 218
        "
      />

      {/* Back of head + nape */}
      <path
        d="
          M 50 80
          C 38 100, 38 140, 56 168
          C 64 178, 78 192, 88 200
          L 88 220
        "
        opacity="0.85"
      />

      {/* Hairline at the top */}
      <path
        d="M 70 38 C 90 28, 120 26, 142 36"
        opacity="0.35"
      />

      {/* Brow line */}
      <path d="M 132 76 L 154 78" opacity="0.5" />

      {/* Eye in profile — almond, smaller than front view */}
      <path d="M 132 88 C 138 84, 148 84, 152 88 C 148 92, 138 92, 132 88 Z" />

      {/* Ear suggestion */}
      <path
        d="M 90 122 C 84 124, 80 134, 84 144 C 88 150, 96 150, 98 142"
        opacity="0.5"
      />

      {/* Mouth notch */}
      <path d="M 144 158 L 152 158" opacity="0.5" />
    </svg>
  );
}
