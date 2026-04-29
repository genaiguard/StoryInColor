"use client";
import Link from "next/link";
import { PathImg } from "@/components/ui/pathed-image";
import type { Tool } from "@/lib/tools/types";

export interface ToolCardProps {
  tool: Tool;
  href?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Show the per-generation credit cost as a pill on the card.
   * Default OFF — public marketing surfaces should not lead with price.
   * Pass true from the dashboard where the signed-in user wants the info.
   */
  showCost?: boolean;
  /**
   * Show a prominent "FREE" corner banner on the cover image when this
   * tool is free (creditCost 0). Used on /readings for signed-in users
   * to make the coloring-page entry obvious. NEVER pass true on the
   * landing or any pre-login surface — the free hook is gated to
   * authenticated visitors so it doesn't leak into pre-login marketing.
   */
  showFreeBanner?: boolean;
}

export function ToolCard({
  tool,
  href,
  size = "md",
  showCost = false,
  showFreeBanner = false,
}: ToolCardProps) {
  const target = href ?? `/readings/${tool.slug}`;
  const aspect =
    size === "sm" ? "aspect-[4/5]" : "aspect-[2/3]";
  // 1 credit == 1 reading on every user-facing surface. coloring-book is
  // free (creditCost 0) and shows a "Free" pill; everything else is
  // priced as a single reading.
  const costLabel =
    tool.creditCost === 0
      ? "Free"
      : tool.creditCost === 1
        ? "1 reading"
        : `${tool.creditCost} readings`;
  const isFree = tool.creditCost === 0;

  return (
    <Link
      href={target}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className={`relative ${aspect} w-full overflow-hidden bg-black`}>
        <PathImg
          src={tool.coverImage}
          alt={tool.name}
          fill
          className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Soft top-down vignette so cover images blend into the dark card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
        />
        {showFreeBanner && isFree && (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black shadow-lg">
            Free
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-lg font-medium leading-tight text-white">
            {tool.name}
          </h3>
          {showCost && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-gray-300">
              {costLabel}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-gray-400">{tool.tagline}</p>
      </div>
    </Link>
  );
}
