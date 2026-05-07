"use client";

import type { FaceShape } from "@/lib/hair-analysis/types";

const SHAPE_DESCRIPTORS: Record<FaceShape, string> = {
  oval: "Most versatile face shape — almost any style works.",
  round: "Styles that add height and length flatter best.",
  square: "Soft layers and side parts balance a strong jaw.",
  heart: "Volume at the jaw offsets a wide forehead.",
  oblong: "Width at the sides balances a long face.",
};

function OvalPath() {
  return <ellipse cx="60" cy="70" rx="38" ry="52" />;
}

function RoundPath() {
  return <ellipse cx="60" cy="70" rx="44" ry="44" />;
}

function SquarePath() {
  return (
    <path d="M22,30 Q22,22 30,22 L90,22 Q98,22 98,30 L98,110 Q98,118 90,118 L30,118 Q22,118 22,110 Z" />
  );
}

function HeartPath() {
  return (
    <path d="M60,118 Q20,90 18,60 Q16,30 40,24 Q52,20 60,34 Q68,20 80,24 Q104,30 102,60 Q100,90 60,118 Z" />
  );
}

function OblongPath() {
  return <ellipse cx="60" cy="70" rx="30" ry="58" />;
}

const SHAPE_PATHS: Record<FaceShape, () => React.ReactElement> = {
  oval: OvalPath,
  round: RoundPath,
  square: SquarePath,
  heart: HeartPath,
  oblong: OblongPath,
};

export function FaceShapeSVG({
  shape,
  size = 80,
}: {
  shape: FaceShape;
  size?: number;
}) {
  const PathComponent = SHAPE_PATHS[shape];
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={Math.round(size * 1.2)}
        viewBox="0 0 120 140"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.5"
        aria-label={`${shape} face shape`}
      >
        <PathComponent />
      </svg>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
          Face shape detected
        </p>
        <p className="mt-0.5 text-base font-light capitalize text-white/90">
          {shape}
        </p>
        <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-white/45">
          {SHAPE_DESCRIPTORS[shape]}
        </p>
      </div>
    </div>
  );
}
