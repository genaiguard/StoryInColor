"use client";

import { useEffect, useRef, useState } from "react";

interface LazyVideoProps {
  src: string;
  poster?: string;
  className?: string;
  /** rootMargin for IntersectionObserver — start loading slightly before visible */
  rootMargin?: string;
}

/**
 * Lazy-loads a background video on intersection.
 *
 * Why: hero videos can be several MB. Mounting the <video> element only when
 * the section enters the viewport (with a generous rootMargin so it's ready
 * before the user sees it) keeps the LCP fast and avoids burning bandwidth
 * on visitors who never reach this part of the page.
 *
 * The poster image renders immediately as a layout-stable fallback so the
 * dark backdrop isn't empty during the (usually brief) load.
 */
export function LazyVideo({
  src,
  poster,
  className = "",
  rootMargin = "200px",
}: LazyVideoProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Bail out gracefully on environments without IntersectionObserver
    // (very old browsers); just load eagerly there.
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={wrapperRef}
      className={`absolute inset-0 ${className}`}
      aria-hidden="true"
    >
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      )}
      {shouldLoad && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={poster}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
