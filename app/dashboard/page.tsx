"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, LogOut, Sparkles, AlertTriangle } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore"
import { getUserCredits, formatCreditBalance } from "@/app/firebase/credits-helpers"
import { ToolGrid } from "@/components/tools/tool-grid"
import { getToolById } from "@/lib/tools/registry"
import type { ToolCategory } from "@/lib/tools/types"
import { toast } from "sonner"
import { trackEvent } from "@/components/tracking/facebook-pixel"

// Generation doc as stored in users/{uid}/generations/{genId}
interface GenerationDoc {
  generationId: string
  jobId: string
  toolId: string
  outputStoragePath?: string
  outputDownloadUrl?: string
  createdAt?: any
}

// Format a Firestore timestamp into a small relative date like "2h ago"
const formatRelative = (timestamp: any): string => {
  if (!timestamp) return ""
  const ms =
    typeof timestamp?.seconds === "number"
      ? timestamp.seconds * 1000
      : typeof timestamp?.toDate === "function"
      ? timestamp.toDate().getTime()
      : typeof timestamp === "number"
      ? timestamp
      : NaN
  if (!Number.isFinite(ms)) return ""

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const CATEGORIES: Array<{ id: ToolCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "creative", label: "Creative" },
  { id: "mystical", label: "Mystical" },
  { id: "analysis", label: "Analysis" },
]

export default function DashboardPage() {
  const firebaseContext = useFirebase()
  const { user, initialized, logout } = firebaseContext

  // Credit balance
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true)
  const [isProcessingCreditPurchase, setIsProcessingCreditPurchase] = useState<boolean>(false)
  const [recentPurchaseDetected, setRecentPurchaseDetected] = useState<boolean>(false)
  const [pollingComplete, setPollingComplete] = useState<boolean>(false)

  // Generations
  const [generations, setGenerations] = useState<GenerationDoc[]>([])
  const [isLoadingGenerations, setIsLoadingGenerations] = useState<boolean>(true)
  const [generationsError, setGenerationsError] = useState<string>("")
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">("all")

  // Stripe redirect detection
  const searchParams = useSearchParams()
  const creditPurchaseSuccess = searchParams.get("credit_purchase") === "success"

  // Show processing banner immediately on Stripe redirect
  useEffect(() => {
    const acknowledgedSessionKey = "creditPurchaseAcknowledged"
    if (creditPurchaseSuccess) {
      const alreadyAcknowledged = sessionStorage.getItem(acknowledgedSessionKey) === "true"
      if (!alreadyAcknowledged) {
        setIsProcessingCreditPurchase(true)
        toast.info("Purchase detected! Checking for credits...", {
          duration: 10000,
          position: "top-center",
        })
      } else {
        setIsProcessingCreditPurchase(false)
      }
    }
  }, [creditPurchaseSuccess])

  // Load credits + poll for Stripe purchase completion
  useEffect(() => {
    const acknowledgedSessionKey = "creditPurchaseAcknowledged"

    const loadUserCredits = async () => {
      if (!user || !initialized) return

      try {
        setIsLoadingCredits(true)
        const userCredits = await getUserCredits(user.uid)
        setCredits(userCredits.balance)

        if (
          creditPurchaseSuccess &&
          !recentPurchaseDetected &&
          userCredits.purchaseHistory?.length > 0
        ) {
          const sortedPurchases = [...userCredits.purchaseHistory].sort(
            (a, b) =>
              new Date(b.purchaseDate.seconds * 1000).getTime() -
              new Date(a.purchaseDate.seconds * 1000).getTime()
          )
          const mostRecentPurchase = sortedPurchases[0]
          if (mostRecentPurchase) {
            const purchaseDate = new Date(mostRecentPurchase.purchaseDate.seconds * 1000)
            const today = new Date()
            const isToday =
              purchaseDate.getDate() === today.getDate() &&
              purchaseDate.getMonth() === today.getMonth() &&
              purchaseDate.getFullYear() === today.getFullYear()
            const isPaidPurchase = mostRecentPurchase.pricePaid > 0

            if (isToday && isPaidPurchase) {
              setRecentPurchaseDetected(true)
              setIsProcessingCreditPurchase(false)
              sessionStorage.setItem(acknowledgedSessionKey, "true")

              trackEvent("Purchase", {
                content_name: "Credit Purchase",
                content_category: "credits",
                value: mostRecentPurchase.pricePaid / 100,
                currency: "USD",
                num_items: mostRecentPurchase.creditAmount,
              })

              toast.success("Credits added successfully!")
            }
          }
        }
      } catch (error) {
        console.error("Error loading credits")
      } finally {
        setIsLoadingCredits(false)
      }
    }

    loadUserCredits()

    let intervalId: NodeJS.Timeout | null = null
    if (creditPurchaseSuccess && !recentPurchaseDetected && !pollingComplete) {
      setIsProcessingCreditPurchase(true)
      intervalId = setInterval(() => {
        loadUserCredits()
      }, 2000)
      const timeoutId = setTimeout(() => {
        if (intervalId) {
          clearInterval(intervalId)
          if (!recentPurchaseDetected) {
            setPollingComplete(true)
            setIsProcessingCreditPurchase(false)
            sessionStorage.setItem(acknowledgedSessionKey, "true")
            toast.info(
              "Your purchase is being processed. Credits will appear in your account shortly."
            )
          }
        }
      }, 30000)
      return () => {
        if (intervalId) clearInterval(intervalId)
        clearTimeout(timeoutId)
      }
    }
  }, [user, initialized, creditPurchaseSuccess, recentPurchaseDetected, pollingComplete])

  // Subscribe to recent generations
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!user || !initialized) return

    setIsLoadingGenerations(true)
    setGenerationsError("")

    let unsubscribe: (() => void) | undefined
    try {
      const db = getFirestore()
      const generationsRef = collection(db, "users", user.uid, "generations")
      const q = query(generationsRef, orderBy("createdAt", "desc"), limit(24))
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: GenerationDoc[] = snapshot.docs.map((d) => {
            const data = d.data() as Partial<GenerationDoc>
            return {
              generationId: data.generationId || d.id,
              jobId: data.jobId || "",
              toolId: data.toolId || "",
              outputStoragePath: data.outputStoragePath,
              outputDownloadUrl: data.outputDownloadUrl,
              createdAt: data.createdAt,
            }
          })
          setGenerations(items)
          setIsLoadingGenerations(false)
        },
        (err) => {
          console.error("Error subscribing to generations:", err)
          setGenerationsError("Failed to load recent generations.")
          setIsLoadingGenerations(false)
        }
      )
    } catch (err) {
      console.error("Error setting up generations listener:", err)
      setGenerationsError("Failed to load recent generations.")
      setIsLoadingGenerations(false)
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [user, initialized])

  const handleLogout = useCallback(() => {
    logout()
    window.location.href = "/"
  }, [logout])

  // Resolve display name
  const firstName = useMemo(() => {
    if (!user) return ""
    const displayName: string | undefined = user.displayName
    if (displayName && displayName.trim().length > 0) {
      return displayName.split(" ")[0]
    }
    const email: string | undefined = user.email
    if (email && email.includes("@")) {
      return email.split("@")[0]
    }
    return "there"
  }, [user])

  // Filter generations by active category
  const filteredGenerations = useMemo(() => {
    if (activeCategory === "all") return generations
    return generations.filter((g) => {
      const tool = getToolById(g.toolId)
      return tool?.category === activeCategory
    })
  }, [generations, activeCategory])

  if (!initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
          <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="flex-1 py-6 md:py-8 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-500">Loading your dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
          <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="flex-1 py-6 md:py-8 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="rounded-full bg-amber-100 p-4 mb-4">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Not Signed In</h2>
              <p className="text-gray-500 mb-4">Please sign in to view your dashboard.</p>
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            {!isLoadingCredits && (
              <Link
                href="/credits"
                className="flex items-center gap-1 mr-2 bg-blue-50 px-3 py-1.5 rounded-full text-sm cursor-pointer hover:bg-blue-100 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span>{formatCreditBalance(credits)}</span>
              </Link>
            )}
            <Button variant="outline" size="icon" className="rounded-full" asChild>
              <Link href="/dashboard/settings">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-7xl px-0 md:px-0">
          {/* Stripe purchase processing banner */}
          {isProcessingCreditPurchase && (
            <div className="mb-6 bg-blue-500 text-white border border-blue-600 rounded-lg p-6 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-b-transparent"></div>
                </div>
                <div>
                  <p className="font-bold mb-1 text-lg">Processing Credit Purchase</p>
                  <p>Your credit purchase is being processed. This may take a moment.</p>
                </div>
              </div>
            </div>
          )}

          {pollingComplete && !recentPurchaseDetected && creditPurchaseSuccess && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-sm text-amber-700">
                  <p className="font-medium mb-1">Purchase Processing</p>
                  <p>
                    Your purchase is being processed in the background. Credits will appear in your
                    account shortly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Welcome */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back, {firstName}.
            </h1>
            <p className="text-gray-500 mt-1">
              Pick a tool to get started, or revisit a recent creation below.
            </p>
          </div>

          {/* Tool grid */}
          <section className="mb-10 md:mb-12">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Choose a tool</h2>
            <ToolGrid showCategoryChips={false} />
          </section>

          {/* Recent generations */}
          <section className="mb-8">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Recent generations</h2>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((c) => {
                const on = activeCategory === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? "bg-orange-500 text-white"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            {isLoadingGenerations ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-gray-200 animate-pulse aspect-square"
                  ></div>
                ))}
              </div>
            ) : generationsError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium mb-1">Error</p>
                    <p>{generationsError}</p>
                  </div>
                </div>
              </div>
            ) : filteredGenerations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Your generations will appear here
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {generations.length === 0
                    ? "Pick a tool above and run your first photo to see it here."
                    : "Nothing yet in this category — try another filter or a new tool."}
                </p>
                <div className="mt-5">
                  <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Link href="/tools">Browse all tools</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredGenerations.map((gen) => {
                  const tool = getToolById(gen.toolId)
                  const href = tool
                    ? `/tools/${tool.slug}/result?jobId=${encodeURIComponent(gen.jobId)}`
                    : "#"
                  return (
                    <Link
                      key={gen.generationId}
                      href={href}
                      className="block rounded-lg overflow-hidden bg-white border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {gen.outputDownloadUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={gen.outputDownloadUrl}
                            alt={tool?.name || "Generation"}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            No preview
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {tool?.name || "Unknown tool"}
                        </div>
                        <div className="text-xs text-gray-500">{formatRelative(gen.createdAt)}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t bg-white mt-8">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:gap-2">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
              <p className="text-xs text-gray-500">© 2026 StoryInColor. All rights reserved.</p>
            </div>
            <nav className="flex gap-4 md:gap-6">
              <Link href="/terms" className="text-xs hover:underline underline-offset-4">
                Terms
              </Link>
              <Link href="/privacy" className="text-xs hover:underline underline-offset-4">
                Privacy
              </Link>
              <Link href="/contact" className="text-xs hover:underline underline-offset-4">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
