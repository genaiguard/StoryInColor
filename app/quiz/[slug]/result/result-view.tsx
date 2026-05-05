"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

import { useFirebase } from "@/app/firebase/firebase-provider";
import {
  trackQuizRevealShown,
  trackQuizEmailCaptured,
  trackQuizPaywallShown,
  trackQuizPaywallTierSelected,
  trackQuizInitiateCheckout,
  newEventId,
} from "@/lib/analytics/events";

type Props = {
  slug: string;
  headlineFallback: string;
};

type Phase = "loading" | "reveal" | "paywall" | "checkout";

const TIERS: Array<{
  id: "monthly" | "annual";
  name: string;
  priceLabel: string;
  effectiveLabel?: string;
  badge?: string;
  bullets: string[];
  trial?: string;
  highlighted?: boolean;
  valueCents: number;
}> = [
  {
    id: "monthly",
    name: "Monthly Reading Plan",
    priceLabel: "$14.99/mo",
    badge: "Most popular",
    trial: "7-day free trial",
    bullets: [
      "Unlock today's reading",
      "Get 3 new visual readings each month",
      "Receive Daily Reflections based on your Reading Profile",
      "Keep everything in your private library",
    ],
    highlighted: true,
    valueCents: 1499,
  },
  {
    id: "annual",
    name: "Annual Reading Plan",
    priceLabel: "$89.99/yr",
    effectiveLabel: "$7.50/mo · save 50%",
    bullets: [
      "Unlock today's reading",
      "Get 4 new visual readings each month",
      "Receive Daily Reflections based on your Reading Profile",
      "Keep everything in your private library",
      "Early access to new reading types",
    ],
    valueCents: 8999,
  },
];

export default function ResultView({ slug, headlineFallback }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const { initialized, app } = useFirebase();
  const [phase, setPhase] = useState<Phase>("loading");
  const [blurredUrl, setBlurredUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId] = useState(() => newEventId());
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(
    null,
  );

  // Subscribe to pendingReadings/{token} status
  useEffect(() => {
    if (!initialized || !token) {
      if (initialized && !token) {
        setError("Missing reading token. Please start over.");
      }
      return;
    }
    let stopped = false;
    let attempts = 0;
    const fn = httpsCallable(getFunctions(), "getQuizPaywallStatus");
    const tick = async () => {
      if (stopped) return;
      attempts++;
      try {
        const res = await fn({ token });
        const data = res.data as { status?: string };
        if (data?.status === "ready") {
          const blurred = `https://firebasestorage.googleapis.com/v0/b/${app?.options.storageBucket}/o/${encodeURIComponent(`pending/${token}/blurred.jpg`)}?alt=media`;
          setBlurredUrl(blurred);
          setPhase("reveal");
          trackQuizRevealShown({ slug, pendingReadingToken: token });
          return;
        }
        if (data?.status === "claimed") {
          router.replace(`/quiz/${slug}/unlocked?token=${token}`);
          return;
        }
        if (data?.status === "failed" || data?.status === "expired") {
          setError(`Reading ${data.status}. Please start over.`);
          return;
        }
        if (attempts > 60) {
          setError("This is taking too long. Please refresh.");
          return;
        }
        setTimeout(tick, 2000);
      } catch (err) {
        if (attempts > 5) {
          setError(err instanceof Error ? err.message : String(err));
          return;
        }
        setTimeout(tick, 2000);
      }
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [initialized, token, slug, app, router]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!token) return;
      setError(null);
      setSubmitting(true);
      try {
        const fn = httpsCallable(getFunctions(), "captureQuizEmail");
        await fn({ token, email, marketingOptIn });
        trackQuizEmailCaptured({ slug, pendingReadingToken: token });
        setPhase("paywall");
        trackQuizPaywallShown({ slug, pendingReadingToken: token });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [email, marketingOptIn, slug, token],
  );

  const handleTierSelect = useCallback(
    async (tierId: "monthly" | "annual", valueCents: number) => {
      if (!token) return;
      setError(null);
      setSubmitting(true);
      trackQuizPaywallTierSelected({ slug, pendingReadingToken: token, tierId });
      try {
        trackQuizInitiateCheckout({
          slug,
          pendingReadingToken: token,
          tierId,
          valueCents,
          eventId,
        });
        const fn = httpsCallable(getFunctions(), "createQuizCheckoutSession");
        const res = await fn({
          token,
          tier: tierId,
          successUrl: `${window.location.origin}/quiz/${slug}/unlocked?token=${token}`,
        });
        const data = res.data as { clientSecret?: string };
        if (!data?.clientSecret) {
          throw new Error("No checkout session returned.");
        }
        setStripeClientSecret(data.clientSecret);
        setPhase("checkout");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [eventId, slug, token],
  );

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-white">
        <p className="max-w-md text-center text-sm text-rose-200">{error}</p>
        <button
          type="button"
          onClick={() => router.push(`/quiz/${slug}`)}
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
        >
          Start over
        </button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <main className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8">
        <h1 className="text-3xl font-light italic leading-tight md:text-4xl">
          Your reading is ready.
        </h1>
        <p className="mt-3 text-base text-white/80">{headlineFallback}</p>

        {blurredUrl ? (
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={blurredUrl}
              alt="Your reading preview (blurred)"
              className="block w-full"
              loading="eager"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent" />
          </div>
        ) : null}

        {phase === "reveal" ? (
          <form onSubmit={handleEmailSubmit} className="mt-8">
            <label
              htmlFor="quiz-email"
              className="text-xs font-medium uppercase tracking-wider text-white/60"
            >
              Where should we send your reading?
            </label>
            <input
              id="quiz-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            />
            <p className="mt-2 text-xs text-white/50">
              We'll save it to your library here too. We don't share your email
              with anyone.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-white/50">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Email me about new readings and updates. (Optional — your reading
              will arrive either way.)
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "See my reading"
              )}
            </button>
          </form>
        ) : null}

        {phase === "paywall" ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-white/70">
              Choose how you want to continue:
            </p>
            {TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleTierSelect(tier.id, tier.valueCents)}
                disabled={submitting}
                className={`group block w-full rounded-2xl border p-5 text-left transition-colors disabled:opacity-60 ${
                  tier.highlighted
                    ? "border-white bg-white/[0.04] hover:bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium">
                      {tier.badge ? (
                        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-black">
                          <Sparkles className="h-3 w-3" />
                          {tier.badge}
                        </span>
                      ) : null}
                      {tier.name}
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      {tier.priceLabel}
                      {tier.effectiveLabel ? ` · ${tier.effectiveLabel}` : ""}
                      {tier.trial ? ` · ${tier.trial}` : ""}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-white/80">
                  {tier.bullets.map((b) => (
                    <li key={b}>✓ {b}</li>
                  ))}
                </ul>
              </button>
            ))}
            <div className="mt-6 space-y-2 text-xs text-white/50">
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                30-day satisfaction guarantee · Cancel anytime
              </p>
              <p>Trusted by 12,400+ readings generated</p>
            </div>
          </div>
        ) : null}

        {phase === "checkout" && stripeClientSecret ? (
          <CheckoutEmbed
            clientSecret={stripeClientSecret}
            onComplete={() => {
              router.push(`/quiz/${slug}/unlocked?token=${token}`);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function CheckoutEmbed({
  clientSecret,
  onComplete,
}: {
  clientSecret: string;
  onComplete: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { loadStripe } = await import("@stripe/stripe-js");
      const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pubKey) {
        console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing");
        return;
      }
      const stripe = await loadStripe(pubKey);
      if (cancelled || !stripe) return;
      // @ts-expect-error initEmbeddedCheckout exists at runtime
      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret,
        onComplete,
      });
      checkout.mount("#stripe-checkout-mount");
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientSecret, onComplete]);

  return (
    <div className="mt-6">
      {!loaded ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        </div>
      ) : null}
      <div id="stripe-checkout-mount" className="rounded-2xl bg-white/[0.02] p-1" />
    </div>
  );
}
