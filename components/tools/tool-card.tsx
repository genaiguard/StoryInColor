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
}

export function ToolCard({ tool, href, size = "md", showCost = false }: ToolCardProps) {
  const target = href ?? `/readings/${tool.slug}`;
  const aspect =
    size === "sm" ? "aspect-[4/5]" : size === "lg" ? "aspect-[2/3]" : "aspect-[3/4]";
  const costLabel = tool.creditCost === 1 ? "1 credit" : `${tool.creditCost} credits`;

  return (
    <Link
      href={target}
      className="group block rounded-2xl border border-gray-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
    >
      <div className={`relative ${aspect} w-full bg-[#f7f4f3] overflow-hidden`}>
        <PathImg
          src={tool.coverImage}
          alt={tool.name}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            {tool.name}
          </h3>
          {showCost && (
            <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              {costLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">{tool.tagline}</p>
      </div>
    </Link>
  );
}
