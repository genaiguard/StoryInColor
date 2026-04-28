"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, CheckCircle, AlertTriangle, ArrowLeft, Shield, Sparkles, Clock, Plus, Minus } from "lucide-react"
import { toast } from "sonner"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getUserCredits, CREDIT_PACKAGES, formatCreditBalance } from "@/app/firebase/credits-helpers"
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { loadStripe } from "@stripe/stripe-js"

export default function CreditsPage() {
  const router = useRouter()
  const { user, initialized: firebaseInitialized } = useFirebase()
  const [isLoading, setIsLoading] = useState(true)
  const [credits, setCredits] = useState(0)
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [error, setError] = useState("")
  const [firstActivityTimestamp, setFirstActivityTimestamp] = useState<any>(null)
  const [packageIdLoading, setPackageIdLoading] = useState<string | null>(null)

  // Auth gate: send unauthenticated visitors to /login (preserving intent)
  useEffect(() => {
    if (firebaseInitialized && !user) {
      router.replace("/login?next=/credits")
    }
  }, [firebaseInitialized, user, router])

  // Load user credits and history on mount
  useEffect(() => {
    async function loadUserCredits() {
      if (!user || !firebaseInitialized) {
        setIsLoading(false)
        return
      }

      try {
        const userCredits = await getUserCredits(user.uid)
        setCredits(userCredits.balance)

        // Usage events were migrated from a userCredits.usageHistory array to
        // a userCredits/{uid}/usageEvents/{deduct|refund-jobId} subcollection
        // (the array hit the 1MB doc cap on heavy users). Read from the
        // subcollection here. Limit 100 most-recent for display — full audit
        // is in the admin tools.
        const db = getFirestore()
        const eventsRef = collection(db, "userCredits", user.uid, "usageEvents")
        const eventsQ = query(eventsRef, orderBy("date", "desc"), limit(100))
        const eventsSnap = await getDocs(eventsQ)
        const usageEvents = eventsSnap.docs.map((d) => d.data())
        setUsageHistory(usageEvents)

        // Set purchase history (still on the parent doc — purchases are low-cardinality)
        const sortedPurchaseHistory = userCredits.purchaseHistory || []
        sortedPurchaseHistory.sort((a: any, b: any) => b.purchaseDate.seconds - a.purchaseDate.seconds)
        setPurchaseHistory(sortedPurchaseHistory)

        // Earliest timestamp across both streams for the "since you joined" footer
        let earliestTimestamp: any = null
        const oldestUsage = usageEvents.length > 0 ? usageEvents[usageEvents.length - 1].date : null
        const oldestPurchase = sortedPurchaseHistory.length > 0
          ? sortedPurchaseHistory[sortedPurchaseHistory.length - 1].purchaseDate
          : null
        if (oldestUsage && oldestPurchase) {
          earliestTimestamp = oldestUsage.seconds < oldestPurchase.seconds ? oldestUsage : oldestPurchase
        } else {
          earliestTimestamp = oldestUsage || oldestPurchase
        }
        setFirstActivityTimestamp(earliestTimestamp)
      } catch (error) {
        console.error("Error loading user credits:", error)
        setError("Failed to load your credits. Please try refreshing the page.")
      } finally {
        setIsLoading(false)
      }
    }

    loadUserCredits()
  }, [user, firebaseInitialized])

  // Helper function to format the date
  const formatHistoryDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    // Handle both timestamp objects with seconds and plain Date objects
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date();
    }
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
           date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const handlePurchaseCredits = async (packageId: string) => {
    if (!user) {
      toast.error("You must be signed in to purchase credits")
      return
    }

    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId)
    if (!creditPackage) {
      toast.error("Invalid credit package selected")
      return
    }

    setPackageIdLoading(packageId)
    setError("")

    try {
      const functions = getFunctions()
      const createCreditCheckout = httpsCallable(functions, 'createCreditCheckout')

      // Send packageId and current origin
      const origin = typeof window !== 'undefined' ? window.location.origin : null
      
      const result = await createCreditCheckout({
        packageId: creditPackage.id,
        origin
      })

      const data = result.data as any
      
      if (!data || !data.sessionId) {
        throw new Error("Checkout session ID not received from server")
      }

      // Redirect to Stripe checkout
      const sessionId = data.sessionId
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      
      if (!stripePublicKey) {
        throw new Error("Stripe public key is not configured")
      }
      
      const stripe = await loadStripe(stripePublicKey)
      
      if (!stripe) {
        throw new Error('Failed to load Stripe library')
      }

      toast.info(
        "You will be redirected to our payment processor to complete your purchase securely",
        { duration: 5000 }
      )
      
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId })

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError)
        throw new Error(`Payment Error: ${stripeError.message || 'Could not process payment'}`)
      }
    } catch (error: any) {
      console.error("Credit purchase failed:", error)
      const message = error?.message || "Failed to process payment. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setPackageIdLoading(null)
    }
  }

  if (isLoading) {
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
              <p className="text-gray-500">Loading your credits...</p>
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
              <p className="text-gray-500 mb-4">Please sign in to purchase credits.</p>
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Purchase Credits</h1>
            </div>
            <p className="text-gray-500">
              Coloring page = 1 credit. Each reading (palm reading, face reading, style audit, etc.) = 10 credits per generation.
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Your current balance: {formatCreditBalance(credits)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 mb-4 rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm text-orange-800">
            Coloring page = 1 credit. Readings = 10 credits.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CREDIT_PACKAGES.map(pkg => (
              <Card key={pkg.id} className="overflow-hidden">
                <CardHeader className={`bg-gradient-to-r ${
                  pkg.id === 'small' ? 'from-blue-50 to-blue-100' :
                  pkg.id === 'medium' ? 'from-green-50 to-green-100' :
                  pkg.id === 'large' ? 'from-purple-50 to-purple-100' :
                  'from-amber-50 to-amber-100'
                }`}>
                  <CardTitle>{formatCreditBalance(pkg.credits)}</CardTitle>
                  <CardDescription>
                    {pkg.discountPercentage > 0 ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Save {pkg.discountPercentage}%
                      </span>
                    ) : "Basic package"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">${(pkg.price / 100).toFixed(2)}</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>${(pkg.pricePerCredit / 100).toFixed(2)} per credit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>
                        {pkg.id === 'small'
                          ? '≈ 5 coloring pages — readings need 10 credits'
                          : pkg.id === 'medium'
                          ? '≈ 10 coloring pages OR 1 reading'
                          : pkg.id === 'large'
                          ? '≈ 20 coloring pages OR 2 readings'
                          : '≈ 40 coloring pages OR 4 readings'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Credits never expire</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 pt-0">
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={packageIdLoading === pkg.id}
                  >
                    {packageIdLoading === pkg.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="mt-12 bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <h3 className="font-medium text-lg">About Credits</h3>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>
                Coloring page = 1 credit. Each reading (palm reading, face reading, style audit, etc.) = 10 credits per generation.
              </p>
              <p>
                New users receive 2 free credits to try the service. After using your free credits, you'll need to purchase more to keep creating.
              </p>
              <p>
                Credits never expire and can be used across any tool on the platform.
              </p>
            </div>
          </div>
          
          {/* Credit History Section */}
          <div className="mt-12">
            <h2 className="text-xl md:text-2xl font-bold mb-6">Your Credit History</h2>
            
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="border-b">
                <div className="flex bg-gray-50 p-4">
                  <div className="flex gap-2 items-center">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium">Transaction History</h3>
                  </div>
                </div>
              </div>
              
              {usageHistory.length === 0 && purchaseHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No credit history yet. Once you use or purchase credits, your transactions will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-4 text-sm font-medium text-gray-500">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-500">Transaction</th>
                        <th className="text-right p-4 text-sm font-medium text-gray-500">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Combine and sort history */}
                      {[
                        ...purchaseHistory.map(purchase => ({
                          type: 'purchase',
                          date: purchase.purchaseDate,
                          amount: purchase.creditAmount,
                          details: purchase.isInitialCredits 
                            ? `Free initial credits` 
                            : `Purchased ${purchase.creditAmount} credits`,
                          packageId: purchase.packageId,
                          isInitialCredits: purchase.isInitialCredits
                        })),
                        ...usageHistory.map(usage => ({
                          type: 'usage',
                          date: usage.date,
                          amount: -1,
                          details: usage.projectId ? `Used for generation ${usage.projectId.slice(0, 8)}...` : 'Used for image generation',
                          isInitialCredits: false
                        }))
                      ]
                        .sort((a, b) => b.date.seconds - a.date.seconds)
                        .map((item, index) => (
                          <tr key={`${item.type}-${index}`} className={`border-b hover:bg-gray-50 ${item.isInitialCredits ? 'bg-blue-50' : ''}`}>
                            <td className="p-4 text-sm text-gray-700">{formatHistoryDate(item.date)}</td>
                            <td className="p-4 text-sm text-gray-700">
                              {item.isInitialCredits ? (
                                <span className="flex items-center gap-1 text-blue-700">
                                  <Sparkles className="h-3 w-3" />
                                  {item.details}
                                </span>
                              ) : (
                                item.details
                              )}
                            </td>
                            <td className="p-4 text-sm text-right">
                              <span className={`flex items-center justify-end gap-1 ${
                                item.isInitialCredits ? 'text-blue-600' : 
                                item.amount > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
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
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 
