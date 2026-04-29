"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  LogOut,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useFirebase } from "@/app/firebase/firebase-provider";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import {
  getUserCredits,
  formatCreditBalance,
} from "@/app/firebase/credits-helpers";
import { ToolGrid } from "@/components/tools/tool-grid";
import { getToolById } from "@/lib/tools/registry";
import type { ToolCategory } from "@/lib/tools/types";
import { toast } from "sonner";
import { trackEvent } from "@/components/tracking/facebook-pixel";

interface JobDoc {
  generationId?: string;
  jobId: string;
  toolId: string;
  status?: "processing" | "complete" | "failed";
  outputStoragePath?: string;
  outputDownloadUrl?: string;
  error?: string;
  refunded?: boolean;
  createdAt?: any;
}

const formatRelative = (timestamp: any): string => {
  if (!timestamp) return "";
  const ms =
    typeof timestamp?.seconds === "number"
      ? timestamp.seconds * 1000
      : typeof timestamp?.toDate === "function"
      ? timestamp.toDate().getTime()
      : typeof timestamp === "number"
      ? timestamp
      : NaN;
  if (!Number.isFinite(ms)) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const CATEGORIES: Array<{ id: ToolCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "creative", label: "Creative" },
  { id: "mystical", label: "Mystical" },
  { id: "analysis", label: "Analysis" },
];

function DashboardHeader({
  credits,
  isLoadingCredits,
  onLogout,
}: {
  credits: number;
  isLoadingCredits: boolean;
  onLogout: () => void;
}) {
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
        <nav className="flex items-center gap-2 sm:gap-3">
          {!isLoadingCredits && (
            <Link
              href="/credits"
              className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <Sparkles className="h-4 w-4" />
              <span>{formatCreditBalance(credits)}</span>
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function DashboardFooter() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} StoryInColor. All rights reserved.
        </p>
        <nav className="flex gap-6">
          <Link
            href="/terms"
            className="text-xs text-gray-500 transition-colors hover:text-white"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-xs text-gray-500 transition-colors hover:text-white"
          >
            Privacy
          </Link>
          <Link
            href="/contact"
            className="text-xs text-gray-500 transition-colors hover:text-white"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default function DashboardPage() {
  const { user, initialized, logout } = useFirebase();

  const [credits, setCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  const [isProcessingCreditPurchase, setIsProcessingCreditPurchase] =
    useState<boolean>(false);
  const [recentPurchaseDetected, setRecentPurchaseDetected] =
    useState<boolean>(false);
  const [pollingComplete, setPollingComplete] = useState<boolean>(false);

  const [generations, setGenerations] = useState<JobDoc[]>([]);
  const [isLoadingGenerations, setIsLoadingGenerations] =
    useState<boolean>(true);
  const [generationsError, setGenerationsError] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">(
    "all",
  );

  const searchParams = useSearchParams();
  const creditPurchaseSuccess =
    searchParams.get("credit_purchase") === "success";

  useEffect(() => {
    const acknowledgedSessionKey = "creditPurchaseAcknowledged";
    if (creditPurchaseSuccess) {
      const alreadyAcknowledged =
        sessionStorage.getItem(acknowledgedSessionKey) === "true";
      if (!alreadyAcknowledged) {
        setIsProcessingCreditPurchase(true);
        toast.info("Purchase detected! Adding readings to your balance…", {
          duration: 10000,
          position: "top-center",
        });
      } else {
        setIsProcessingCreditPurchase(false);
      }
    }
  }, [creditPurchaseSuccess]);

  useEffect(() => {
    const acknowledgedSessionKey = "creditPurchaseAcknowledged";

    const loadUserCredits = async () => {
      if (!user || !initialized) return;

      try {
        setIsLoadingCredits(true);
        const userCredits = await getUserCredits(user.uid);
        setCredits(userCredits.balance);

        if (
          creditPurchaseSuccess &&
          !recentPurchaseDetected &&
          userCredits.purchaseHistory?.length > 0
        ) {
          const sortedPurchases = [...userCredits.purchaseHistory].sort(
            (a, b) =>
              new Date(b.purchaseDate.seconds * 1000).getTime() -
              new Date(a.purchaseDate.seconds * 1000).getTime(),
          );
          const mostRecentPurchase = sortedPurchases[0];
          if (mostRecentPurchase) {
            const purchaseDate = new Date(
              mostRecentPurchase.purchaseDate.seconds * 1000,
            );
            const today = new Date();
            const isToday =
              purchaseDate.getDate() === today.getDate() &&
              purchaseDate.getMonth() === today.getMonth() &&
              purchaseDate.getFullYear() === today.getFullYear();
            const isPaidPurchase = mostRecentPurchase.pricePaid > 0;

            if (isToday && isPaidPurchase) {
              setRecentPurchaseDetected(true);
              setIsProcessingCreditPurchase(false);
              sessionStorage.setItem(acknowledgedSessionKey, "true");

              trackEvent("Purchase", {
                content_name: "Credit Purchase",
                content_category: "credits",
                value: mostRecentPurchase.pricePaid / 100,
                currency: "USD",
                num_items: mostRecentPurchase.creditAmount,
              });

              toast.success("Credits added successfully!");
            }
          }
        }
      } catch (error) {
        console.error("Error loading credits");
      } finally {
        setIsLoadingCredits(false);
      }
    };

    loadUserCredits();

    let intervalId: NodeJS.Timeout | null = null;
    if (
      creditPurchaseSuccess &&
      !recentPurchaseDetected &&
      !pollingComplete
    ) {
      setIsProcessingCreditPurchase(true);
      intervalId = setInterval(() => {
        loadUserCredits();
      }, 2000);
      const timeoutId = setTimeout(() => {
        if (intervalId) {
          clearInterval(intervalId);
          if (!recentPurchaseDetected) {
            setPollingComplete(true);
            setIsProcessingCreditPurchase(false);
            sessionStorage.setItem(acknowledgedSessionKey, "true");
            toast.info(
              "Your purchase is being processed. Credits will appear in your account shortly.",
            );
          }
        }
      }, 30000);
      return () => {
        if (intervalId) clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [
    user,
    initialized,
    creditPurchaseSuccess,
    recentPurchaseDetected,
    pollingComplete,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user || !initialized) return;

    setIsLoadingGenerations(true);
    setGenerationsError("");

    let unsubscribe: (() => void) | undefined;
    try {
      const db = getFirestore();
      const jobsRef = collection(db, "users", user.uid, "jobs");
      const q = query(jobsRef, orderBy("createdAt", "desc"), limit(24));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: JobDoc[] = snapshot.docs.map((d) => {
            const data = d.data() as Partial<JobDoc>;
            return {
              generationId: data.generationId,
              jobId: data.jobId || d.id,
              toolId: data.toolId || "",
              status: data.status,
              outputStoragePath: data.outputStoragePath,
              outputDownloadUrl: data.outputDownloadUrl,
              error: data.error,
              refunded: data.refunded,
              createdAt: data.createdAt,
            };
          });
          setGenerations(items);
          setIsLoadingGenerations(false);
        },
        (err) => {
          console.error("Error subscribing to generations:", err);
          setGenerationsError("Failed to load recent generations.");
          setIsLoadingGenerations(false);
        },
      );
    } catch (err) {
      console.error("Error setting up generations listener:", err);
      setGenerationsError("Failed to load recent generations.");
      setIsLoadingGenerations(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, initialized]);

  const handleLogout = useCallback(() => {
    logout();
    window.location.href = "/";
  }, [logout]);

  const firstName = useMemo(() => {
    if (!user) return "";
    const displayName: string | undefined = user.displayName;
    if (displayName && displayName.trim().length > 0) {
      return displayName.split(" ")[0];
    }
    const email: string | undefined = user.email;
    if (email && email.includes("@")) {
      return email.split("@")[0];
    }
    return "there";
  }, [user]);

  const filteredGenerations = useMemo(() => {
    if (activeCategory === "all") return generations;
    return generations.filter((g) => {
      const tool = getToolById(g.toolId);
      return tool?.category === activeCategory;
    });
  }, [generations, activeCategory]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <DashboardHeader
          credits={0}
          isLoadingCredits
          onLogout={() => {}}
        />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-sm">Loading your dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <DashboardHeader
          credits={0}
          isLoadingCredits
          onLogout={() => {}}
        />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="liquid-glass mx-auto max-w-md rounded-2xl p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2
              className="text-2xl font-normal tracking-[-0.02em]"
            >
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Please sign in to view your dashboard.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <DashboardHeader
        credits={credits}
        isLoadingCredits={isLoadingCredits}
        onLogout={handleLogout}
      />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="container mx-auto max-w-7xl">
          {isProcessingCreditPurchase && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin text-white" />
              <div>
                <p className="font-medium text-white">
                  Processing credit purchase
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Your purchase is being processed. This may take a moment.
                </p>
              </div>
            </div>
          )}

          {pollingComplete &&
            !recentPurchaseDetected &&
            creditPurchaseSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 text-amber-100">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                <div>
                  <p className="font-medium">Purchase processing</p>
                  <p className="mt-1 text-sm text-amber-200/80">
                    Your purchase is being processed in the background.
                    Credits will appear in your account shortly.
                  </p>
                </div>
              </div>
            )}

          {/* Welcome */}
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Dashboard
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] text-white sm:text-4xl md:text-5xl"
            >
              Welcome back,{" "}
              <span className="italic font-light text-gray-400">
                {firstName}.
              </span>
            </h1>
            <p className="mt-3 text-base text-gray-400 md:text-lg">
              Pick a reading to get started, or revisit a recent creation
              below.
            </p>
          </div>

          <section className="mb-14">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-medium text-white">Choose a reading</h2>
              <Link
                href="/readings"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                See all →
              </Link>
            </div>
            <ToolGrid showCategoryChips={false} showCost />
          </section>

          <section className="mb-8">
            <div className="mb-5">
              <h2 className="text-xl font-medium text-white">
                Recent readings
              </h2>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      on
                        ? "bg-white text-black"
                        : "liquid-glass text-gray-200"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {isLoadingGenerations ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-xl bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : generationsError ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
                <div>
                  <p className="font-medium">Error</p>
                  <p className="mt-1">{generationsError}</p>
                </div>
              </div>
            ) : filteredGenerations.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-10 text-center">
                <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Sparkles className="h-5 w-5 text-white" />
                </span>
                <h3 className="text-lg font-medium text-white">
                  Your readings will appear here
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                  {generations.length === 0
                    ? "Pick a reading above and bring a photo to see it here."
                    : "Nothing yet in this category — try another filter or a new reading."}
                </p>
                <Link
                  href="/readings"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                >
                  Browse the reading room
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {filteredGenerations.map((gen) => {
                  const tool = getToolById(gen.toolId);
                  const href = tool
                    ? `/readings/${tool.slug}/result?jobId=${encodeURIComponent(gen.jobId)}`
                    : "#";
                  const isProcessing = gen.status === "processing";
                  const isFailed = gen.status === "failed";
                  return (
                    <Link
                      key={gen.jobId}
                      href={href}
                      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="relative aspect-square overflow-hidden bg-black">
                        {gen.outputDownloadUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={gen.outputDownloadUrl}
                            alt={tool?.name || "Generation"}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : isProcessing ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-300">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-xs font-medium">
                              Reading…
                            </span>
                          </div>
                        ) : isFailed ? (
                          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-amber-300">
                            Failed{gen.refunded ? " — refunded" : ""}
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                            No preview
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="truncate text-sm font-medium text-white">
                          {tool?.name || "Unknown reading"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatRelative(gen.createdAt)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <DashboardFooter />
    </div>
  );
}
