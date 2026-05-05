"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { ORDERED_TOOLS, getToolBySlug } from "@/lib/tools/registry";

type ToneOption = "mystical" | "editorial" | "minimal" | "playful";

interface ReadingProfile {
  uid: string;
  primaryReadingCategory?: string;
  preferredTone?: ToneOption;
  quizAnswers?: Record<string, string>;
  readings?: Array<{
    generationId: string;
    toolId: string;
    completedAt?: { seconds?: number } | null;
  }>;
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, initialized } = useFirebase();
  const [profile, setProfile] = useState<ReadingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.push("/login?next=/dashboard/profile");
      return;
    }
    const ref = doc(getFirestore(), "userProfiles", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as ReadingProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[Profile] snapshot error:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [initialized, user, router]);

  async function updateField(patch: Partial<ReadingProfile>) {
    if (!user) return;
    setSaving(true);
    try {
      // Direct field updates allowed by rules: only the owner can write
      // their profile. (Server-only rules currently apply via admin bypass;
      // we'll permit owner-write for these specific fields via rule
      // refinement if needed. For v1 the writes go through a small callable
      // — but we use updateDoc here as the path-of-least-resistance and
      // expect rules to permit owner-write for these fields. If rules
      // block: route through a Cloud Function instead.)
      const ref = doc(getFirestore(), "userProfiles", user.uid);
      await updateDoc(ref, {
        ...patch,
        lastUpdatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[Profile] update failed:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white/70" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-white">
        <p className="max-w-md text-center text-sm text-white/70">
          Your Reading Profile starts after your first reading. Try one to
          begin building it.
        </p>
        <Link
          href="/readings"
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          See readings
        </Link>
      </div>
    );
  }

  const exploredToolIds = new Set((profile.readings || []).map((r) => r.toolId));
  const allReadings = ORDERED_TOOLS.filter((t) => t.id !== "coloring-book");

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-8">
          <Link
            href="/dashboard"
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <h1 className="text-base font-semibold tracking-tight">
            Your Reading Profile
          </h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        {/* Identity card */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/50">
            Identity
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-white/85">
              You're drawn to{" "}
              <strong className="text-white">
                {profile.primaryReadingCategory
                  ? readableSlug(profile.primaryReadingCategory)
                  : "self-discovery"}
              </strong>
              {profile.aspirations && profile.aspirations.length > 0 ? (
                <>
                  {" "}with aspirations clustered around{" "}
                  <strong className="text-white">
                    {profile.aspirations.slice(0, 3).join(", ")}
                  </strong>
                </>
              ) : null}
              .
            </p>
            <div>
              <label className="text-xs text-white/50">Preferred tone</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["editorial", "mystical", "minimal", "playful"] as ToneOption[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateField({ preferredTone: t })}
                      disabled={saving}
                      className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                        profile.preferredTone === t
                          ? "border-white bg-white text-black"
                          : "border-white/20 bg-white/[0.04] text-white/80 hover:border-white/40"
                      }`}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Lenses card */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/50">
            Lenses you've explored
          </h2>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {allReadings.map((reading) => {
              const explored = exploredToolIds.has(reading.id);
              return (
                <li
                  key={reading.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                    explored
                      ? "border-white/30 bg-white/[0.06]"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={
                      explored ? "text-white" : "text-white/60"
                    }
                  >
                    {explored ? "✓ " : "○ "}
                    {reading.name}
                  </span>
                  {!explored ? (
                    <Link
                      href={`/readings/${reading.slug}`}
                      className="text-xs text-white/50 underline-offset-2 hover:text-white hover:underline"
                    >
                      try this lens →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Reflections card */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/50">
            Daily Reflections
          </h2>
          <p className="mt-2 text-sm text-white/70">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Drawn from your Reading Profile.{" "}
            {profile.subscriptionStatus === "active" ||
            profile.subscriptionStatus === "trialing"
              ? "Active with your subscription."
              : "Available to subscribers."}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-white/50">Cadence</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["daily", "thrice-weekly", "weekly"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      updateField({
                        reflections: {
                          ...(profile.reflections || {
                            enabled: true,
                            deliveryChannels: ["email"],
                          }),
                          enabled: profile.reflections?.enabled ?? true,
                          cadence: c,
                        },
                      })
                    }
                    disabled={saving}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      profile.reflections?.cadence === c
                        ? "border-white bg-white text-black"
                        : "border-white/20 bg-white/[0.04] text-white/80 hover:border-white/40"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50">Delivery</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    profile.reflections?.deliveryChannels?.includes("email")
                      ? "border-white bg-white text-black"
                      : "border-white/20 bg-white/[0.04] text-white/60"
                  }`}
                >
                  Email
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              updateField({
                reflections: {
                  ...(profile.reflections || {
                    cadence: "daily",
                    deliveryChannels: ["email"],
                  }),
                  enabled: !(profile.reflections?.enabled ?? true),
                },
              })
            }
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
          >
            {profile.reflections?.enabled === false
              ? "Resume Reflections"
              : "Pause Reflections"}
          </button>
        </section>
      </main>
    </div>
  );
}

function readableSlug(slug: string): string {
  const tool = getToolBySlug(slug);
  return tool?.name || slug.replace(/-/g, " ");
}
