"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Settings, LogOut, FileEdit, ShoppingBag, Eye, AlertTriangle } from "lucide-react"
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
  status: string;
  thumbnail: string | null;
  date: string;
}

interface PreviewProject extends BaseProject {}

interface OrderedProject extends BaseProject {
  orderNumber: string;
  estimatedDelivery: string;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("preview")
  const isMobile = useMobile()

  // Initialize Firebase context
  const firebaseContext = useFirebase()
  const { user, initialized, logout } = firebaseContext

  const [isLoading, setIsLoading] = useState(true)
  const [previewProjects, setPreviewProjects] = useState<PreviewProject[]>([])
  const [orderedProjects, setOrderedProjects] = useState<OrderedProject[]>([])
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

        // Get all projects for the current user
        const previewRef = collection(db, "users", user.uid, "projects")
        const previewQuery = query(previewRef, where("status", "==", "preview"), orderBy("updatedAt", "desc"))
        const previewSnap = await getDocs(previewQuery)

        const orderedRef = collection(db, "users", user.uid, "projects")
        const orderedQuery = query(orderedRef, where("status", "==", "ordered"), orderBy("updatedAt", "desc"))
        const orderedSnap = await getDocs(orderedQuery)

        // Log only counts without project details
        console.log(`Total preview projects: ${previewSnap.docs.length}`);
        console.log(`Total ordered projects: ${orderedSnap.docs.length}`);

        // Process preview projects
        const previewPromises = previewSnap.docs.map(async (doc) => {
          const data = doc.data();
          
          let thumbnailUrl = null;
          // Try to get thumbnail if available
          if (data.thumbnailPath) {
            try {
              const thumbnailRef = ref(storage, data.thumbnailPath);
              thumbnailUrl = await getDownloadURL(thumbnailRef);
            } catch (error) {
              // Don't log the error details
            }
          }
          
          return {
            id: doc.id,
            title: data.title || "Untitled Project",
            productType: data.productType || "Standard",
            status: "Preview",
            thumbnail: thumbnailUrl,
            date: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "Unknown date",
            deleted: data.deleted === true
          };
        });

        // Process ordered projects
        const orderedPromises = orderedSnap.docs.map(async (doc) => {
          const data = doc.data();
          
          let thumbnailUrl = null;
          // Try to get thumbnail if available
          if (data.thumbnailPath) {
            try {
              const thumbnailRef = ref(storage, data.thumbnailPath);
              thumbnailUrl = await getDownloadURL(thumbnailRef);
            } catch (error) {
              // Don't log the error details
            }
          }
          
          return {
            id: doc.id,
            title: data.title || "Untitled Project",
            productType: data.productType || "Standard",
            status: "Ordered",
            thumbnail: thumbnailUrl,
            date: data.orderDate ? new Date(data.orderDate.toDate()).toLocaleDateString() : "Unknown date",
            orderNumber: data.orderNumber || `ORD-${doc.id.substring(0, 8)}`,
            estimatedDelivery: data.estimatedDelivery
              ? new Date(data.estimatedDelivery.toDate()).toLocaleDateString()
              : "Unknown",
            deleted: data.deleted === true
          };
        });

        // Resolve all promises
        const previewDocs = await Promise.all(previewPromises);
        const orderedDocs = await Promise.all(orderedPromises);

        // Filter out deleted projects
        const filteredPreviewDocs = previewDocs.filter(doc => !doc.deleted);
        const filteredOrderedDocs = orderedDocs.filter(doc => !doc.deleted);

        // Log only counts without project details
        console.log(`After filtering deleted - Preview projects: ${filteredPreviewDocs.length}`);
        console.log(`After filtering deleted - Ordered projects: ${filteredOrderedDocs.length}`);

        // Set state with the projects
        setPreviewProjects(filteredPreviewDocs);
        setOrderedProjects(filteredOrderedDocs);
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
              <p className="text-gray-500">Manage your coloring book projects</p>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 w-full md:w-auto" asChild>
              <Link href="/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Coloring Book
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

          <div className="grid gap-4 md:gap-6 grid-cols-2 mb-6 md:mb-8">
            <Card
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${activeTab === "preview" ? "border-green-500 shadow-md" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-white p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Preview</CardTitle>
                <div className="rounded-full bg-green-100 p-1 md:p-2">
                  <Eye className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 md:pt-4 p-3 md:p-6">
                <div className="text-xl md:text-3xl font-bold">{previewProjects.length}</div>
              </CardContent>
            </Card>

            <Card
              className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${activeTab === "orders" ? "border-blue-500 shadow-md" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-white p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium">Orders</CardTitle>
                <div className="rounded-full bg-blue-100 p-1 md:p-2">
                  <ShoppingBag className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 md:pt-4 p-3 md:p-6">
                <div className="text-xl md:text-3xl font-bold">{orderedProjects.length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8">
              <TabsTrigger
                value="preview"
                className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700"
              >
                <Eye className="mr-2 h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Preview</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                <ShoppingBag className="mr-2 h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Orders</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              {previewProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {previewProjects.map((project) => (
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
                          {project.productType}
                        </div>
                      </div>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <CardDescription>Created on {project.date}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-4">
                        <Button
                          size="lg"
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                          asChild
                        >
                          <Link href={`/preview?id=${project.id}`}>View Preview</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 md:p-6">
                  <div className="flex flex-col items-center justify-center py-8 md:py-12">
                    <div className="rounded-full bg-green-100 p-4 md:p-6 mb-4">
                      <Eye className="h-8 w-8 md:h-10 md:w-10 text-green-500" />
                    </div>
                    <h3 className="text-lg md:text-xl font-medium mb-2">No Projects in Preview</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      Projects that are ready for preview will appear here.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders">
              {orderedProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {orderedProjects.map((project) => (
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
                          {project.productType}
                        </div>
                      </div>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <CardDescription>Order #{project.orderNumber}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Order Date:</span>
                            <span>{project.date}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Est. Delivery:</span>
                            <span>{project.estimatedDelivery}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4">
                        <Button
                          size="lg"
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
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
                    <div className="rounded-full bg-blue-100 p-4 md:p-6 mb-4">
                      <ShoppingBag className="h-8 w-8 md:h-10 md:w-10 text-blue-500" />
                    </div>
                    <h3 className="text-lg md:text-xl font-medium mb-2">No Orders Yet</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      When you complete and order a coloring book, it will appear here for tracking.
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

