"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Eye, AlertTriangle, CheckCircle, CreditCard, Lock, Trash2 } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, doc, getDoc, collection, query, getDocs, orderBy, limit, updateDoc, serverTimestamp, where, deleteDoc } from "firebase/firestore"
import { ref, getDownloadURL, deleteObject, listAll } from "firebase/storage"
import { getConfiguredStorage, getDownloadURLWithRetry } from "@/app/firebase/storage-helpers"
import { toast } from "sonner"
import { PathImg } from "@/components/ui/pathed-image"
import { getFunctions } from "firebase/functions"
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
}

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

  // Initialize Firebase context
  const firebaseContext = useFirebase()
  const { user, initialized } = firebaseContext || { user: null, initialized: false }

  // Debug hook to see when previewData changes
  useEffect(() => {
    if (projectId && previewData) {
      // Remove detailed debug logging
    }
  }, [projectId, previewData]);

  // Load project data from Firebase
  useEffect(() => {
    // Skip Firebase calls during SSR
    if (typeof window === "undefined") return

    const loadPreviewData = async () => {
      if (!initialized || !user || !projectId) {
        if (!projectId) {
          setError("No project ID provided")
        } else if (!user) {
          setError("Please log in to view this project")
          console.error("No user available when trying to load preview for project", projectId);
        } else if (!initialized) {
          setError("Firebase is initializing, please wait")
          console.error("Firebase not initialized when trying to load preview for project", projectId);
        }
        setIsLoading(false)
        return
      }

      setIsLoading(true)
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
          return
        }

        console.log("Project document found");
        const projectData = projectSnap.data()

        // Get the first page from the project
        const pagesRef = collection(db, "users", user.uid, "projects", projectId, "pages")
        const pagesQuery = query(pagesRef, orderBy("pageNumber"), limit(1))
        console.log("Trying to fetch project pages");
        const pagesSnap = await getDocs(pagesQuery).catch(err => {
          console.error("Error fetching project pages:", err);
          throw new Error(`Failed to get project pages: ${err.message}`);
        });

        if (pagesSnap.empty) {
          console.log("No pages found yet - this is expected for new projects");
          // Create fallback data instead of showing an error
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
          };
          
          // Set the preview data
          setPreviewData(previewDataObject);
          
          console.log("Set fallback preview data without pages:", {
            id: previewDataObject.id,
            productType: previewDataObject.productType,
            price: previewDataObject.price
          });
          
          setIsLoading(false);
          return;
        }

        console.log("Project pages found");
        const firstPage = pagesSnap.docs[0].data()
        const pageId = pagesSnap.docs[0].id

        // Check if the page has been processed
        const processedStatus = firstPage.processed || false
        setIsProcessed(processedStatus)

        // Get the processed image URL if available
        let processedImageUrl = null
        if (processedStatus && firstPage.processedImagePath) {
          try {
            console.log("Trying to get processed image URL");
            const storage = getConfiguredStorage()
            // Use the enhanced function with retry capability
            processedImageUrl = await getDownloadURLWithRetry(firstPage.processedImagePath);
            console.log("Successfully got image URL");
          } catch (imageError) {
            console.error("Failed to load processed image:", imageError);
            // Continue without the image
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
            processedImageUrl: null
          };
          console.log("Setting fallback preview data due to error");
          setPreviewData(fallbackData);
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadPreviewData()
  }, [initialized, user, projectId])

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

  // Helper to format product name for display
  const formatProductName = (productType: string): string => {
    const type = productType.toLowerCase();
    
    switch (type) {
      case "standard":
        return "Standard Coloring Book";
      case "premium":
        return "Premium Coloring Book";
      case "pdf":
      case "digital":
        return "Digital Coloring Book";
      default:
        return "Standard Coloring Book";
    }
  }

  // Handle Stripe checkout
  const handleCheckout = async () => {
    if (!user) {
      console.error("Checkout failed: User not authenticated");
      toast.error("Please log in to checkout");
      return;
    }
    
    if (!projectId) {
      console.error("Checkout failed: Missing projectId");
      toast.error("Invalid project. Please return to dashboard and try again.");
      return;
    }

    // Initialize a default product type in case previewData is missing
    const defaultProductType = "standard";
    const defaultBookTitle = "Coloring Book";

    // Log whether we have preview data
    console.log("Starting checkout process", { 
      projectId, 
      hasPreviewData: !!previewData, 
      usingFallback: !previewData 
    });
    
    setIsPaymentLoading(true);
    setError("");

    try {
      // Always normalize product type to lowercase
      // Use a fallback if previewData is not available
      const productType = (previewData?.productType || defaultProductType).toLowerCase();
      console.log("Using product type for checkout:", { productType });
      
      // Use actual product name for better display in Stripe checkout
      const displayName = formatProductName(productType);
      const bookTitle = previewData?.title || defaultBookTitle;
      console.log("Using display name for checkout:", { displayName, bookTitle });
      
      // Call Firebase Function to create Stripe checkout session
      console.log("Getting Firebase functions");
      const functions = getFunctions();
      const functionUrl = `https://us-central1-storyincolor-ai.cloudfunctions.net/createCheckoutSession`;
      
      // Get a fresh ID token before making the request
      // This ensures the token hasn't expired
      const idToken = await user.getIdToken(true);  // Force token refresh
      
      // Use fallbacks when previewData is not available
      const checkoutParams = {
        projectId: projectId,
        productType: productType,
        title: bookTitle
      };
      
      console.log("Calling createCheckoutSession with params", checkoutParams);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        credentials: 'omit',  // Don't send credentials as we're sending the token in headers
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(checkoutParams)
      });
      
      if (!response.ok) {
        // Specifically handle authentication errors
        if (response.status === 401) {
          console.error("Authentication failed with Firebase. Trying to refresh session.");
          // Force sign out and back in if needed
          if (window.confirm("Your session has expired. Would you like to log in again?")) {
            await user.getIdToken(true); // Force refresh token
            throw new Error("Please try again after refreshing your session.");
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Redirect to Stripe checkout
      console.log("Checkout session created", result);
      const sessionId = result.sessionId;
      
      // Load Stripe
      console.log("Loading Stripe with publishable key");
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
      
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
      console.log("Redirecting to Stripe checkout", { sessionId });
      
      // Show a toast notification with instructions for Apple Pay users
      toast.info(
        "If you use Apple Pay and complete payment but remain on the checkout page, please close the tab and return to this page to see your order status.",
        { duration: 6000 }
      );
      
      // Use the original redirect approach (no popup blockers)
      const { error } = await stripe.redirectToCheckout({
        sessionId
      });
      
      if (error) {
        console.error("Stripe redirect error", error);
        throw error;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Failed to initiate checkout. Please try again.");
      setError("Failed to initiate checkout. Please try again.");
    } finally {
      setIsPaymentLoading(false);
    }
  }

  // Add a separate component to poll for completed payments
  // This will run on page load/refresh to detect if payment was completed but user got stuck
  useEffect(() => {
    // Skip during loading or if there's no user/project
    if (isLoading || !user || !projectId) return;
    
    // Only run this check if we're viewing a specific project (not on initial load)
    const checkPaymentStatus = async () => {
      try {
        // Check if the project status has been updated by the webhook
        const db = getFirestore();
        const projectRef = doc(db, "users", user.uid, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        
        if (projectSnap.exists()) {
          const projectData = projectSnap.data();
          
          // If the project has been marked as ordered, redirect to success page
          if (projectData.status === 'ordered' || projectData.status === 'payment_pending') {
            console.log("Payment already completed for this project, redirecting to success page");
            router.push(`/order-success?session_id=${projectData.paymentId || ""}`);
          }
        }
      } catch (checkError) {
        console.error("Error checking payment status:", checkError);
      }
    };
    
    checkPaymentStatus();
  }, [router, user, projectId, isLoading]);

  // Add global error handler to suppress 401 errors from Stripe resources
  useEffect(() => {
    // Create a function to suppress specific 401 errors in the console
    const suppressStripeErrors = (event: ErrorEvent) => {
      // Check if the error is related to 'authenticate' resource
      if (event.message && (
        event.message.includes('authenticate') || 
        event.message.includes('401')
      )) {
        // Prevent the error from appearing in the console
        event.preventDefault();
      }
    };

    // Add event listener for error events
    window.addEventListener('error', suppressStripeErrors);

    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('error', suppressStripeErrors);
    };
  }, []);

  // Handle delete project
  const handleDeleteProject = async () => {
    if (!user || !projectId) return

    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return
    }

    setIsDeleting(true)
    setError("")

    try {
      console.log("Starting project deletion process for project", projectId);
      const db = getFirestore()
      const storage = getConfiguredStorage();
      
      // Update project document to mark as deleted
      const projectRef = doc(db, "users", user.uid, "projects", projectId)
      
      // First check if the project exists
      console.log("Checking if project exists");
      const projectSnap = await getDoc(projectRef).catch(err => {
        console.error("Error fetching project for deletion:", err);
        throw new Error(`Failed to access project for deletion: ${err.message}`);
      });
      
      if (!projectSnap.exists()) {
        setError("Project not found. It may have been already deleted.");
        setIsDeleting(false);
        return;
      }
      
      // Get project data without logging it
      const projectData = projectSnap.data();
      
      // Check if already deleted
      if (projectData.deleted === true) {
        console.log("Project already marked as deleted");
        // Still redirect to dashboard
        router.push("/dashboard");
        return;
      }

      // Get the pages collection to find storage files
      console.log("Getting project pages to find storage files");
      const pagesRef = collection(db, "users", user.uid, "projects", projectId, "pages");
      const pagesSnap = await getDocs(pagesRef).catch(err => {
        console.error("Error fetching project pages for deletion:", err);
        throw new Error(`Failed to access project pages for deletion: ${err.message}`);
      });
      
      // Process all storage files that need to be deleted
      const deletePromises = [];
      const filesToDelete = [];
      
      // Log count without details
      console.log(`Processing ${pagesSnap.docs.length} pages for deletion`);
      
      // Collect files to delete
      pagesSnap.docs.forEach(pageDoc => {
        const pageData = pageDoc.data();
        
        // Check for original image storage path
        if (pageData.imagePath) {
          filesToDelete.push(pageData.imagePath);
          const imageRef = ref(storage, pageData.imagePath);
          deletePromises.push(deleteObject(imageRef).catch(err => {
            console.warn(`Could not delete file ${pageData.imagePath}:`, err.message);
            return null;
          }));
        }
        
        // Check for processed image storage path
        if (pageData.processedImagePath) {
          filesToDelete.push(pageData.processedImagePath);
          const processedRef = ref(storage, pageData.processedImagePath);
          deletePromises.push(deleteObject(processedRef).catch(err => {
            console.warn(`Could not delete file ${pageData.processedImagePath}:`, err.message);
            return null;
          }));
        }
      });
      
      // Check for project thumbnail
      if (projectData.thumbnailPath) {
        filesToDelete.push(projectData.thumbnailPath);
        const thumbnailRef = ref(storage, projectData.thumbnailPath);
        deletePromises.push(deleteObject(thumbnailRef).catch(err => {
          console.warn(`Could not delete thumbnail ${projectData.thumbnailPath}:`, err.message);
          return null;
        }));
      }
      
      // Wait for all deletes to complete
      if (deletePromises.length > 0) {
        console.log(`Attempting to delete ${deletePromises.length} files`);
        await Promise.all(deletePromises);
        console.log("Storage cleanup complete");
      } else {
        console.log("No storage files to delete");
      }
      
      // Update with deletion flag
      console.log("Marking project as deleted in database");
      await updateDoc(projectRef, {
        deleted: true,
        deletedAt: new Date()
      });
      
      console.log("Project marked as deleted successfully");

      // Redirect to dashboard after a short delay to ensure the update completes
      setTimeout(() => {
        router.push("/dashboard");
      }, 300);
    } catch (error: any) {
      console.error("Error deleting project:", error);
      setError(`Failed to delete project: ${error.message || "Unknown error"}`);
      setIsDeleting(false);
    }
  }

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

  if (isLoading) {
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-500">Loading your preview...</p>
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
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Preview Your Coloring Book</h1>
              
              {/* Delete button in content area */}
              {projectId && user && (
                <Button 
                  variant="destructive" 
                  size="default" 
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="flex items-center gap-1"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5 mr-1" />
                      Delete Project
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="text-gray-500">
              {isProcessed
                ? "Your first page has been processed and is ready for preview."
                : "Your first page is currently being processed. Check back in 1-2 days or wait for our email notification."}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side - Preview */}
            <div>
              <Card className="overflow-hidden">
                <CardHeader className="bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-green-500" />
                      <CardTitle>Page Preview</CardTitle>
                    </div>
                    {previewData && (
                      <div className="bg-green-100 text-green-700 rounded-full px-2 py-1 text-xs font-medium">
                        {previewData.productType}
                      </div>
                    )}
                  </div>
                  {previewData && (
                    <CardDescription>
                      First page of "{previewData.title}" created on {previewData.date}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  {isProcessed ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-center">
                        <div className="relative w-full max-w-[350px] aspect-square">
                          <PathImg
                            src={previewData?.processedImageUrl || "/placeholder.svg?height=350&width=350"}
                            alt="Processed coloring page"
                            fill
                            className="object-contain rounded-lg border"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-green-50 p-3 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="text-sm text-green-700">Your image has been successfully processed!</p>
                      </div>
                      <div className="text-sm text-gray-500 text-center">
                        <p>This is a preview of the first page only.</p>
                        <p>Complete your purchase to process all pages in your coloring book.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="relative w-full max-w-[350px] aspect-square bg-gray-100 rounded-lg border flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center justify-center">
                          <div className="rounded-full bg-amber-100 p-4">
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                          </div>
                          <p className="mt-4 text-sm text-gray-500 text-center max-w-[200px]">
                            Processing your image...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-amber-50 p-3 rounded-lg max-w-md">
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <p className="text-sm text-amber-700">
                          Your image is still being processed. This usually takes 1-2 days. We will also send an email once completed.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right side - Payment */}
            <div>
              <Card>
                <CardHeader className="bg-blue-50">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <CardTitle>Complete Your Purchase</CardTitle>
                  </div>
                  <CardDescription>Process all pages in your coloring book</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {previewData?.productType 
                          ? formatProductName(previewData.productType) 
                          : "Standard Coloring Book"}
                      </span>
                      <span className="font-bold text-lg">{previewData?.price || "$24.90"}</span>
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
                          disabled={isPaymentLoading}
                        >
                          {isPaymentLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processing...
                            </>
                          ) : (
                            `Proceed to Checkout • ${previewData?.price || "$24.90"}`
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

              {!isProcessed && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium mb-1">Processing in progress</p>
                      <p>
                        Your image is still being processed. This usually takes 1-2 days. We'll email you when completed. You can still proceed with checkout now.
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
