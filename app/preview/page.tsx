"use client"

import { useState, useEffect, useRef, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, AlertTriangle, CreditCard, Lock, Loader2, ShoppingCart, Eye, CheckCircle } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, doc, getDoc, collection, query, getDocs, orderBy, limit, updateDoc, serverTimestamp, where, deleteDoc } from "firebase/firestore"
import { ref, getDownloadURL, deleteObject, listAll } from "firebase/storage"
import { getConfiguredStorage, getSignedDownloadURL } from "@/app/firebase/storage-helpers"
import { toast } from "sonner"
import { PathImg } from "@/components/ui/pathed-image"
import { getFunctions, httpsCallable } from "firebase/functions"
import { loadStripe } from "@stripe/stripe-js"

// Define interface for preview data
interface PreviewData {
  id: string;
  title: string;
  productType: string;
  date: string;
  price: string;
  pageId: string;
  processedImageUrl: string | null;
  pageCount: number;
}

// Define interface for project data relevant to checkout
interface ProjectCheckoutData {
    id: string;
    userId: string;
    pageCount: number;
    artStyle: string; // Keep for context if needed
    status: string; // e.g., 'draft', 'ordered'
}

const PRICE_PER_PAGE_CENTS = 200; // $2.00

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PreviewPageContent />
    </Suspense>
  )
}

function PreviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("id")

  const [isLoading, setIsLoading] = useState(true)
  const [isProcessed, setIsProcessed] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isPaymentLoading, setIsPaymentLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Initialize Firebase context
  const firebaseContext = useFirebase()
  const { user, initialized: firebaseInitialized } = firebaseContext || { user: null, initialized: false }

  // Debug hook to see when previewData changes
  useEffect(() => {
    if (projectId && previewData) {
      // Remove detailed debug logging
    }
  }, [projectId, previewData]);

  // Effect to handle redirecting unauthenticated users
  useEffect(() => {
    if (firebaseInitialized && !user && projectId) {
      // If firebase is ready, user is not logged in, and we have a project ID
      setIsRedirecting(true) // Set redirecting state
      const redirectUrl = `/login?redirect=${encodeURIComponent(`/preview?id=${projectId}`)}`;
      console.log("User not logged in, redirecting to:", redirectUrl);
      router.push(redirectUrl);
    }
  }, [firebaseInitialized, user, router, projectId]);

  // Load project data from Firebase
  useEffect(() => {
    // Skip Firebase calls during SSR
    if (typeof window === "undefined") return

    const loadPreviewData = async () => {
      if (!firebaseInitialized || !user || !projectId) {
        if (!projectId) {
          setError("No project ID provided")
        } else if (!user) {
          setError("Please log in to view this project")
          console.error("No user available when trying to load preview for project", projectId);
        } else if (!firebaseInitialized) {
          setError("Firebase is initializing, please wait")
          console.error("Firebase not initialized when trying to load preview for project", projectId);
        }
        setIsLoading(false)
        setLoading(false) // Update both loading states
        return
      }

      setIsLoading(true)
      setLoading(true) // Set both loading states
      setError("")

      try {
        // Add debug for troubleshooting
        console.log("Starting to load preview data", { projectId, uid: user.uid });
        
        const db = getFirestore()

        // Get project metadata
        const projectRef = doc(db, "users", user.uid, "projects", projectId)
        console.log("Trying to fetch project document");
        const projectSnap = await getDoc(projectRef).catch(err => {
          console.error("Error fetching project document:", err);
          throw new Error(`Failed to get project: ${err.message}`);
        });

        if (!projectSnap.exists()) {
          console.error("Project document not found");
          setError("Project not found")
          setIsLoading(false)
          setLoading(false) // Update both loading states
          return
        }

        console.log("Project document found");
        const projectData = projectSnap.data()
        
        // Check if the project has a pages array
        if (projectData.pages && Array.isArray(projectData.pages) && projectData.pages.length > 0) {
          console.log("Using pages array from project document");
          
          // Get the first page from the array
          const firstPage = projectData.pages.find(page => page.pageNumber === 1) || projectData.pages[0];
          const pageId = firstPage.id || "";
          
          // Check if the page has been processed
          const processedStatus = firstPage.processed || false;
          setIsProcessed(processedStatus);
          
          // Get the processed image URL if available
          let processedImageUrl = null;
          if (processedStatus) {
            // First check if the processed image URL is directly available in the page data
            if (firstPage.processedImageUrl) {
              console.log("Using direct processedImageUrl from page data");
              processedImageUrl = firstPage.processedImageUrl;
            } 
            // Otherwise try to get it from the processedImagePath
            else if (firstPage.processedImagePath) {
              try {
                const storage = getConfiguredStorage();
                console.log("Fetching processedImageUrl from path:", firstPage.processedImagePath);
                processedImageUrl = await getSignedDownloadURL(firstPage.processedImagePath);
              } catch (imageError) {
                console.error("Error fetching processed image:", imageError);
                // Continue without the image
              }
            }
          }
          
          // Always normalize product type to lowercase for consistency
          const productType = (projectData.productType || "standard").toLowerCase();
          console.log("Final product type:", productType);
          
          // Create preview data object with all necessary fallbacks
          const previewDataObject = {
            id: projectId,
            title: projectData.title || "Untitled Project",
            productType: productType,
            date: projectData.createdAt ? new Date(projectData.createdAt.toDate()).toLocaleDateString() : "Unknown date",
            price: getProductPrice(productType),
            pageId: pageId,
            processedImageUrl: processedImageUrl,
            pageCount: projectData.pages?.length || 0,
          };
          
          // Set the preview data
          setPreviewData(previewDataObject);
          
          // Debug log the preview data
          console.log("Preview data set successfully:", {
            id: previewDataObject.id,
            productType: previewDataObject.productType,
            price: previewDataObject.price,
            hasImage: !!previewDataObject.processedImageUrl
          });
          
          // Explicitly set loading false here on success
          console.log("[loadPreviewData] Success (from pages)! Setting loading = false.");
          setIsLoading(false);
          setLoading(false); // Update both loading states
          
          return; // Exit after successfully setting data from pages array
        } 
        // If no pages array in project, show fallback
        else {
          console.log("No pages array found in project document");
          // Create fallback data
          const defaultProductType = (projectData.productType || "standard").toLowerCase();
          console.log("Using default product type:", defaultProductType);
          
          // Mark as not processed to show the "processing" UI
          setIsProcessed(false);
          
          // Create preview data with fallbacks
          const previewDataObject = {
            id: projectId,
            title: projectData.title || "Untitled Project",
            productType: defaultProductType,
            date: projectData.createdAt ? new Date(projectData.createdAt.toDate()).toLocaleDateString() : new Date().toLocaleDateString(),
            price: getProductPrice(defaultProductType),
            pageId: "",
            processedImageUrl: null,
            pageCount: projectData.pages?.length || 0,
          };
          
          // Set the preview data
          setPreviewData(previewDataObject);
          
          console.log("Set fallback preview data without pages:", {
            id: previewDataObject.id,
            productType: previewDataObject.productType,
            price: previewDataObject.price
          });
          
          // Explicitly set loading false here after setting fallback data
          console.log("[loadPreviewData] Success (fallback)! Setting loading = false.");
          setIsLoading(false);
          setLoading(false); // Update both loading states
          
          return; // Exit after setting fallback data
        }
      } catch (error) {
        console.error("Error loading preview data:", error)
        setError("Failed to load preview data. Please try again.")
        // Set a basic preview data object even on error for checkout functionality
        if (projectId) {
          const fallbackData = {
            id: projectId,
            title: "Untitled Project",
            productType: "standard",
            date: new Date().toLocaleDateString(),
            price: "$24.90",
            pageId: "",
            processedImageUrl: null,
            pageCount: 0,
          };
          console.log("Setting fallback preview data due to error");
          setPreviewData(fallbackData);
        }
      } finally {
        console.log("[loadPreviewData] Finally block reached. Setting loading = false.");
        setIsLoading(false)
        setLoading(false) // Update both loading states
      }
    }

    loadPreviewData()
  }, [firebaseInitialized, user, projectId])

  // Helper function to get product price based on type
  const getProductPrice = (productType: string): string => {
    // Always default to standard if missing and ensure lowercase
    const type = productType ? productType.toLowerCase() : "standard";
    
    switch (type) {
      case "standard":
        return "$24.90"
      case "premium":
        return "$39.50"
      case "pdf":
      case "digital":
        return "$9.90"
      default:
        return "$24.90" // Default to standard price
    }
  }

  // // Helper to format product name for display (Commented out as likely unused)
  // const formatProductName = (productType: string): string => {
  //   const type = productType.toLowerCase();
  //   
  //   switch (type) {
  //     case "standard":
  //       return "Standard Coloring Book";
  //     case "premium":
  //       return "Premium Coloring Book";
  //     case "pdf":
  //     case "digital":
  //       return "Digital Coloring Book";
  //     default:
  //       return "Standard Coloring Book";
  //   }
  // }

  // Calculate price 
  const totalPriceCents = previewData ? previewData.pageCount * PRICE_PER_PAGE_CENTS : 0;
  const totalPriceFormatted = (totalPriceCents / 100).toFixed(2);

  // Simplified handleCheckout function
  const handleCheckout = async () => {
    if (!user || !previewData) {
      toast.error("Cannot proceed: Project data not loaded or user not logged in.");
      return;
    }
    if (previewData.pageCount <= 0) {
       toast.error("Your project has no pages. Please add pages before ordering.");
       return;
    }

    setIsPaymentLoading(true);
    setError("");
    console.log(`Initiating checkout for project: ${previewData.id}`);

    try {
      const functions = getFunctions();
      const createCheckout = httpsCallable(functions, 'createStripeCheckout');

      console.log("Calling createStripeCheckout function...");
      // Send projectId and current origin
      const origin = typeof window !== 'undefined' ? window.location.origin : null;
      console.log(`Current origin: ${origin}`);
      
      const result = await createCheckout({
        projectId: previewData.id,
        origin: origin
      });

      const data = result.data as any; // Cast carefully
      console.log("Cloud function response:", data);

      if (!data || !data.sessionId) {
        throw new Error("Checkout session ID not received from server.");
      }

      // Redirect to Stripe checkout
      const sessionId = data.sessionId;
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripePublicKey) {
          throw new Error("Stripe public key is not configured.");
      }
      const stripe = await loadStripe(stripePublicKey);
      if (!stripe) {
        throw new Error('Failed to load Stripe library.');
      }

      toast.info(
        "You will be redirected to Stripe to complete your payment securely.",
        { duration: 5000 }
      );

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError);
        // Display error based on Stripe's message
        throw new Error(`Stripe Error: ${stripeError.message || 'Could not redirect to checkout.'}`);
      }
      // If redirectToCheckout succeeds, the user is redirected.

    } catch (error: any) {
      console.error("Checkout failed:", error);
      const message = error?.message || "Failed to initiate checkout. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Log state variables just before the loading check
  console.log('[Preview Render Check]', { loading, firebaseInitialized, isRedirecting });

  if (!projectId) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
          <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Dashboard</span>
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
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="rounded-full bg-red-100 p-4 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Project Selected</h2>
              <p className="text-gray-500 mb-4">Please select a project from your dashboard to preview.</p>
              <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (loading || !firebaseInitialized || isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        {isRedirecting ? (
          <p className="text-gray-500">Redirecting to login...</p>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            <p className="mt-4 text-gray-500">Loading project preview...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dashboard</span>
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
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Order Your Coloring Book</h1>
            </div>
            <p className="text-gray-500">
              Review your order details below and proceed to checkout.
            </p>
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

          <div className="max-w-2xl mx-auto">
            <div>
              <Card>
                <CardHeader className="bg-blue-50">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <CardTitle>Complete Your Purchase</CardTitle>
                  </div>
                  <CardDescription>Confirm your custom coloring book order</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {previewData?.title || 'Custom Coloring Book'} ({previewData?.pageCount || 0} Pages)
                      </span>
                      <span className="font-bold text-lg">${totalPriceFormatted}</span>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Payment Details</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Lock className="h-3 w-3" />
                          Secure Payment
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <p className="text-sm text-gray-700 mb-4">
                          You'll be redirected to Stripe to complete your purchase securely. Your payment information is
                          never stored on our servers.
                        </p>

                        <Button
                          onClick={handleCheckout}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                          disabled={isPaymentLoading || !previewData || previewData.pageCount <= 0}
                        >
                          {isPaymentLoading ? (
                            <>
                              <Loader2 className="animate-spin h-5 w-5 mr-2" />
                              Processing...
                            </>
                          ) : (
                            `Proceed to Checkout • $${totalPriceFormatted}`
                          )}
                        </Button>
                      </div>

                      <div className="text-xs text-gray-500 text-center">
                        <p>By completing this purchase, you agree to our</p>
                        <p>
                          <Link href="/terms" className="text-blue-500 hover:underline">
                            Terms of Service
                          </Link>
                          {" and "}
                          <Link href="/privacy" className="text-blue-500 hover:underline">
                            Privacy Policy
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-4 flex justify-center">
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/create?id=${projectId}`)}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
                  size="sm"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Not ready yet? Return to editor to make changes</span>
                </Button>
              </div>

              {!isProcessed && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-700">
                      <p className="font-medium mb-1">Instant Coloring Page Generation</p>
                      <p>
                        Your coloring pages will be generated instantaneously after checkout. Once processed, you'll be able to download and print your custom coloring book immediately.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
              <p className="text-xs text-gray-500">© 2023 StoryInColor. All rights reserved.</p>
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

// Trigger rebuild with new Stripe key
