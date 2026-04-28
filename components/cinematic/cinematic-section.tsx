import { type ReactNode } from "react";

export interface CinematicSectionProps {
  /** Anchor id for in-page nav (e.g. "examples", "pricing"). */
  id?: string;
  /** Small caps eyebrow above the title. */
  eyebrow: string;
  /** Section title (renders as <h2>). */
  title: ReactNode;
  /** Optional gray description under the title, max-w-xl. */
  description?: ReactNode;
  /** Optional softer top vignette (radial spotlight) for the editorial-style sections. */
  spotlight?: boolean;
  /** Add a thin top border so consecutive sections separate cleanly. */
  topBorder?: boolean;
  /** Vertical padding preset. */
  padding?: "default" | "tight" | "wide";
  className?: string;
  children: ReactNode;
  /** Tailwind max-w preset for the inner container. */
  containerWidth?: "narrow" | "default" | "wide";
  /**
   * Heading level for the title. Use "h1" for top-of-page hero sections
   * (one per page, for SEO); "h2" (default) for embedded sections.
   */
  headingLevel?: "h1" | "h2";
}

const PADDING_MAP: Record<NonNullable<CinematicSectionProps["padding"]>, string> = {
  tight: "py-16 md:py-20",
  default: "py-24 md:py-32",
  wide: "py-28 md:py-40",
};

const CONTAINER_MAP: Record<NonNullable<CinematicSectionProps["containerWidth"]>, string> = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

/**
 * Shared section shell for the cinematic landing + reading pages.
 *
 * Renders the consistent eyebrow + title + description editorial header
 * pattern over the dark background. Children render below the header.
 *
 * Use this anywhere you'd otherwise hand-roll the eyebrow rule + h2 +
 * paragraph pattern. Keeping it in one place makes the layout coherent
 * across the marketing site (landing, per-reading, /readings, /credits).
 */
export function CinematicSection({
  id,
  eyebrow,
  title,
  description,
  spotlight = false,
  topBorder = false,
  padding = "default",
  containerWidth = "wide",
  className = "",
  headingLevel = "h2",
  children,
}: CinematicSectionProps) {
  const Heading = headingLevel;
  return (
    <section
      id={id}
      className={`relative overflow-hidden bg-black ${PADDING_MAP[padding]} ${
        topBorder ? "border-t border-white/5" : ""
      } ${className}`}
    >
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_60%)]"
        />
      )}
      <div
        className={`container relative mx-auto px-6 md:px-8 ${CONTAINER_MAP[containerWidth]}`}
      >
        <div className="mb-12 max-w-2xl md:mb-14">
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            <span className="h-px w-8 bg-white/20" aria-hidden="true" />
            {eyebrow}
          </div>
          <Heading
            className="text-4xl font-normal text-white md:text-5xl lg:text-6xl"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </Heading>
          {description && (
            <p className="mt-5 max-w-xl text-base text-gray-400 md:text-lg">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
