"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { LazyVideo } from "./lazy-video";

export interface MetadataPill {
  /** Pre-rendered icon node (e.g. <Sparkles className="..." />). Passing a
   *  ReactNode rather than a component reference keeps this prop crossable
   *  from server components without the React Server Components serializer
   *  complaining about non-plain-object props. */
  icon: ReactNode;
  label: string;
}

export interface CinematicCta {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Pre-rendered icon node (see MetadataPill.icon for rationale). When
   *  omitted on the primary CTA, a Play icon is used by default. */
  icon?: ReactNode;
  /** Skip the icon entirely (some CTAs are clean text-only). */
  hideIcon?: boolean;
}

export interface CinematicHeroProps {
  /** Background video — preferred for the landing hero. */
  video?: { src: string; poster?: string };
  /** Background image — preferred for per-reading detail pages. */
  image?: { src: string; alt: string };
  /** Small caps eyebrow above the title (e.g. "Editorial reading"). */
  eyebrow?: string;
  /** Primary headline. Renders as <h1>. */
  title: string;
  /** Italic light-gray subtitle, sits between title and description. */
  italicTagline?: string;
  /** Body description, max-w-xl. */
  description?: string;
  /** Optional metadata pills row (icon + short label). */
  metadata?: MetadataPill[];
  /** Primary CTA — solid white pill. */
  primaryCta?: CinematicCta;
  /** Secondary CTA — liquid-glass pill. */
  secondaryCta?: CinematicCta;
  /** When provided, renders Previous / Next pills wired to onPrev/onNext. */
  carousel?: { onPrev: () => void; onNext: () => void };
  /** Stable react key per featured item — drives re-trigger of blur-fade-up. */
  contentKey?: string | number;
  /** Children render at the end of the content column (e.g. social proof). */
  children?: ReactNode;
  /** Extra classes on the wrapping <section>. */
  className?: string;
}

/**
 * Reusable cinematic hero shell. Used by the landing page (with video bg
 * and an auto-rotating featured-reading carousel) and the per-reading
 * marketing pages (with the reading's cover image as the bg).
 *
 * Animation: every foreground element fades up from blur via the global
 * .animate-blur-fade-up keyframes, with stagger delays choreographed
 * 250ms → 950ms.
 */
export function CinematicHero({
  video,
  image,
  eyebrow,
  title,
  italicTagline,
  description,
  metadata,
  primaryCta,
  secondaryCta,
  carousel,
  contentKey,
  children,
  className = "",
}: CinematicHeroProps) {
  return (
    <section
      className={`relative h-screen min-h-[640px] w-full overflow-hidden bg-black text-white ${className}`}
    >
      {/* Background — video or image */}
      {video ? (
        <LazyVideo src={video.src} poster={video.poster} />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt={image.alt}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* Bottom-only backdrop blur. The mask fades the blur strength to
          transparent around the middle of the screen so the top half of
          the bg stays crisp. */}
      <div
        aria-hidden="true"
        className="bottom-blur-mask pointer-events-none absolute inset-0 z-10"
      />

      {/* Foreground content */}
      <div className="relative z-20 flex h-full flex-col justify-end px-4 pb-8 pt-24 sm:px-6 md:px-12 md:pb-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-end">
          <div className="flex-1">
            {eyebrow && (
              <div
                key={`eyebrow-${contentKey ?? ""}`}
                className="animate-blur-fade-up mb-5 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-300 md:mb-6"
                style={{ animationDelay: "250ms" }}
              >
                <span className="h-px w-8 bg-white/30" aria-hidden="true" />
                {eyebrow}
              </div>
            )}

            {metadata && metadata.length > 0 && (
              <div
                key={`meta-${contentKey ?? ""}`}
                className="animate-blur-fade-up mb-6 flex flex-wrap items-center gap-3 text-xs sm:gap-6 sm:text-sm md:mb-8"
                style={{ animationDelay: "300ms" }}
              >
                {metadata.map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center gap-1.5 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5"
                  >
                    {m.icon}
                    <span className="font-medium">{m.label}</span>
                  </div>
                ))}
              </div>
            )}

            <h1
              key={`title-${contentKey ?? ""}`}
              className="animate-blur-fade-up mb-3 text-4xl font-normal sm:text-5xl md:mb-4 md:text-6xl lg:text-7xl"
              style={{ letterSpacing: "-0.04em", animationDelay: "400ms" }}
            >
              {title}
            </h1>

            {italicTagline && (
              <p
                key={`tagline-${contentKey ?? ""}`}
                className="animate-blur-fade-up mb-5 max-w-2xl text-lg italic font-light text-gray-300 sm:text-xl md:mb-8 md:text-2xl"
                style={{
                  letterSpacing: "-0.02em",
                  animationDelay: "475ms",
                }}
              >
                {italicTagline}
              </p>
            )}

            {description && (
              <p
                key={`desc-${contentKey ?? ""}`}
                className="animate-blur-fade-up mb-6 max-w-xl text-sm text-gray-400 sm:text-base md:mb-12"
                style={{ animationDelay: "550ms" }}
              >
                {description}
              </p>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {primaryCta && <PrimaryPill cta={primaryCta} delay={650} />}
                {secondaryCta && (
                  <GlassPill cta={secondaryCta} delay={750} />
                )}
              </div>
            )}

            {children}
          </div>

          {carousel && (
            <div className="flex items-center gap-3 self-start md:self-end">
              <button
                type="button"
                onClick={carousel.onPrev}
                className="liquid-glass animate-blur-fade-up inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 font-medium sm:gap-2 sm:px-6 sm:py-3"
                style={{ animationDelay: "850ms" }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <button
                type="button"
                onClick={carousel.onNext}
                className="liquid-glass animate-blur-fade-up inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 font-medium sm:gap-2 sm:px-6 sm:py-3"
                style={{ animationDelay: "950ms" }}
                aria-label="Next"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PrimaryPill({ cta, delay }: { cta: CinematicCta; delay: number }) {
  const icon = cta.hideIcon
    ? null
    : (cta.icon ?? <Play className="h-[18px] w-[18px] fill-black" />);
  const inner = (
    <>
      {icon}
      {cta.label}
    </>
  );

  const className =
    "animate-blur-fade-up inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-medium text-black transition-colors hover:bg-gray-200 sm:px-8 sm:py-3";
  const style = { animationDelay: `${delay}ms` };

  if (cta.href) {
    return (
      <Link href={cta.href} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={cta.onClick}
      className={className}
      style={style}
    >
      {inner}
    </button>
  );
}

function GlassPill({ cta, delay }: { cta: CinematicCta; delay: number }) {
  const icon = cta.hideIcon ? null : cta.icon;
  const inner = (
    <>
      {icon}
      {cta.label}
    </>
  );

  const className =
    "liquid-glass animate-blur-fade-up inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-medium sm:px-8 sm:py-3";
  const style = { animationDelay: `${delay}ms` };

  if (cta.href) {
    return (
      <Link href={cta.href} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={cta.onClick}
      className={className}
      style={style}
    >
      {inner}
    </button>
  );
}
