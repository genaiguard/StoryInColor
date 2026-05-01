// Result-page upsell pairings. After a reading completes, the result
// page surfaces "Up next: <paired reading>" with the paired tool's
// cover image, a one-line tease, and a CTA to start that reading.
//
// Pairings are picked to be thematically adjacent — same category, or
// a natural complement (face-reading pairs with aura-reading; palm
// pairs with handwriting; beauty pairs with color-analysis). The
// coloring-book is the only tool with no pairing — it's free and
// outside the editorial-self-reflection direction the brand has
// settled on (per DECISIONS.md).
//
// Adding a tool: pick a peer reading and add an entry. Removing a
// tool: just delete the entry; getNextTool returns null when no
// pairing exists, and the result page hides the upsell card cleanly.

import { getToolById } from "./registry";
import type { Tool } from "./types";

const PAIRINGS: Record<string, string> = {
  "aura-reading": "face-reading",
  "palm-reading": "handwriting",
  "face-reading": "aura-reading",
  "beauty-report": "color-analysis",
  "iridology": "skincare-glow",
  "handwriting": "palm-reading",
  "skincare-glow": "beauty-report",
  "color-analysis": "hairstyle-analysis",
  "hairstyle-analysis": "beauty-report",
  "style-audit": "color-analysis",
  // coloring-book intentionally absent — free tool, no upsell.
};

// Short copy that introduces the paired reading on the result page.
// Keyed by the JUST-COMPLETED tool id (the source of the pairing) so
// each line can frame the next reading in the context of what the user
// just saw.
const PAIRING_TEASE: Record<string, string> = {
  "aura-reading":
    "You've seen your aura. See what your face says.",
  "palm-reading":
    "You've read your palm. Read your handwriting next.",
  "face-reading":
    "Your face is mapped. Pair it with the aura that surrounds it.",
  "beauty-report":
    "You've got the report. Now find the colours that complete it.",
  "iridology":
    "Your iris is read. Add a skincare routine to match.",
  "handwriting":
    "Your handwriting is read. Pair it with what your palm says.",
  "skincare-glow":
    "Routine in hand. Add a full beauty report to the file.",
  "color-analysis":
    "Your palette is set. Pair it with cuts that suit your face.",
  "hairstyle-analysis":
    "Cuts compared. Add a beauty report for the full look.",
  "style-audit":
    "Style audited. Pair it with your colour palette.",
};

/** Return the paired Tool for a just-completed reading, or null when
 *  there is no pairing (coloring-book) or the paired tool no longer
 *  exists in the registry. */
export function getNextTool(currentToolId: string): Tool | null {
  const nextId = PAIRINGS[currentToolId];
  if (!nextId) return null;
  const tool = getToolById(nextId);
  return tool ?? null;
}

/** Return the editorial tease line for the pairing, or a generic
 *  fallback when the source tool has no entry. */
export function getPairingTease(currentToolId: string): string {
  return (
    PAIRING_TEASE[currentToolId] ??
    "Try another editorial reading on the same photo, or a fresh one."
  );
}
