"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Clock,
  Plus,
  Minus,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useFirebase } from "@/app/firebase/firebase-provider";
import {
  getUserCredits,
  CREDIT_PACKAGES,
  formatCreditBalance,
} from "@/app/firebase/credits-helpers";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";
import {
  newEventId,
  trackInitiateCheckout,
  trackClickedBuyNow,
} from "@/lib/analytics/events";
import { tsToMillis } from "@/lib/utils";
import { ORDERED_TOOLS } from "@/lib/tools/registry";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { PaymentMethodChips } from "@/components/ui/payment-logos";

/**
 * Page header. Restructured per Clarity finding: the previous prominent
 * left-side "← Dashboard" pill was the single most-clicked element on
 * /credits (9 clicks across 16 sessions in the post-pivot cohort). It
 * read as a back/exit affordance, away from purchase. Now the brand
 * wordmark is the left-anchored primary mark; "Dashboard" is a
 * secondary text link on the right.
 */
function PageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="text-base font-semibold tracking-[-0.02em] text-white sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          Dashboard
        </Link>
      </div>
    </header>
  );
}

// Per-pack tier label — replaces the prior "Just one / Most loved / Save 35%"
// triple, all of which sat in different positions on the card. The point
// of the pack is now in one place: a short headline + a discount badge.
const PACK_TIER_LABELS: Record<string, { title: string; badge?: string }> = {
  single: { title: "Try one" },
  trio: { title: "Most popular", badge: "Save 20%" },
  set: { title: "Best value", badge: "Save 35%" },
};

// Tools whose sample images get featured in the reel below the SKUs.
// Pulled from the canonical `ORDERED_TOOLS` so additions/removals to the
// catalog flow through automatically. Coloring-book has no editorial
// sample worth featuring on a paid pricing page.
const SAMPLE_REEL_LIMIT = 6;

// 30-day satisfaction guarantee. Refunds are handled manually via the
// support address — see DECISIONS.md if/when this changes to a self-serve
// refund button.
const GUARANTEE_WINDOW_DAYS = 30;
const SUPPORT_EMAIL = "info@storyincolor.com";

// Three short editorial testimonials, mirrored from
// components/landing-page/testimonials-section.tsx so the /credits page
// is self-contained. Decision-stage social proof on the pricing page is
// where industry studies show the largest single conversion lift.
const PRICING_TESTIMONIALS = [
  {
    quote:
      "Saw me through my handwriting in a way I wasn't expecting. The page is on my fridge.",
    attribution: "Sarah T.",
    reading: "Handwriting",
  },
  {
    quote:
      "Sent my friend her aura reading after a rough week. She cried, in the good way.",
    attribution: "Michael R.",
    reading: "Aura",
  },
  {
    quote:
      "Showed my stylist the hairstyle reading instead of explaining what I wanted. She said, 'finally — a brief.'",
    attribution: "Jennifer L.",
    reading: "Hairstyle",
  },
];

function getSafeReturnPath(value: string | null): string | null {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !/[\r\n]/.test(value)
  ) {
    return value;
  }
  return null;
}

/**
 * Inline trust strip rendered above the SKU grid. Stripe disclosed +32%
 * checkout conversion when buyer-reassurance imagery is visible; before
 * this row, /credits had no security or guarantee signal at all (only a
 * 5-second pre-redirect toast that fired mid-navigation).
 */
function TrustBadgesRow() {
  return (
    <div
      role="group"
      aria-label="Checkout trust signals"
      className="liquid-glass mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-2xl px-5 py-4 text-xs text-gray-300 sm:text-sm"
    >
      <span className="inline-flex items-center gap-2">
        <ShieldCheck
          className="h-4 w-4 text-emerald-300"
          aria-hidden="true"
        />
        Secure checkout via Stripe
      </span>
      <span className="hidden h-4 w-px bg-white/10 sm:inline-block" aria-hidden="true" />
      <span className="inline-flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-white" aria-hidden="true" />
        {GUARANTEE_WINDOW_DAYS}-day satisfaction guarantee
      </span>
      <span className="hidden h-4 w-px bg-white/10 sm:inline-block" aria-hidden="true" />
      <PaymentMethodChips className="flex items-center gap-1.5 sm:gap-2" />
    </div>
  );
}

/**
 * Sample-output reel — visual proof of the deliverable, rendered as a
 * horizontally-scrollable strip below the SKU grid. Each tile is a click-
 * to-zoom lightbox so visitors can examine a sample at native resolution
 * before committing to a pack. Currently /credits has zero visual proof.
 */
function SampleOutputReel() {
  const samples = ORDERED_TOOLS
    .filter((tool) => tool.id !== "coloring-book" && tool.seo.sampleImage)
    .slice(0, SAMPLE_REEL_LIMIT);

  return (
    <section className="mt-14">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-medium text-white">What you'll get</h2>
        <Link
          href="/readings"
          className="text-xs text-gray-400 transition-colors hover:text-white"
        >
          See all readings →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {samples.map((tool) => (
          <ImageLightbox
            key={tool.id}
            src={tool.seo.sampleImage!}
            alt={`${tool.name} sample`}
            triggerClassName="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-black p-0 text-left ring-1 ring-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <div className="aspect-[2/3] w-full overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tool.seo.sampleImage!}
                alt={`${tool.name} sample`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 text-left">
              <p className="text-xs font-medium uppercase tracking-wider text-white">
                {tool.name}
              </p>
            </div>
          </ImageLightbox>
        ))}
      </div>
    </section>
  );
}

/**
 * Decision-stage testimonials. Three short quotes pulled from the
 * landing page's testimonials section, rendered tighter so they fit
 * between the SKU grid and the guarantee block. Aagaard's testimonial
 * tests showed +35-65% lifts when proof sat in the F-pattern reading
 * zone immediately before the CTA.
 */
function PricingTestimonials() {
  return (
    <section className="mt-14">
      <h2 className="mb-5 text-xl font-medium text-white">From other readers</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {PRICING_TESTIMONIALS.map((q) => (
          <figure
            key={q.attribution}
            className="liquid-glass flex flex-col gap-4 rounded-2xl p-5"
          >
            <blockquote className="text-sm leading-relaxed text-gray-200 md:text-base">
              <span className="select-none text-white/20" aria-hidden="true">
                &ldquo;
              </span>
              {q.quote}
            </blockquote>
            <figcaption className="text-xs text-gray-500">
              <span className="font-medium text-gray-300">{q.attribution}</span>
              <span className="mx-2 text-white/20" aria-hidden="true">
                ·
              </span>
              {q.reading}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Guarantee detail block. Cheap, replicable conversion lift across
 * studies (Conversion Fanatics +21%, Conversion Rate Experts +49%,
 * Drip +41%). The 30-day window matches the industry default for
 * digital deliverables; refund volume tends to settle around 12% even
 * at long windows. Refunds are processed manually for now — flip the
 * support email to a self-serve callable later if volume warrants.
 */
function GuaranteeBlock() {
  return (
    <section
      id="guarantee"
      className="liquid-glass mt-14 rounded-2xl p-6 md:p-8"
    >
      <div className="mb-3 flex items-center gap-3">
        <RotateCcw className="h-5 w-5 text-white" />
        <h3 className="text-lg font-medium text-white">
          {GUARANTEE_WINDOW_DAYS}-day satisfaction guarantee
        </h3>
      </div>
      <div className="space-y-3 text-sm text-gray-300 md:text-base">
        <p>
          If a reading doesn't land for you, email us within{" "}
          {GUARANTEE_WINDOW_DAYS} days and we'll refund the unused balance —
          no forms, no questions about which way the moon was facing.
        </p>
        <p className="inline-flex items-center gap-2 text-gray-400">
          <Mail className="h-4 w-4" aria-hidden="true" />
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-white underline-offset-2 transition-colors hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const {
    user,
    initialized: firebaseInitialized,
    loading: firebaseLoading,
  } = useFirebase();
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [packageIdLoading, setPackageIdLoading] = useState<string | null>(
    null,
  );
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new URLSearchParams(window.location.search).get("next");
    setReturnPath(getSafeReturnPath(next));
  }, []);

  useEffect(() => {
    if (firebaseInitialized && !firebaseLoading && !user) {
      const next =
        typeof window !== "undefined"
          ? getSafeReturnPath(new URLSearchParams(window.location.search).get("next"))
          : null;
      const creditsPath = next
        ? `/credits?next=${encodeURIComponent(next)}`
        : "/credits";
      router.replace(`/login?next=${encodeURIComponent(creditsPath)}`);
    }
  }, [firebaseInitialized, firebaseLoading, user, router]);

  useEffect(() => {
    async function loadUserCredits() {
      if (!firebaseInitialized || firebaseLoading) {
        return;
      }
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const userCredits = await getUserCredits(user.uid);
        setCredits(userCredits.balance);

        const db = getFirestore();
        const eventsRef = collection(
          db,
          "userCredits",
          user.uid,
          "usageEvents",
        );
        const eventsQ = query(eventsRef, orderBy("date", "desc"), limit(100));
        const eventsSnap = await getDocs(eventsQ);
        const usageEvents = eventsSnap.docs.map((d) => d.data());
        setUsageHistory(usageEvents);

        const sortedPurchaseHistory = userCredits.purchaseHistory || [];
        sortedPurchaseHistory.sort(
          (a: any, b: any) => tsToMillis(b.purchaseDate) - tsToMillis(a.purchaseDate),
        );
        setPurchaseHistory(sortedPurchaseHistory);
      } catch (err) {
        console.error("Error loading user credits:", err);
        setError("Failed to load your credits. Please try refreshing.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUserCredits();
  }, [user, firebaseInitialized, firebaseLoading]);

  const formatHistoryDate = (timestamp: any) => {
    if (!timestamp) return "Unknown date";
    let date: Date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date();
    }
    return (
      date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handlePurchaseCredits = async (packageId: string) => {
    if (!user) {
      toast.error("You must be signed in to top up");
      return;
    }

    const creditPackage = CREDIT_PACKAGES.find((pkg) => pkg.id === packageId);
    if (!creditPackage) {
      toast.error("Invalid pack selected");
      return;
    }

    setPackageIdLoading(packageId);
    setError("");

    // Funnel-gap instrumentation. Fires the moment a user commits to a
    // pack on /credits, BEFORE we wait on Cloud Functions / Stripe — so
    // Clarity records intent even if the network call hangs or the user
    // bounces during the spinner.
    trackClickedBuyNow({
      packageId: creditPackage.id,
      valueCents: creditPackage.price,
    });

    try {
      const functions = getFunctions();
      const createCreditCheckout = httpsCallable(
        functions,
        "createCreditCheckout",
      );
      const origin =
        typeof window !== "undefined" ? window.location.origin : null;

      // Generate the event_id once here; it will:
      //   1) be passed to createCreditCheckout, which stores it on the
      //      Stripe session metadata (`fbEventId`) so Phase-4 CAPI mirror
      //      can echo it from the webhook.
      //   2) be passed to trackInitiateCheckout RIGHT NOW so Pixel records
      //      the same id Phase-4 CAPI will echo.
      //   3) be stashed in localStorage so the post-redirect dashboard
      //      Purchase emit re-uses the same id (full Pixel ↔ CAPI dedup
      //      across the redirect boundary).
      // Result: Pixel + CAPI dedupe end-to-end on a single event_id.
      const checkoutEventId = newEventId();
      try {
        // Map keyed by packageId — supports two-tab checkouts where the
        // user dispatches different packs from different tabs. The dashboard
        // looks up the entry that matches the just-completed purchase's
        // packageId, so a stale entry for a different pack doesn't get
        // mis-applied. Bounded to 3 entries (one per pack id), so growth is
        // not a concern. Per-entry TTL is 1h.
        const SLOT_KEY = "sic_pending_fb_event_ids";
        let slot: Record<string, { id: string; createdAt: number }> = {};
        try {
          const raw = window.localStorage.getItem(SLOT_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              slot = parsed as Record<string, { id: string; createdAt: number }>;
            }
          }
        } catch {
          /* corrupt slot — overwrite below */
        }
        slot[creditPackage.id] = { id: checkoutEventId, createdAt: Date.now() };
        window.localStorage.setItem(SLOT_KEY, JSON.stringify(slot));
      } catch {
        /* private mode — Phase-4 CAPI will still dedupe on its end via
           session.metadata.fbEventId; client-side will fire a fresh id and
           potentially double-count, which is acceptable */
      }

      const result = await createCreditCheckout({
        packageId: creditPackage.id,
        origin,
        fbEventId: checkoutEventId,
        returnPath,
      });

      const data = result.data as any;
      if (!data || !data.sessionId) {
        throw new Error("Checkout session ID not received from server");
      }

      const sessionId = data.sessionId;
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripePublicKey) {
        throw new Error("Stripe public key is not configured");
      }

      const stripe = await loadStripe(stripePublicKey);
      if (!stripe) {
        throw new Error("Failed to load Stripe library");
      }

      // Fire InitiateCheckout BEFORE redirect — once we redirect to Stripe,
      // the Pixel won't have a chance to flush. fbq queues internally so
      // even sub-millisecond before navigation it'll send.
      trackInitiateCheckout({
        packageId: creditPackage.id,
        valueCents: creditPackage.price,
        numItems: creditPackage.credits,
        eventId: checkoutEventId,
      });

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError);
        throw new Error(
          `Payment Error: ${stripeError.message || "Could not process payment"}`,
        );
      }
    } catch (err: any) {
      console.error("Credit purchase failed:", err);
      const message =
        err?.message || "Failed to process payment. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setPackageIdLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <PageHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-sm">Loading your readings…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <PageHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="liquid-glass mx-auto max-w-md rounded-2xl p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-normal tracking-[-0.02em]">
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Please sign in to top up your readings.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const combinedHistory = [
    ...purchaseHistory.map((purchase) => ({
      type: "purchase" as const,
      date: purchase.purchaseDate,
      amount: purchase.creditAmount,
      details: purchase.isInitialCredits
        ? "Welcome reading on us"
        : purchase.creditAmount === 1
          ? "Single Issue — 1 reading"
          : `Pack of ${purchase.creditAmount} readings`,
      isInitialCredits: !!purchase.isInitialCredits,
    })),
    ...usageHistory.map((usage: any) => ({
      type: "usage" as const,
      date: usage.date,
      amount: usage.type === "refund" ? usage.cost : -(usage.cost ?? 1),
      details:
        usage.type === "refund"
          ? `Refund (${usage.toolId || "reading"})`
          : `${usage.toolId || "reading"}`,
      isInitialCredits: false,
    })),
  ].sort((a, b) => tsToMillis(b.date) - tsToMillis(a.date));

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Readings
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Pick your{" "}
              <span className="italic font-light text-gray-400">pack.</span>
            </h1>
            <p className="mt-3 text-base text-gray-400 md:text-lg">
              Single readings, three, or six. Pay-as-you-go — no
              subscription, no expiry, no surprise charges.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-gray-300">Current balance:</span>
              <span className="font-medium text-white">
                {formatCreditBalance(credits)}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
              <div>
                <p className="font-medium">Error</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}

          <TrustBadgesRow />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => {
              // The middle pack is the visual anchor / "most loved"
              const isHighlight = pkg.id === "trio";
              const tier = PACK_TIER_LABELS[pkg.id] ?? { title: "" };
              const isLoading = packageIdLoading === pkg.id;
              const perReading = (pkg.pricePerCredit / 100).toFixed(2);
              const packTotal = (pkg.price / 100).toFixed(2);
              return (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
                    isHighlight
                      ? "bg-white text-black ring-2 ring-white"
                      : "liquid-glass text-white"
                  }`}
                >
                  {/* Top-line tier label — sits at the top of every card so
                      the "Most popular / Try one / Gift-ready" framing is
                      what the eye lands on first. The "Save X%" discount
                      badge floats next to it as a separate chip. */}
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-xs font-medium uppercase tracking-wider ${
                        isHighlight ? "text-gray-700" : "text-gray-300"
                      }`}
                    >
                      {tier.title}
                    </span>
                    {tier.badge && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          isHighlight
                            ? "bg-black text-white"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {tier.badge}
                      </span>
                    )}
                  </div>

                  {/* Per-reading price BIG. Pack total + count smaller below.
                      The single most-actionable number for a first-time
                      buyer comparing packs is the per-unit cost — anchor it. */}
                  <div className="mt-5 flex items-baseline gap-1">
                    <span
                      className="text-5xl font-normal"
                      style={{ letterSpacing: "-0.03em" }}
                    >
                      ${perReading}
                    </span>
                    <span
                      className={`text-sm ${
                        isHighlight ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      / reading
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-sm ${
                      isHighlight ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    ${packTotal} for{" "}
                    {pkg.credits === 1
                      ? "1 reading"
                      : `${pkg.credits} readings`}
                  </div>

                  {/* One differentiator bullet only — the previous
                      three-bullet stack had near-identical content across
                      tiers and just made the cards harder to scan. */}
                  <ul
                    className={`mt-5 flex-1 space-y-2 text-sm ${
                      isHighlight ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    <li className="flex items-start gap-2">
                      <CheckCircle
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          isHighlight ? "text-black" : "text-white"
                        }`}
                      />
                      <span>
                        {pkg.id === "single"
                          ? "Try a single editorial reading"
                          : pkg.id === "trio"
                            ? "Three readings to mix and match"
                            : "Six readings at the lowest per-reading price"}
                      </span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={isLoading}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-60 ${
                      isHighlight
                        ? "bg-black text-white hover:bg-gray-900"
                        : "bg-white text-black hover:bg-gray-200"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Buy now
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <SampleOutputReel />

          <PricingTestimonials />

          <GuaranteeBlock />

          <div className="liquid-glass mt-14 rounded-2xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-white" />
              <h3 className="text-lg font-medium text-white">
                How it works
              </h3>
            </div>
            <div className="space-y-3 text-sm text-gray-300 md:text-base">
              <p>
                Pick a pack, then spend it on any editorial reading on the
                site (palm, face, beauty report, color analysis, hairstyle
                analysis, aura, iridology, handwriting, style audit, skincare).
              </p>
              <p>
                Readings never expire, there's no subscription, and you can
                come back any time.
              </p>
            </div>
          </div>

          <div className="mt-14">
            <div className="mb-5 flex items-center gap-3">
              <Clock className="h-5 w-5 text-white" />
              <h2 className="text-xl font-medium text-white">
                Transaction history
              </h2>
            </div>

            {combinedHistory.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-10 text-center text-sm text-gray-400">
                Nothing yet. Once you read a photo or top up, your transactions
                will appear here.
              </div>
            ) : (
              <div className="liquid-glass overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="p-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                          Date
                        </th>
                        <th className="p-4 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                          Transaction
                        </th>
                        <th className="p-4 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                          Readings
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedHistory.map((item, index) => (
                        <tr
                          key={`${item.type}-${index}`}
                          className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="p-4 text-sm text-gray-300">
                            {formatHistoryDate(item.date)}
                          </td>
                          <td className="p-4 text-sm text-gray-300">
                            {item.isInitialCredits ? (
                              <span className="inline-flex items-center gap-1.5 text-white">
                                <Sparkles className="h-3.5 w-3.5" />
                                {item.details}
                              </span>
                            ) : (
                              item.details
                            )}
                          </td>
                          <td className="p-4 text-right text-sm">
                            <span
                              className={`inline-flex items-center justify-end gap-1 ${
                                item.amount > 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {item.amount > 0 ? (
                                <>
                                  <Plus className="h-3 w-3" />
                                  {item.amount}
                                </>
                              ) : (
                                <>
                                  <Minus className="h-3 w-3" />
                                  {Math.abs(item.amount)}
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
