"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Settings, LogOut, FileEdit, ShoppingBag, Eye, AlertTriangle, FileDown, Sparkles, CreditCard } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { ref, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"
import { PathImg } from "@/components/ui/pathed-image"
import { getUserCredits, formatCreditBalance } from "@/app/firebase/credits-helpers"
import { toast } from "sonner"

// Define interfaces for project types
interface BaseProject {
  id: string;
  title: string;
  productType: string;
  status: 'draft' | 'completed' | 'processing'; // Add processing status
  thumbnail: string | null;
  date: string;
}

// interface PreviewProject extends BaseProject {}

// interface OrderedProject extends BaseProject {
//   orderNumber: string;
//   estimatedDelivery: string;
// }

// Combine into a single Project type for simplicity
type DashboardProject = BaseProject & {
  orderNumber?: string; // Optional, present for 'completed'
  pdfUrl?: string; // URL to download the PDF if available
  processingStatus?: string; // More detailed status for UI display
  deleted?: boolean; // Add deleted flag
  isEmpty?: boolean; // Whether the project is effectively empty (default title + no pages)
};

// Map Firestore statuses to simplified dashboard statuses
const mapStatusToDashboardView = (status: string): 'draft' | 'completed' | 'processing' => {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'completed':
      return 'completed'; // PDF is ready and can be downloaded
    case 'ordered':
    case 'payment_pending':
      return 'processing'; // Payment received, but PDF not yet ready
    case 'processing_pdf':
      return 'processing'; // PDF is being generated
    case 'pdf_failed':
      return 'processing'; // PDF failed but user can still see order details
    default:
      return 'draft'; // Default to draft for any other status
  }
};

// Helper function to format the date
const formatHistoryDate = (timestamp: any) => {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("draft") // Default to draft
  const isMobile = useMobile()

  // Initialize Firebase context
  const firebaseContext = useFirebase()
  const { user, initialized, logout } = firebaseContext

  const [isLoading, setIsLoading] = useState(true)
  // const [previewProjects, setPreviewProjects] = useState<PreviewProject[]>([])
  // const [orderedProjects, setOrderedProjects] = useState<OrderedProject[]>([])
  const [projects, setProjects] = useState<DashboardProject[]>([]) // Single state for all projects
  const [error, setError] = useState("")
  
  // Add credit state
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true)
  const [creditHistory, setCreditHistory] = useState<any[]>([])
  const [isProcessingCreditPurchase, setIsProcessingCreditPurchase] = useState<boolean>(false)
  const [recentPurchaseDetected, setRecentPurchaseDetected] = useState<boolean>(false)
  const [pollingComplete, setPollingComplete] = useState<boolean>(false)
  
  // Get search params to check for credit_purchase=success
  const searchParams = useSearchParams()
  const creditPurchaseSuccess = searchParams.get('credit_purchase') === 'success'

  // Flag to track if we've already handled this specific redirect
  // Moved inside useEffect where needed
  // const acknowledgedSessionKey = 'creditPurchaseAcknowledged' 

  // Set initial processing state based on URL param and session storage
  useEffect(() => {
    const acknowledgedSessionKey = 'creditPurchaseAcknowledged' // Define here
    console.log("[Debug] Initial effect running. creditPurchaseSuccess:", creditPurchaseSuccess);
    if (creditPurchaseSuccess) {
      const alreadyAcknowledged = sessionStorage.getItem(acknowledgedSessionKey) === 'true';
      console.log("[Debug] Already acknowledged in session storage:", alreadyAcknowledged);
      if (!alreadyAcknowledged) {
        console.log("[Debug] Setting isProcessingCreditPurchase to true initially.");
        setIsProcessingCreditPurchase(true);
        toast.info("Purchase detected! Checking for credits...", {
          duration: 10000,
          position: "top-center"
        });
      } else {
        // If already acknowledged, ensure processing state is false
        setIsProcessingCreditPurchase(false);
      }
    }
  }, [creditPurchaseSuccess]);

  // Load user credits and handle polling
  useEffect(() => {
    const acknowledgedSessionKey = 'creditPurchaseAcknowledged' // Define here
    const alreadyAcknowledged = sessionStorage.getItem(acknowledgedSessionKey) === 'true';
    console.log("[Debug] Credit loading/polling effect running. Params:", { user, initialized, creditPurchaseSuccess, recentPurchaseDetected, pollingComplete, alreadyAcknowledged });
    const loadUserCredits = async () => {
      console.log("[Debug] loadUserCredits called. Params:", { user, initialized });
      if (!user || !initialized) {
        console.log("[Debug] loadUserCredits returning early (user/initialized not ready).");
        return;
      }
      
      try {
        setIsLoadingCredits(true);
        const userCredits = await getUserCredits(user.uid);
        
        setCredits(userCredits.balance);
        
        // If we were redirected from a successful purchase, check if there's a purchase from today
        if (creditPurchaseSuccess && !recentPurchaseDetected && userCredits.purchaseHistory?.length > 0) {
          // Sort purchases by date descending to get the most recent first
          const sortedPurchases = [...userCredits.purchaseHistory].sort((a, b) => 
            new Date(b.purchaseDate.seconds * 1000).getTime() - new Date(a.purchaseDate.seconds * 1000).getTime()
          );
          
          const mostRecentPurchase = sortedPurchases[0];
          
          // Check if the most recent purchase is from today AND is a paid purchase
          if (mostRecentPurchase) {
            const purchaseDate = new Date(mostRecentPurchase.purchaseDate.seconds * 1000);
            const today = new Date();
            const isToday = purchaseDate.getDate() === today.getDate() && 
                            purchaseDate.getMonth() === today.getMonth() && 
                            purchaseDate.getFullYear() === today.getFullYear();
            
            const isPaidPurchase = mostRecentPurchase.pricePaid > 0; // Added check for paid purchase
            
            console.log("[Debug] Most recent purchase check:", { isToday, isPaidPurchase, purchaseDetails: mostRecentPurchase });

            if (isToday && isPaidPurchase) { // Modify condition to include isPaidPurchase
              console.log("[Debug] Recent PAID purchase detected today!");
              setRecentPurchaseDetected(true);
              setIsProcessingCreditPurchase(false);
              sessionStorage.setItem(acknowledgedSessionKey, 'true'); // Acknowledge
              toast.success("Credits added successfully!");
            }
          }
        }
        
        // Get the last 3 usage history items
        const recentUsage = userCredits.usageHistory
          .sort((a, b) => b.date.seconds - a.date.seconds)
          .slice(0, 3);
        setCreditHistory(recentUsage);
      } catch (error) {
        console.error("Error loading credits:", error);
        // Don't show an error toast here since we already show project loading errors
      } finally {
        setIsLoadingCredits(false);
      }
    };
    
    loadUserCredits();
    
    // Set up polling if we're waiting for a credit purchase to complete
    let intervalId: NodeJS.Timeout | null = null;
    
    if (creditPurchaseSuccess && !recentPurchaseDetected && !pollingComplete) {
      console.log("[Debug] Starting polling interval.");
      // Always show processing message when redirected from successful purchase (redundant due to initial effect, but safe)
      setIsProcessingCreditPurchase(true);
      
      // Poll every 2 seconds for credit purchase detection
      intervalId = setInterval(() => {
        console.log("[Debug] Polling: calling loadUserCredits.");
        loadUserCredits();
      }, 2000);
      
      // Set a maximum wait time (30 seconds)
      const timeoutId = setTimeout(() => {
        console.log("[Debug] Polling timeout reached.");
        if (intervalId) {
          console.log("[Debug] Clearing polling interval.");
          clearInterval(intervalId);
          
          // If we still haven't detected a purchase after polling
          if (!recentPurchaseDetected) {
            console.log("[Debug] Polling complete, no purchase detected. Showing info message.");
            setPollingComplete(true);
            setIsProcessingCreditPurchase(false);
            sessionStorage.setItem(acknowledgedSessionKey, 'true'); // Acknowledge timeout
            toast.info("Your purchase is being processed. Credits will appear in your account shortly.");
          }
        }
      }, 30000);
      
      // Clean up interval and timeout on unmount or when purchase detected/polling complete
      return () => {
        console.log("[Debug] Cleaning up polling effect.");
        if (intervalId) {
          clearInterval(intervalId);
        }
        clearTimeout(timeoutId);
      };
    }
  }, [user, initialized, creditPurchaseSuccess, recentPurchaseDetected, pollingComplete, isProcessingCreditPurchase]);

  // Load user projects from Firebase
  useEffect(() => {
    // Skip Firebase calls during SSR
    if (typeof window === "undefined") return

    const loadProjects = async () => {
      if (!user || !initialized) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError("")

      try {
        // Initialize Firebase services
        const db = getFirestore()
        const storage = getConfiguredStorage()

        // Get all projects for the current user, ordered by last update
        const projectsRef = collection(db, "users", user.uid, "projects")
        const q = query(projectsRef, orderBy("updatedAt", "desc"))
        const querySnapshot = await getDocs(q)

        const projectPromises = querySnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const status = mapStatusToDashboardView(data.status || 'draft');
          
          let thumbnailUrl = null;
          // Try to get thumbnail if available (using the first page's processed image?)
          // Logic might need refinement based on how thumbnails are actually stored/selected
          const firstPage = data.pages && data.pages.length > 0 ? data.pages.find((p: any) => p.pageNumber === 1) || data.pages[0] : null;
          const imagePath = firstPage?.versions?.[firstPage.selectedVersionId]?.watermarkedStoragePath || firstPage?.originalImage?.storagePath;
          
          if (imagePath) {
            try {
              thumbnailUrl = await getDownloadURL(ref(storage, imagePath));
            } catch (error) {
              console.warn(`Failed to get thumbnail URL for project ${doc.id} from path ${imagePath}:`, error);
            }
          }
          
          return {
            id: doc.id,
            title: data.title || "Untitled Project",
            productType: data.productType || "Standard",
            status: status,
            thumbnail: thumbnailUrl,
            date: data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString() : "Unknown date",
            orderNumber: doc.id.substring(0, 8).toUpperCase(),
            pdfUrl: data.pdfUrl,
            processingStatus: data.processingStatus,
            deleted: data.deleted === true,
            isEmpty: (data.title === "My Coloring Pages" || !data.title) && (!data.pages || data.pages.length === 0)
          } as DashboardProject;
        });

        // Resolve all promises
        const allDocs = await Promise.all(projectPromises);

        // Filter out deleted projects and empty drafts
        const filteredDocs = allDocs.filter(doc => 
          !doc.deleted && 
          !(doc.status === 'draft' && doc.isEmpty)
        );

        // Set the single state
        setProjects(filteredDocs);
        setIsLoading(false);
      } catch (error: any) {
        console.error("Error loading projects");
        
        // Set generic error to avoid exposing authentication details
        setError("Failed to load projects. Please try again.");
        
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [user, initialized]);

  const handleLogout = useCallback(() => {
    logout()
    // Redirect to landing page after logout
    window.location.href = "/"
  }, [logout])

  // Filter projects based on status for tabs
  const draftProjects = projects.filter(p => p.status === 'draft');
  const processingProjects = projects.filter(p => p.status === 'processing');
  const completedProjects = projects.filter(p => p.status === 'completed');

  console.log("[Debug] Rendering Dashboard. State:", { creditPurchaseSuccess, isProcessingCreditPurchase, pollingComplete, recentPurchaseDetected });

  if (!initialized || isLoading) {
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
              <p className="text-gray-500">Loading your projects...</p>
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
              <div 
                className="flex items-center gap-1 mr-2 bg-blue-50 px-3 py-1.5 rounded-full text-sm cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => window.location.href = '/credits'}
              >
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span>{formatCreditBalance(credits)}</span>
              </div>
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
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your Projects</h1>
              <p className="text-gray-500">All your coloring page projects in one place</p>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 w-full md:w-auto" asChild>
              <Link href="/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Coloring Project
              </Link>
            </Button>
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

          {/* Credit purchase processing notification - Make it more prominent */}
          {isProcessingCreditPurchase && (
            <div className="mb-6 bg-blue-500 text-white border border-blue-600 rounded-lg p-6 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-b-transparent"></div>
                </div>
                <div>
                  <p className="font-bold mb-1 text-lg">Processing Credit Purchase</p>
                  <p>Your credit purchase is being processed. This may take a moment.</p>
                  <p className="mt-2 text-sm text-blue-100">URL parameter detected: credit_purchase=success</p>
                </div>
              </div>
            </div>
          )}

          {/* Show a message after polling is complete and no purchase was detected */}
          {pollingComplete && !recentPurchaseDetected && creditPurchaseSuccess && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-sm text-amber-700">
                  <p className="font-medium mb-1">Purchase Processing</p>
                  <p>Your purchase is being processed in the background. Credits will appear in your account shortly.</p>
                </div>
              </div>
            </div>
          )}

          {/* Add a dedicated credit information section for new users */}
          {credits === 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-800 mb-1">You need credits to create coloring pages</h3>
                  <p className="text-sm text-amber-700 mb-2">
                    Each AI-generated coloring page requires 1 credit. Purchase credits to continue creating beautiful coloring pages.
                  </p>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" asChild>
                    <Link href="/credits">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Purchase Credits
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Unified Projects View */}
          {projects.length > 0 ? (
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="overflow-hidden hover:shadow-md transition-all">
                  <div className="relative aspect-video">
                    <PathImg
                      src={project.thumbnail || "/placeholder.svg?height=300&width=400"}
                      alt={project.title}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        // If image fails to load, fall back to placeholder
                        e.currentTarget.src = "/StoryInColor/placeholder.svg?height=300&width=400";
                      }}
                    />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <CardDescription>Last modified: {project.date}</CardDescription>
                  </CardHeader>
                  <CardFooter className="p-4">
                    <div className="flex gap-2 w-full">
                      <Button
                        size="lg"
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                        asChild
                      >
                        <Link href={`/create?id=${project.id}`}>Edit Project</Link>
                      </Button>
                      {project.pdfUrl && (
                        <Button
                          size="lg"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                          asChild
                        >
                          <a href={project.pdfUrl} target="_blank" rel="noopener noreferrer" download>
                            <FileDown className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 md:p-6">
              <div className="flex flex-col items-center justify-center py-8 md:py-12">
                <div className="rounded-full bg-blue-100 p-4 md:p-6 mb-4">
                  <FileEdit className="h-8 w-8 md:h-10 md:w-10 text-blue-500" />
                </div>
                <h3 className="text-lg md:text-xl font-medium mb-2">No Projects Yet</h3>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  Start a new coloring pages project to see it here.
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600" asChild>
                  <Link href="/create">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Project
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Credit Information Section - Moved to bottom */}
      <div className="container mx-auto max-w-7xl px-4 mb-8">
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2 text-purple-800">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Your Credit Balance
            </h3>
            <Button className="mt-3 md:mt-0 bg-purple-600 hover:bg-purple-700" asChild>
              <Link href="/credits">
                <CreditCard className="mr-2 h-4 w-4" />
                Get More Credits
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {/* Credit Balance */}
            <div className="md:col-span-1">
              <div className="text-3xl md:text-4xl font-bold text-purple-700 mb-2">
                {isLoadingCredits ? "..." : formatCreditBalance(credits)}
              </div>
              
              {creditHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <h4 className="text-sm font-medium text-purple-700 mb-2">Recent Usage</h4>
                  <div className="space-y-2">
                    {creditHistory.map((usage, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-purple-700">Used 1 credit</span>
                        <span className="text-purple-600">{formatHistoryDate(usage.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* How Credits Work */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-medium text-purple-800 mb-3">How Credits Work</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white/50 rounded-lg p-4">
                  <h5 className="font-semibold mb-2 text-purple-700">Free Credits</h5>
                  <p className="text-purple-900">New users receive 2 free credits to get started with creating coloring pages.</p>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <h5 className="font-semibold mb-2 text-purple-700">Usage</h5>
                  <p className="text-purple-900">Each AI-generated coloring page costs 1 credit. You can create multiple projects.</p>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <h5 className="font-semibold mb-2 text-purple-700">Purchase</h5>
                  <p className="text-purple-900">Purchase credits for as low as $0.45 per credit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

