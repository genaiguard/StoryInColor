"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Sparkles,
  Clock,
  Plus,
  Minus,
  Loader2,
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

function PageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
        <Link
          href="/"
          className="text-base font-semibold tracking-[-0.02em] text-white sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
      </div>
    </header>
  );
}

// Pack headlines correspond to package ids in CREDIT_PACKAGES.
// Keep these in sync with credits-helpers.ts.
const PACK_HEADLINES: Record<string, string> = {
  single: "Just one",
  trio: "Most loved",
  set: "Save 35%",
};

// What's actually in each pack, in plain language. Drives the bullet list
// on every card so the copy stays consistent across surfaces.
const PACK_BULLETS: Record<string, string> = {
  single: "One reading of your choice",
  trio: "Any three readings",
  set: "Any six readings — make it a gift",
};

export default function CreditsPage() {
  const router = useRouter();
  const { user, initialized: firebaseInitialized } = useFirebase();
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [packageIdLoading, setPackageIdLoading] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (firebaseInitialized && !user) {
      router.replace("/login?next=/credits");
    }
  }, [firebaseInitialized, user, router]);

  useEffect(() => {
    async function loadUserCredits() {
      if (!user || !firebaseInitialized) {
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
          (a: any, b: any) => b.purchaseDate.seconds - a.purchaseDate.seconds,
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
  }, [user, firebaseInitialized]);

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

    try {
      const functions = getFunctions();
      const createCreditCheckout = httpsCallable(
        functions,
        "createCreditCheckout",
      );
      const origin =
        typeof window !== "undefined" ? window.location.origin : null;

      const result = await createCreditCheckout({
        packageId: creditPackage.id,
        origin,
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

      toast.info(
        "You will be redirected to our payment processor to complete your purchase securely",
        { duration: 5000 },
      );

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
  ].sort((a, b) => b.date.seconds - a.date.seconds);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Readings
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Top up your{" "}
              <span className="italic font-light text-gray-400">balance.</span>
            </h1>
            <p className="mt-3 text-base text-gray-400 md:text-lg">
              One reading is one purchase — no subscriptions, no expiry, no
              surprise charges.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => {
              // The middle pack is the visual anchor / "most loved"
              const isHighlight = pkg.id === "trio";
              const headline = PACK_HEADLINES[pkg.id] ?? "";
              const isLoading = packageIdLoading === pkg.id;
              return (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
                    isHighlight
                      ? "bg-white text-black"
                      : "liquid-glass text-white"
                  }`}
                >
                  {isHighlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white">
                      {headline}
                    </span>
                  )}
                  <div
                    className={`text-sm ${
                      isHighlight ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    {pkg.credits === 1
                      ? "1 reading"
                      : `${pkg.credits} readings`}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="text-4xl font-normal"
                      style={{ letterSpacing: "-0.03em" }}
                    >
                      ${(pkg.price / 100).toFixed(2)}
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-sm ${
                      isHighlight ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    ${(pkg.pricePerCredit / 100).toFixed(2)} / reading
                  </div>
                  {!isHighlight && headline && (
                    <div className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-300">
                      {headline}
                    </div>
                  )}

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
                      <span>{PACK_BULLETS[pkg.id]}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          isHighlight ? "text-black" : "text-white"
                        }`}
                      />
                      <span>Editorial quality, print-ready</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          isHighlight ? "text-black" : "text-white"
                        }`}
                      />
                      <span>Never expire, no subscription</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={isLoading}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                      isHighlight
                        ? "bg-black text-white hover:bg-gray-900"
                        : "bg-white text-black hover:bg-gray-200"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
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

          <div className="liquid-glass mt-12 rounded-2xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-white" />
              <h3 className="text-lg font-medium text-white">
                How it works
              </h3>
            </div>
            <div className="space-y-3 text-sm text-gray-300 md:text-base">
              <p>
                One reading is one purchase — pick a pack, then spend it on any
                editorial reading on the site (palm, face, beauty report, aura,
                iridology, handwriting, style audit, skincare, plate, plant
                care, room vibes).
              </p>
              <p>
                Readings never expire, there's no subscription, and you can
                come back any time.
              </p>
            </div>
          </div>

          <div className="mt-12">
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
