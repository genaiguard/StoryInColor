// Copy helpers derived from the tool registry. Keeping these in one place
// means adding a 12th (or 20th) tool only requires editing the registry —
// the count word ("Eleven" → "Twelve") and the comma list update everywhere.

import { TOOLS } from "./registry";

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven",
  "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

const word = NUMBER_WORDS[TOOLS.length] ?? String(TOOLS.length);

export const TOOL_COUNT = TOOLS.length;
export const TOOL_COUNT_WORD = word.charAt(0).toUpperCase() + word.slice(1); // "Eleven"
export const TOOL_COUNT_WORD_LOWER = word; // "eleven"

export const TOOL_NAMES_COMMA_LOWER = TOOLS
  .map((t) => t.name.toLowerCase())
  .join(", ");
