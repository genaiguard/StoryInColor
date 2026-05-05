// Daily Reflection generator + dispatcher.
// Per QUIZ-PIVOT-SPEC.md §17.5.
//
// Generates a short (100-word) personalized editorial reflection per
// active subscriber, drawn from their Reading Profile, using gpt-4o-mini
// (~$0.0001/reflection, ~$0.04/user/year). Sends via the existing email
// service.
//
// Gated by a SECOND env var (separate from STORYINCOLOR_QUIZ_FUNNEL_ENABLED)
// so the founder can deploy + observe without firing emails. Default: false.
//
// IMPORTANT: only fires for subscribers with subscription.status in
// {active, trialing} per the legacy-user-protection requirement.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { sendDailyReflectionEmail } from "./email-service";

if (!admin.apps.length) {
  admin.initializeApp();
}

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const SENDER_EMAIL_ADDRESS = defineSecret("SENDER_EMAIL_ADDRESS");

const db = admin.firestore();

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

const REFLECTIONS_ENABLED_FLAG = "STORYINCOLOR_DAILY_REFLECTIONS_ENABLED";

function isReflectionsEnabled(): boolean {
  return process.env[REFLECTIONS_ENABLED_FLAG] === "true";
}

interface UserProfile {
  uid: string;
  displayName?: string;
  preferredTone?: "mystical" | "editorial" | "minimal" | "playful";
  primaryReadingCategory?: string;
  quizAnswers?: Record<string, string>;
  readings?: Array<{ generationId: string; toolId: string; completedAt: unknown }>;
  archetypes?: Record<string, unknown>;
  aspirations?: string[];
  reflections?: {
    enabled: boolean;
    cadence?: "daily" | "thrice-weekly" | "weekly";
    deliveryChannels?: Array<"email" | "push">;
    preferredHourLocal?: number;
    timezone?: string;
  };
  subscriptionStatus?: string;
}

interface UserCredits {
  email?: string;
  subscription?: {
    status?: string;
    plan?: string;
  };
}

/**
 * Build the per-reading-category prompt for the Reflection generator.
 * The prompt is INSTRUCTIONAL — telling the model exactly what to produce
 * — and the user data is interpolated separately so the model treats it
 * as content, not instruction.
 */
function buildReflectionPrompt(profile: UserProfile, userEmail: string): {
  system: string;
  user: string;
} {
  const tone = profile.preferredTone || "editorial";
  const lastReading = profile.primaryReadingCategory || "general";
  const aspirations = (profile.aspirations || []).slice(0, 3).join(", ") || "self-discovery";
  const quizAnswerSummary = Object.entries(profile.quizAnswers || {})
    .slice(0, 8)
    .map(([q, a]) => `${q}=${a}`)
    .join("; ");

  const toneInstructions: Record<string, string> = {
    mystical:
      "Tone: cinematic, evocative, slightly mystical. Like a thoughtful friend reading tarot for you.",
    editorial:
      "Tone: editorial magazine voice (Vogue/GQ adjacent). Refined, observational, never overly mystical.",
    minimal:
      "Tone: minimal and direct. Short sentences. No decoration.",
    playful:
      "Tone: playful, light, with one small unexpected turn of phrase.",
  };

  const system = `You are the Daily Reflection writer for StoryInColor — a self-discovery
reading platform. Each day, every subscriber gets a short personalized
note drawn from their Reading Profile (their last reading, their quiz
answers, their stated aspirations).

CRITICAL RULES:
- Length: 80–110 words. Never longer.
- Format: a single short prose paragraph. No headings, no bullets.
- Address them in second person ("you").
- ${toneInstructions[tone] || toneInstructions.editorial}
- Draw from the user's Profile, not from astrology or the calendar.
- Never claim knowledge you don't have. Don't predict the future.
- Never include their email or any literal Profile field name.
- Open with something specific (not "Today is a good day to…").
- Close with a single small invitation (notice, observe, ask yourself…).
- Frame as REFLECTION (looking inward), not advice.
- Output the reflection text only — no preamble, no signature.`;

  const user = `User Reading Profile:
- Last reading category: ${lastReading}
- Stated aspirations: ${aspirations}
- Quiz answers: ${quizAnswerSummary || "(none)"}
- Tone preference: ${tone}

Write today's Daily Reflection for this user. Output the reflection text only.`;

  return { system, user };
}

/**
 * Generate a single reflection for a user via gpt-4o-mini.
 */
async function generateReflectionText(
  profile: UserProfile,
  userEmail: string,
): Promise<string> {
  const { system, user } = buildReflectionPrompt(profile, userEmail);
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY.value()}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 300,
      temperature: 0.85,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${txt}`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("No reflection text returned");
  return text;
}

/**
 * Generate + dispatch ONE reflection for one user.
 * Idempotent on date: doc id is YYYY-MM-DD, so a same-day re-run no-ops.
 */
async function generateAndDispatchOne(
  uid: string,
  profile: UserProfile,
  email: string,
  todayKey: string,
): Promise<{ ok: boolean; sent: boolean; reason?: string }> {
  const reflectionRef = db
    .collection("users")
    .doc(uid)
    .collection("reflections")
    .doc(todayKey);
  const existing = await reflectionRef.get();
  if (existing.exists && existing.data()?.sentAt) {
    return { ok: true, sent: false, reason: "already-sent" };
  }

  // Generate text
  const text = await generateReflectionText(profile, email);

  // Persist BEFORE dispatch — if email send fails, the reflection text
  // is preserved and visible in /dashboard/reflections.
  await reflectionRef.set({
    text,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    profileSnapshot: {
      tone: profile.preferredTone,
      lastReading: profile.primaryReadingCategory,
      aspirations: profile.aspirations,
    },
  });

  // Send email if user opted in (default true for subscribers)
  const channels = profile.reflections?.deliveryChannels || ["email"];
  if (channels.includes("email")) {
    try {
      await sendDailyReflectionEmail(email, text, profile.displayName);
      await reflectionRef.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true, sent: true };
    } catch (sendErr) {
      console.error(`[DailyReflection] Send failed for ${email}:`, sendErr);
      return {
        ok: true,
        sent: false,
        reason: sendErr instanceof Error ? sendErr.message : String(sendErr),
      };
    }
  }
  return { ok: true, sent: false, reason: "email-channel-disabled" };
}

/**
 * Pull all subscribers with active or trialing subscription whose
 * reflections are enabled.
 *
 * Important: this query specifically excludes legacy users who never
 * had a subscription — those have no `subscription.status` field.
 */
async function loadActiveSubscribers(): Promise<
  Array<{ uid: string; email: string; profile: UserProfile }>
> {
  const subscribersSnap = await db
    .collection("userCredits")
    .where("subscription.status", "in", ["active", "trialing"])
    .limit(1000) // soft cap; raise via batches when scaling
    .get();

  const result: Array<{ uid: string; email: string; profile: UserProfile }> = [];
  for (const doc of subscribersSnap.docs) {
    const uid = doc.id;
    const credits = doc.data() as UserCredits;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const email = (userData.email as string) || credits.email;
    if (!email) continue;
    const profileSnap = await db.collection("userProfiles").doc(uid).get();
    if (!profileSnap.exists) continue;
    const profile = profileSnap.data() as UserProfile;
    if (profile.reflections?.enabled === false) continue;
    result.push({ uid, email, profile });
  }
  return result;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Scheduled daily run. Generates + dispatches reflections for every
 * eligible subscriber. Runs at 11am UTC (= ~7am ET / 4am PT) to land
 * before the typical morning email check.
 *
 * Cadence per-user: simplified to "once per day" in v1. The
 * profile.reflections.cadence field is captured but not yet used to
 * filter (v2 enhancement).
 */
export const dispatchDailyReflections = onSchedule(
  {
    schedule: "0 11 * * *",
    timeZone: "UTC",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [
      OPENAI_API_KEY,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      SENDER_EMAIL_ADDRESS,
    ],
  },
  async () => {
    if (!isReflectionsEnabled()) {
      console.log("[DailyReflection] Disabled by env flag — skipping.");
      return;
    }
    const subs = await loadActiveSubscribers();
    console.log(`[DailyReflection] Found ${subs.length} eligible subscribers.`);
    const today = todayKey();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const sub of subs) {
      try {
        const result = await generateAndDispatchOne(
          sub.uid,
          sub.profile,
          sub.email,
          today,
        );
        if (result.sent) sent++;
        else skipped++;
      } catch (err) {
        failed++;
        console.error(
          `[DailyReflection] Failed for uid=${sub.uid}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    console.log(
      `[DailyReflection] Done. sent=${sent} skipped=${skipped} failed=${failed}`,
    );
  },
);

/**
 * Admin-only callable to manually trigger ONE reflection (for QA / testing
 * the email + content pipeline without waiting for the daily schedule).
 */
export const generateReflectionPreview = onCall(
  {
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth?.token?.admin) {
      throw new HttpsError("permission-denied", "Admin only.");
    }
    const data = request.data as { uid?: string };
    if (!data.uid) {
      throw new HttpsError("invalid-argument", "Missing uid.");
    }
    const profileSnap = await db.collection("userProfiles").doc(data.uid).get();
    if (!profileSnap.exists) {
      throw new HttpsError("not-found", "Profile not found.");
    }
    const profile = profileSnap.data() as UserProfile;
    const userSnap = await db.collection("users").doc(data.uid).get();
    const email = userSnap.data()?.email as string || "";
    const text = await generateReflectionText(profile, email);
    return { text, profileSnapshot: { tone: profile.preferredTone } };
  },
);
