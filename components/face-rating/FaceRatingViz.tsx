"use client";

/**
 * Editorial visualization primitives for the face-rating result page.
 *
 * Used by both PreviewView (free, with strategic masking) and FullReportView
 * (paid, fully revealed). Same components, different `reveal` prop.
 */

import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";
import {
  SUB_SCORE_KEYS,
  SUB_SCORE_LABELS,
  type SubScoreKey,
} from "@/lib/face-rating/types";

/* ------------------------------------------------------------------ */
/* Score color helpers                                                  */
/* ------------------------------------------------------------------ */

export function scoreToneFor(score: number): "high" | "mid-high" | "mid" | "low" {
  if (score >= 8.0) return "high";
  if (score >= 6.5) return "mid-high";
  if (score >= 5.0) return "mid";
  return "low";
}

export function scoreColorClass(score: number): string {
  const t = scoreToneFor(score);
  if (t === "high") return "text-emerald-300";
  if (t === "mid-high") return "text-white";
  if (t === "mid") return "text-amber-200";
  return "text-rose-300";
}

export function scoreBarClass(score: number): string {
  const t = scoreToneFor(score);
  if (t === "high") return "bg-emerald-300";
  if (t === "mid-high") return "bg-white/85";
  if (t === "mid") return "bg-amber-200";
  return "bg-rose-300";
}

/* ------------------------------------------------------------------ */
/* AnimatedScore — count-up reveal                                      */
/* ------------------------------------------------------------------ */

export function AnimatedScore({
  value,
  size = "lg",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const dur = 1100;
    const target = Math.max(0, Math.min(10, value));
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(eased * target);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const tone = scoreColorClass(value);
  const sizeCls =
    size === "sm"
      ? "text-4xl"
      : size === "md"
        ? "text-6xl"
        : "text-7xl md:text-8xl";
  const slashCls =
    size === "sm" ? "text-base" : size === "md" ? "text-2xl" : "text-3xl";
  return (
    <div className="flex items-baseline justify-center font-light leading-none tracking-tight">
      <span className={`${sizeCls} tabular-nums ${tone}`}>
        {display.toFixed(1)}
      </span>
      <span className={`${slashCls} text-white/35`}>/10</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BellCurve — distribution curve with user's position marker           */
/* ------------------------------------------------------------------ */

export function BellCurve({
  value,
  height = 110,
}: {
  value: number;
  height?: number;
}) {
  // Standard normal-ish curve from x=0..10. We use a smooth shape
  // peaking at 6.5 (the "average attractive" anchor per system prompt).
  const W = 320;
  const H = height;
  const peak = 6.5;
  const sigma = 1.6;

  function curveY(x: number): number {
    // Gaussian
    return Math.exp(-Math.pow(x - peak, 2) / (2 * sigma * sigma));
  }

  // Build smooth path
  const points: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * 10;
    const y = curveY(x);
    const px = (x / 10) * W;
    const py = H - 16 - y * (H - 24);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const top = points.join(" L ");
  const userPx = (Math.max(0, Math.min(10, value)) / 10) * W;
  const userPy = H - 16 - curveY(value) * (H - 24);
  const tone = scoreColorClass(value);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={`You scored ${value.toFixed(1)} out of 10 — distribution chart.`}
    >
      <defs>
        <linearGradient id="bell-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Filled curve */}
      <path
        d={`M 0,${H - 16} L ${top} L ${W},${H - 16} Z`}
        fill="url(#bell-fill)"
      />
      {/* Curve outline */}
      <path
        d={`M ${top}`}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1"
      />
      {/* Baseline */}
      <line
        x1="0"
        y1={H - 16}
        x2={W}
        y2={H - 16}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      {/* User marker line */}
      <line
        x1={userPx}
        y1={H - 16}
        x2={userPx}
        y2={userPy - 6}
        stroke="currentColor"
        strokeWidth="1.5"
        className={tone}
      />
      {/* User dot */}
      <circle
        cx={userPx}
        cy={userPy - 6}
        r="4"
        fill="currentColor"
        className={tone}
      />
      {/* Tick labels */}
      {[0, 5, 10].map((t) => (
        <text
          key={t}
          x={(t / 10) * W}
          y={H - 4}
          fill="rgba(255,255,255,0.35)"
          fontSize="9"
          textAnchor={t === 0 ? "start" : t === 10 ? "end" : "middle"}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {t}
        </text>
      ))}
      {/* Average label */}
      <text
        x={(peak / 10) * W}
        y={H - 4}
        fill="rgba(255,255,255,0.35)"
        fontSize="9"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        avg
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* SubScoreCard — used in the grid                                      */
/* ------------------------------------------------------------------ */

export function SubScoreCard({
  feature,
  score,
  reveal,
}: {
  feature: SubScoreKey;
  score: number;
  reveal: boolean;
}) {
  const label = SUB_SCORE_LABELS[feature];
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const barTone = scoreBarClass(score);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] uppercase tracking-[0.14em] text-white/65">
          {label}
        </span>
        {reveal ? (
          <span
            className={`text-lg font-light tabular-nums ${scoreColorClass(score)}`}
          >
            {score.toFixed(1)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-white/30">
            <Lock className="h-3 w-3" />
            <span
              className="text-lg font-light tabular-nums select-none blur-[6px]"
              aria-hidden="true"
            >
              {score.toFixed(1)}
            </span>
          </span>
        )}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barTone} ${
            reveal ? "" : "opacity-40"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SubScoreGrid({
  scores,
  reveal,
  revealedKeys,
}: {
  scores: Record<string, number>;
  /** Master switch: if true, all 8 sub-scores are revealed regardless. */
  reveal: boolean;
  /** Optional partial-reveal mode (used in the preview): only these keys
   *  show their numeric value; the rest are blurred. Ignored when reveal
   *  is true. */
  revealedKeys?: SubScoreKey[];
}) {
  const allow = (k: SubScoreKey) =>
    reveal || (revealedKeys?.includes(k) ?? false);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {SUB_SCORE_KEYS.map((k) => (
        <SubScoreCard
          key={k}
          feature={k}
          score={scores?.[k] ?? 0}
          reveal={allow(k)}
        />
      ))}
    </div>
  );
}

/** Pick the top N sub-score keys by score for partial reveal in the preview. */
export function topSubScoreKeys(
  scores: Record<string, number> | undefined,
  n: number = 3,
): SubScoreKey[] {
  if (!scores) return [];
  return SUB_SCORE_KEYS.slice()
    .filter((k) => typeof scores[k] === "number")
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, n);
}

/* ------------------------------------------------------------------ */
/* MaskedText — partially-revealed text ("H█████ C█████")              */
/* ------------------------------------------------------------------ */

export function MaskedText({
  text,
  reveal,
  visibleChars = 1,
}: {
  text: string;
  reveal: boolean;
  /** How many characters at the start of each word remain visible. */
  visibleChars?: number;
}) {
  if (reveal) return <>{text}</>;
  const masked = text
    .split(" ")
    .map((word) => {
      if (word.length <= visibleChars) return word;
      const head = word.slice(0, visibleChars);
      const tail = "█".repeat(Math.max(2, word.length - visibleChars));
      return `${head}${tail}`;
    })
    .join(" ");
  return <span aria-label="Locked content">{masked}</span>;
}

/* ------------------------------------------------------------------ */
/* BlurredBlock — visual blur over text content                         */
/* ------------------------------------------------------------------ */

export function BlurredBlock({
  children,
  reveal,
  intensity = 6,
}: {
  children: React.ReactNode;
  reveal: boolean;
  intensity?: number;
}) {
  if (reveal) return <>{children}</>;
  return (
    <span
      aria-hidden="true"
      className="select-none"
      style={{ filter: `blur(${intensity}px)` }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SectionHeader — consistent across the report                         */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  eyebrow,
  title,
  count,
  locked = false,
}: {
  eyebrow?: string;
  title: string;
  count?: string;
  locked?: boolean;
}) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
          {eyebrow}
        </p>
      )}
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-light tracking-tight md:text-2xl">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {count && (
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
              {count}
            </span>
          )}
          {locked && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/45"
              title="Available in the full reading"
            >
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LockedRow — for areas-for-growth list with locked detail             */
/* ------------------------------------------------------------------ */

export function LockedRow({
  label,
  score,
  tone = "amber",
  reveal,
  observation,
  actionable,
}: {
  label: string;
  score?: number;
  tone?: "emerald" | "amber" | "rose";
  reveal: boolean;
  observation?: string;
  actionable?: string;
}) {
  const ring =
    tone === "emerald"
      ? "border-emerald-300/15 bg-emerald-300/[0.02]"
      : tone === "rose"
        ? "border-rose-300/15 bg-rose-300/[0.02]"
        : "border-amber-200/15 bg-amber-200/[0.02]";
  const dot =
    tone === "emerald"
      ? "bg-emerald-300"
      : tone === "rose"
        ? "bg-rose-300"
        : "bg-amber-200";
  return (
    <li className={`rounded-xl border ${ring} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className="text-sm text-white/85">
            {label.replace(/_/g, " ")}
          </span>
        </div>
        {typeof score === "number" && (
          <span className={`text-sm tabular-nums ${scoreColorClass(score)}`}>
            {score.toFixed(1)}
          </span>
        )}
      </div>
      {observation && (
        <p
          className={`mt-2 text-sm leading-relaxed ${
            reveal ? "text-white/75" : "select-none text-white/35"
          }`}
          style={!reveal ? { filter: "blur(5px)" } : undefined}
        >
          {observation}
        </p>
      )}
      {actionable && (
        <p
          className={`mt-2 text-[12px] leading-relaxed ${
            reveal
              ? tone === "emerald"
                ? "text-emerald-300/80"
                : tone === "rose"
                  ? "text-rose-300/80"
                  : "text-amber-200/80"
              : "select-none text-white/30"
          }`}
          style={!reveal ? { filter: "blur(5px)" } : undefined}
        >
          {reveal ? `→ ${actionable}` : `→ ${actionable}`}
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* CompletionBadge — "11 of 11 sections complete"                       */
/* ------------------------------------------------------------------ */

export function CompletionBadge({
  current,
  total,
  reveal,
}: {
  current: number;
  total: number;
  reveal: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/55">
      <Check className="h-3 w-3" />
      {reveal
        ? `${total} of ${total} sections unlocked`
        : `${current} of ${total} sections previewing`}
    </span>
  );
}
