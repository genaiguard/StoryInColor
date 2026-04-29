"use client";

import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/tools/registry";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";

const FEATURED_IDS = [
  "palm-reading",
  "face-reading",
  "aura-reading",
  "handwriting",
  "style-audit",
  "room-vibes",
] as const;

const FEATURED = FEATURED_IDS.map((id) => {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) {
    throw new Error(`Hero featured tool not found: ${id}`);
  }
  return tool;
});

// First rotation kicks in fast — the blur-fade-up entry animation finishes
// around ~1550ms, so this lets the visitor see the title settle, then
// gives them roughly 250ms to read it before the carousel cycles. The
// goal: prove there's a carousel before the first scroll (which usually
// happens in 2-3s on landing pages).
const FIRST_ROTATE_MS = 1800;
const ROTATE_MS = 3850;

export default function HeroSection() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const featured = FEATURED[idx];

  // Auto-rotate the featured reading. The first cycle fires fast (so a
  // visitor who scrolls within a couple seconds still sees the carousel
  // do something), then we settle into the normal cadence. Pauses while
  // the cursor is on the hero so visitors can finish reading.
  useEffect(() => {
    if (paused) return;
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      setIdx((i) => (i + 1) % FEATURED.length);
      intervalId = window.setInterval(() => {
        setIdx((i) => (i + 1) % FEATURED.length);
      }, ROTATE_MS);
    }, FIRST_ROTATE_MS);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <CinematicHero
        video={{ src: "/videos/hero.mp4" }}
        contentKey={idx}
        title={featured.name}
        italicTagline={`${featured.tagline}.`}
        description={featured.heroCopy}
        primaryCta={{
          label: "Start free",
          href: `/readings/${featured.slug}`,
        }}
        secondaryCta={{
          label: "See readings",
          href: "/readings",
          hideIcon: true,
        }}
      />
    </div>
  );
}
