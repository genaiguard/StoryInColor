"use client";

import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/tools/registry";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";

const FEATURED_IDS = [
  "palm-reading",
  "face-reading",
  "beauty-report",
  "aura-reading",
  "handwriting",
  "style-audit",
] as const;

const FEATURED = FEATURED_IDS.map((id) => {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) {
    throw new Error(`Hero featured tool not found: ${id}`);
  }
  return tool;
});

// Rotate every 2s, full stop. No first-cycle-fast variant, no pause-on-
// hover, no tab-visibility logic. The earlier "pause on hover" behavior
// caused the rotation to silently stop whenever the visitor's cursor
// was anywhere on the hero — which on desktop is most of the time —
// so the carousel looked broken. Keep it simple.
const ROTATE_MS = 2000;

export default function HeroSection() {
  const [idx, setIdx] = useState(0);
  const featured = FEATURED[idx];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIdx((i) => (i + 1) % FEATURED.length);
    }, ROTATE_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div>
      <CinematicHero
        video={{ src: "/videos/hero.mp4" }}
        contentKey={idx}
        title={featured.name}
        italicTagline={`${featured.tagline}.`}
        description={featured.heroCopy}
        primaryCta={{
          // Always go to registration. Conversion-critical: the hero
          // rotates between readings every ~3.85s, but the primary CTA
          // is "Start free" — sending a clicker to /readings/<whatever-
          // happens-to-be-rotating-when-they-clicked> is a coincidence,
          // not an intent. The visitor came to start, not to deep-link
          // into an arbitrary reading. /login?register=true puts them
          // on the signup form, which grants 2 free starter credits and
          // lands them on the dashboard where they pick a reading.
          label: "Start free",
          href: "/login?register=true",
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
