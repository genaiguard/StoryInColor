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

const ROTATE_MS = 5500;

export default function HeroSection() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const featured = FEATURED[idx];

  // Auto-rotate the featured reading. Pauses while the cursor is on the hero
  // so visitors can finish reading what they hovered over.
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % FEATURED.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
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
