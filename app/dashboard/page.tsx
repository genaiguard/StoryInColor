"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Settings, LogOut, FileEdit, ShoppingBag, Eye, AlertTriangle, FileDown } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { ref, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"
import { PathImg } from "@/components/ui/pathed-image"

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
            <Link href="/dashboard" className="text-sm font-medium text-orange-500">
              Dashboard
            </Link>
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
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back!</h1>
              <p className="text-gray-500">Manage your coloring pages projects</p>
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

          <div className="grid gap-4 md:gap-6 grid-cols-3 mb-6 md:mb-8">
            <Card
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${activeTab === "draft" ? "border-blue-500 shadow-md" : ""}`}
              onClick={() => setActiveTab("draft")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-white p-2 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Drafts</CardTitle>
                <div className="rounded-full bg-blue-100 p-1 md:p-1.5">
                  <FileEdit className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 md:pt-3 p-2 md:p-4">
                <div className="text-xl md:text-2xl font-bold">{draftProjects.length}</div>
              </CardContent>
            </Card>

            <Card
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${activeTab === "processing" ? "border-yellow-500 shadow-md" : ""}`}
              onClick={() => setActiveTab("processing")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-yellow-50 to-white p-2 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Processing</CardTitle>
                <div className="rounded-full bg-yellow-100 p-1 md:p-1.5">
                  <FileEdit className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 md:pt-3 p-2 md:p-4">
                <div className="text-xl md:text-2xl font-bold">{processingProjects.length}</div>
              </CardContent>
            </Card>

            <Card
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${activeTab === "completed" ? "border-green-500 shadow-md" : ""}`}
              onClick={() => setActiveTab("completed")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-white p-2 md:p-4">
                <CardTitle className="text-xs md:text-sm font-medium">Completed</CardTitle>
                <div className="rounded-full bg-green-100 p-1 md:p-1.5">
                  <ShoppingBag className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 md:pt-3 p-2 md:p-4">
                <div className="text-xl md:text-2xl font-bold">{completedProjects.length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 md:mb-8">
              <TabsTrigger
                value="draft"
                className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
              >
                <FileEdit className="mr-2 h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Drafts</span>
              </TabsTrigger>
              <TabsTrigger value="processing" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-700">
                <FileEdit className="mr-2 h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Processing</span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                <ShoppingBag className="mr-2 h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Completed</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="draft">
              {draftProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {draftProjects.map((project) => (
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
                        <div className="absolute top-2 right-2 bg-blue-100 text-blue-700 rounded-full px-2 py-1 text-xs font-medium">
                          Draft
                        </div>
                      </div>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <CardDescription>Created on {project.date}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-4">
                        <Button
                          size="lg"
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                          asChild
                        >
                          <Link href={`/create?id=${project.id}`}>Continue Editing</Link>
                        </Button>
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
                    <h3 className="text-lg md:text-xl font-medium mb-2">No Draft Projects</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      Start a new coloring pages project, and it will appear here.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="processing">
              {processingProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {processingProjects.map((project) => (
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
                        <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-700 rounded-full px-2 py-1 text-xs font-medium">
                          Processing
                        </div>
                      </div>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <CardDescription>Created on {project.date}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Status:</span>
                            <span>{project.processingStatus}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4">
                        <Button
                          size="lg"
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                        >
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 md:p-6">
                  <div className="flex flex-col items-center justify-center py-8 md:py-12">
                    <div className="rounded-full bg-yellow-100 p-4 md:p-6 mb-4">
                      <FileEdit className="h-8 w-8 md:h-10 md:w-10 text-yellow-500" />
                    </div>
                    <h3 className="text-lg md:text-xl font-medium mb-2">No Processing Projects</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      Projects that are being processed will appear here.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {completedProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {completedProjects.map((project) => (
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
                        <div className="absolute top-2 right-2 bg-green-100 text-green-700 rounded-full px-2 py-1 text-xs font-medium">
                          Completed
                        </div>
                      </div>
                      <CardHeader className="p-4 pb-1">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <CardDescription>Order #{project.orderNumber || project.id.substring(0,8)}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div>
                          <div className="text-sm">
                            <CardDescription className="text-sm">Completion Date: {project.date}</CardDescription>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4">
                        {project.pdfUrl ? (
                          <Button
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                            asChild
                          >
                            <a href={project.pdfUrl} target="_blank" rel="noopener noreferrer" download>
                              <FileDown className="mr-2 h-4 w-4" />
                              Download PDF
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="lg"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                            asChild
                          >
                            <Link href={`/order-success?session_id=${project.orderNumber}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 md:p-6">
                  <div className="flex flex-col items-center justify-center py-8 md:py-12">
                    <div className="rounded-full bg-green-100 p-4 md:p-6 mb-4">
                      <ShoppingBag className="h-8 w-8 md:h-10 md:w-10 text-green-500" />
                    </div>
                    <h3 className="text-lg md:text-xl font-medium mb-2">No Completed Projects</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      When you complete and order a coloring pages project, it will appear here.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
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

