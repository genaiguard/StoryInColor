"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  Eye, 
  FileUp, 
  RefreshCw, 
  Search, 
  UploadCloud,
  Check,
  Mail,
  CheckCircle,
  Image as ImageIcon
} from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  collectionGroup,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  limit
} from "firebase/firestore"
import { TOOLS, getToolById } from "@/lib/tools/registry"
import { formatDistanceToNow } from "date-fns"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage, compressProcessedImage, getSignedDownloadURL } from "@/app/firebase/storage-helpers"
import { PathImg } from "@/components/ui/pathed-image"
import { toast } from "sonner"
import { getFunctions, httpsCallable } from "firebase/functions"

// Define types

// --- Reusing types from create page for consistency ---
interface OriginalImage {
  id: string;
  name: string;
  previewUrl?: string; // May not be available here, use storagePath
  storagePath?: string; // Path in Firebase Storage
  uploaded: boolean;
  displayUrl?: string; // URL fetched for display
}

interface ImageVersion {
  versionId: string;
  createdAt: any; // Firestore Timestamp or Date
  originalStoragePath: string; // Path to the raw OpenAI output (b64?)
  watermarkedStoragePath: string; // Path to the watermarked PNG/WEBP
  watermarkedPreviewUrl?: string; // Optional: Signed URL for direct display
  artStyle: string; 
}

interface Page {
  id: string; // UUID for the page itself
  pageNumber: number;
  originalImage: OriginalImage | null;
  isProcessing?: boolean; // Optional, may not be relevant here
  processingError?: string | null; // Optional
  versions: ImageVersion[];
  selectedVersionId: string | null;
}
// --- End reused types ---

interface ProjectInfo {
  id: string;
  userId: string;
  title: string;
  // productType: string; // Removed
  createdAt: string;
  orderDate?: string; 
  pdfGeneratedAt?: string; 
  userEmail?: string;
  // hasProcessedImage: boolean; // Remove, infer from status or pages
  // artStyle?: string; // Removed
  orderNumber?: string;
  pageCount?: number;
  pdfUrl?: string;
  pages: Page[]; // Use the detailed Page type
  deleted?: boolean; // Added deleted flag
}

// Add missing interface definitions from admin/page.tsx
interface AuthUserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}

interface GetUserDataResponse {
  success: boolean;
  userData?: AuthUserData;
  message?: string;
  error?: string;
}

// Admin emails allowed to access this interface
const ADMIN_EMAILS = ['ipekcioglu@me.com']; // Add any additional admin emails here

// Tool-aware job row used by the new admin job views
interface AdminJobRow {
  jobId: string;
  userId: string;
  toolId: string;
  status: string;
  outputDownloadUrl?: string;
  createdAt: any;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [notifiedProjects, setNotifiedProjects] = useState<Record<string, boolean>>({});
  const [isNotifying, setIsNotifying] = useState(false);

  // Tool-aware admin: live jobs across all users + filter chip state
  const [allJobs, setAllJobs] = useState<AdminJobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeToolFilter, setActiveToolFilter] = useState<string>("all");

  // Get search params for direct project loading
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const userId = searchParams.get("userId");
  
  // Initialize Firebase context
  const firebaseContext = useFirebase();
  const { user, initialized: firebaseInitialized } = firebaseContext;
  
  // Check if current user is an admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');
  
  // Load projects from Firestore
  useEffect(() => {
    if (!firebaseInitialized || !user || !isAdmin) {
      if (firebaseInitialized && user && !isAdmin) {
        setError("You don't have permission to access this page.");
      }
      setLoading(false);
      return;
    }
    
    const loadProjects = async () => {
      setLoading(true);
      setError("");
      
      try {
        const db = getFirestore();
        
        // If projectId and userId are provided, load just that project
        if (projectId && userId) {
          const singleProject = await loadSingleProject(db, userId, projectId);
          if (singleProject) {
            setProjects([singleProject]);
          } else {
            setError("Project not found");
          }
          setLoading(false);
          return;
        }
        
        // Otherwise load all projects
        const projectsRef = collectionGroup(db, "projects");
        // Add filtering for status if needed, or filter client-side
        // Example: query(projectsRef, where('status', 'in', ['draft', 'pdf_ready', 'ordered']));
        const q = query(projectsRef, orderBy('updatedAt', 'desc')); // Order by update time
        const querySnapshot = await getDocs(q);
        
        const projectsData: ProjectInfo[] = [];
        
        // Process each project document
        for (const docSnapshot of querySnapshot.docs) {
          const data = docSnapshot.data();
          const projectId = docSnapshot.id;
          const userId = docSnapshot.ref.path.split('/')[1];
          
          projectsData.push({
            id: projectId,
            userId,
            title: data.title || "Untitled Project",
            createdAt: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "Unknown date",
            orderDate: data.orderDate ? new Date(data.orderDate.toDate()).toLocaleDateString() : 'N/A',
            pdfGeneratedAt: data.pdfGeneratedAt ? new Date(data.pdfGeneratedAt.toDate()).toLocaleDateString() : 'N/A',
            userEmail: data.userEmail || 'No email in Auth',
            pages: data.pages || [],
            deleted: data.deleted || false
          });
        }
        
        setProjects(projectsData);
      } catch (error) {
        console.error("Error loading projects:", error);
        setError("Failed to load projects. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    loadProjects();
  }, [firebaseInitialized, user, isAdmin, projectId, userId]);

  // Live subscribe to all jobs across all users for tool-aware admin views
  useEffect(() => {
    if (!firebaseInitialized || !user || !isAdmin) {
      return;
    }

    const db = getFirestore();
    const jobsRef = collectionGroup(db, "jobs");
    let q;
    try {
      q = query(jobsRef, orderBy("createdAt", "desc"), limit(200));
    } catch (e) {
      q = query(jobsRef);
    }

    setJobsLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: AdminJobRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          // Path: users/{uid}/jobs/{jobId}
          const pathParts = d.ref.path.split("/");
          const ownerUid = pathParts.length >= 2 ? pathParts[1] : (data.userId || "");
          rows.push({
            jobId: d.id,
            userId: data.userId || ownerUid,
            toolId: data.toolId || "",
            status: data.status || "processing",
            outputDownloadUrl: data.outputDownloadUrl,
            createdAt: data.createdAt,
          });
        });
        setAllJobs(rows);
        setJobsLoading(false);
      },
      (err) => {
        console.error("Error subscribing to jobs collectionGroup:", err);
        setJobsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseInitialized, user, isAdmin]);

  // Modified function to load a single project with detailed pages
  const loadSingleProject = async (db: any, userId: string, projectId: string): Promise<ProjectInfo | null> => {
    try {
      const projectRef = doc(db, `users/${userId}/projects/${projectId}`);
      const docSnap = await getDoc(projectRef);

      if (!docSnap.exists()) {
        console.error("Project not found in loadSingleProject");
        return null;
      }

      const data = docSnap.data();

      // Format timestamps nicely (handle potential nulls)
      const formatDate = (timestamp: any): string => {
        if (!timestamp || !timestamp.toDate) return "N/A";
        try {
          return new Date(timestamp.toDate()).toLocaleString();
        } catch (e) {
          return "Invalid Date";
        }
      };

      // Process pages: Fetch necessary display URLs
      let processedPages: Page[] = [];
      if (data.pages && Array.isArray(data.pages)) {
        // Sort pages just in case
        const sortedPagesData = data.pages.sort((a: any, b: any) => (a.pageNumber || 0) - (b.pageNumber || 0));
        
        processedPages = await Promise.all(
          sortedPagesData.map(async (pageData: any): Promise<Page> => {
            let originalImageUrl: string | undefined = undefined;
            let versionsWithPreviewUrls: ImageVersion[] = [];

            // Get URL for original image
            if (pageData.originalImage?.storagePath) {
              try {
                originalImageUrl = await getSignedDownloadURL(pageData.originalImage.storagePath);
              } catch (error) {
                console.warn(`Error loading original image URL for page ${pageData.id}:`, error);
              }
            }

            // Get URLs for versions (only selected one needed for now, but fetch all for potential future use?)
            if (pageData.versions && Array.isArray(pageData.versions)) {
              versionsWithPreviewUrls = await Promise.all(
                pageData.versions.map(async (version: any) => {
                  let previewUrl: string | undefined = undefined;
                  if (version.watermarkedStoragePath) {
                     try {
                       previewUrl = await getSignedDownloadURL(version.watermarkedStoragePath);
                     } catch (error) {
                       console.warn(`Error loading watermarked preview URL for version ${version.versionId}:`, error);
                     }
                  }
                  return { 
                     ...version, 
                     watermarkedPreviewUrl: previewUrl,
                     // Ensure createdAt is a Date object if possible, otherwise keep original
                     createdAt: version.createdAt?.toDate ? version.createdAt.toDate() : version.createdAt
                  };
                })
              );
            }

            return {
              ...pageData,
              originalImage: pageData.originalImage ? { 
                ...pageData.originalImage, 
                displayUrl: originalImageUrl 
              } : null,
              versions: versionsWithPreviewUrls
            } as Page; // Assert type after processing
          })
        );
      } else {
        console.warn(`Project ${projectId} has no pages array or it's empty.`);
      }

      // Get user email (moved fetching here for clarity)
      let userEmail = 'Loading...';
      try {
        const functions = getFunctions();
        const getUserDataFn = httpsCallable<{ userId: string }, GetUserDataResponse>(functions, 'getAuthUserData');
        const result = await getUserDataFn({ userId });
        if (result.data.success && result.data.userData) {
          userEmail = result.data.userData.email || 'No email in Auth';
        } else {
          console.error('Error fetching user auth data:', result.data.message);
          userEmail = 'Error fetching email'; 
        }
      } catch (err) {
        console.error("Error calling getAuthUserData function:", err);
        userEmail = 'Error fetching email';
      }
      
      return {
        id: projectId,
        userId,
        title: data.title || 'Untitled',
        createdAt: formatDate(data.createdAt),
        orderDate: data.orderDate ? formatDate(data.orderDate) : undefined,
        pdfGeneratedAt: data.pdfGeneratedAt ? formatDate(data.pdfGeneratedAt) : undefined,
        userEmail,
        orderNumber: data.orderNumber || undefined,
        pageCount: processedPages.length, // Count processed pages
        pdfUrl: data.pdfUrl || undefined,
        pages: processedPages, // Assign processed pages
        deleted: data.deleted || false // Fetch and assign deleted status
      };
    } catch (error) {
      console.error("Error loading single project details:", error);
      return null;
    }
  };
  
  // Filter by search term
  const searchedProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // If user is not an admin, show access denied
  if (firebaseInitialized && user && !isAdmin) {
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
              <div className="rounded-full bg-red-100 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-gray-500 mb-4">You don't have permission to access this page.</p>
              <Button asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // If user is not logged in, show not signed in
  if (firebaseInitialized && !user) {
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
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Not Signed In</h2>
              <p className="text-gray-500 mb-4">Please sign in to access this page.</p>
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
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
            <Link href="/dashboard" className="text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/admin" className="text-sm font-medium">
              Admin
            </Link>
            <Link href="/admin/projects" className="text-sm font-medium text-orange-500">
              Project Details
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
            <div>
              {projectId && userId ? (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Project Details: <span className="font-mono text-xl">{projectId}</span></h1>
                  <p className="text-gray-500">Manage this project and process images</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Project Management</h1>
                  <p className="text-gray-500">Upload and manage processed previews</p>
                </>
              )}
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button 
                variant="outline" 
                asChild
                className="mr-2"
              >
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Link>
              </Button>
              {!projectId && (
                <>
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="search"
                      placeholder="Search projects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Show single project view when a specific projectId is provided */}
          {projectId && userId && !loading && projects.length > 0 ? (
            <SingleProjectView 
              project={projects[0]} 
              user={user}
            />
          ) : (
            /* Show list view for all projects - Tabs removed */
            <div className="w-full">
              {/* Tool-aware filter chips with live job counts */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Live jobs by tool
                  </h2>
                  {jobsLoading && (
                    <span className="text-xs text-gray-500">Loading…</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveToolFilter("all")}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeToolFilter === "all"
                        ? "bg-orange-500 text-white"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    All ({allJobs.length})
                  </button>
                  {TOOLS.map((t) => {
                    const count = allJobs.filter(
                      (j) => j.toolId === t.id
                    ).length;
                    if (count === 0 && activeToolFilter !== t.id) return null;
                    const on = activeToolFilter === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveToolFilter(t.id)}
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          on
                            ? "bg-orange-500 text-white"
                            : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {t.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List all projects directly */}
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </div>
              ) : searchedProjects.length > 0 ? (
                <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
                  {searchedProjects.map((project) => (
                    <ProjectCard 
                      key={`${project.userId}-${project.id}`}
                      project={project}
                      // isProcessed prop is no longer needed
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-amber-100 p-6 mb-4">
                      <FileUp className="h-10 w-10 text-amber-500" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">No Projects Found</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      {searchTerm 
                        ? "No projects match your search criteria." 
                        : "There are currently no projects to display."}
                    </p>
                  </div>
                </div>
              )}
              {/* Removed TabsContent sections */}
            </div>
          )}
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
          </div>
        </div>
      </footer>
    </div>
  )
}

// ProjectCard component for displaying projects in the list view
function ProjectCard({ 
  project 
  // Removed isProcessed prop
}: { 
  project: ProjectInfo; 
  // Removed isProcessed prop type
}) {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Card className="overflow-hidden">
      <div className="relative h-40">
        {project.pdfUrl && !imageError ? (
          <PathImg 
            src={project.pdfUrl} 
            alt={project.title}
            fill
            className="object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <p className="text-gray-500">No image available</p>
          </div>
        )}
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-base">{project.title}</CardTitle>
        <CardDescription>
           {/* Use appropriate date based on status */} 
           {project.pdfGeneratedAt !== 'N/A' ? `Completed: ${project.pdfGeneratedAt}` : 
            project.orderDate !== 'N/A' ? `Ordered: ${project.orderDate}` : 
            `Created: ${project.createdAt}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Tags for status */}
          {/* REMOVE Product Type Tag 
          <div className="bg-blue-100 px-2 py-1 rounded-full">
            <span className="text-xs text-blue-700 font-medium">{project.productType}</span>
          </div> 
          */}
          {/* REMOVE Art Style Tag 
          <div className="bg-purple-100 px-2 py-1 rounded-full">
            <span className="text-xs text-purple-700 font-medium">{project.artStyle || 'Classic'}</span>
          </div> 
          */}
          {/* Ensure Status Tag is fully removed */}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 border-t">
         <Link href={`/admin/projects?id=${project.id}&userId=${project.userId}`} className="w-full">
            <Button size="sm" variant="outline" className="w-full">
              Manage Project
            </Button>
          </Link>
       </CardFooter>
    </Card>
  );
}

// SingleProjectView component for displaying a single project in detail view
function SingleProjectView({ 
  project, 
  user
}: { 
  project: ProjectInfo; 
  user: any;
}) {
  
  return (
    <div className="space-y-8"> {/* Changed from grid to space-y */}
      {/* Project Information Card (Keep as is) */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Details about this project</CardDescription>
          </div>
          {/* Add Deleted Badge if applicable */}
          {project.deleted && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-400">
              Deleted
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Keep existing project details: Title, User ID, Created Date, User Email, Status, Order #, Page Count etc. */}
               <div>
                 <h3 className="text-sm font-medium text-gray-500 mb-1">Title</h3>
                 <p className="text-base font-medium">{project.title}</p>
               </div>
               <div>
                 <h3 className="text-sm font-medium text-gray-500 mb-1">User ID</h3>
                 <p className="text-base font-mono">{project.userId}</p>
               </div>
               <div>
                 <h3 className="text-sm font-medium text-gray-500 mb-1">Created Date</h3>
                 <p className="text-base">{project.createdAt}</p>
               </div>
               <div>
                 <h3 className="text-sm font-medium text-gray-500 mb-1">User Email</h3>
                 <p className="text-base">{project.userEmail || 'Unknown'}</p>
               </div>
                {project.orderNumber && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Order #</h3>
                    <p className="text-base font-mono">{project.orderNumber}</p>
                  </div>
                )}
                {project.orderDate && project.orderDate !== 'N/A' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Order Date</h3>
                    <p className="text-base">{project.orderDate}</p>
                  </div>
                )}
                {project.pageCount !== undefined && (
                   <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Page Count</h3>
                    <p className="text-base">{project.pageCount}</p>
                  </div>
                )}
                {/* Ensure Status display is fully removed */}
                {project.pdfUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Download Link</h3>
                    <p className="text-base">{project.pdfUrl}</p>
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Project Pages Section */}
      <Card>
        <CardHeader>
          <CardTitle>Project Pages ({project.pages?.length || 0})</CardTitle>
          <CardDescription>Original uploads and all generated coloring page versions.</CardDescription>
        </CardHeader>
        <CardContent>
          {project.pages && project.pages.length > 0 ? (
            <div className="space-y-6"> 
              {project.pages.map((page, index) => {
                // Find selected version for potential highlighting (optional)
                // const selectedVersion = page.versions.find(v => v.versionId === page.selectedVersionId);
                return (
                  <div key={page.id || index} className="border rounded-lg p-4">
                    <h4 className="text-lg font-semibold mb-4">Page {page.pageNumber}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {/* Original Image */}
                      <div className="md:col-span-1">
                        <h5 className="text-sm font-medium text-gray-600 mb-2 text-center">Original Upload</h5>
                        <div className="relative aspect-square border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {page.originalImage?.displayUrl ? (
                            <PathImg 
                              src={page.originalImage.displayUrl} 
                              alt={`Original - Page ${page.pageNumber}`}
                              fill 
                              className="object-contain" 
                            />
                          ) : (
                            <div className="text-gray-400 p-4 text-center text-sm">No Original Image</div>
                          )}
                        </div>
                      </div>
                      {/* Generated Versions */}
                      <div className="md:col-span-2">
                          <h5 className="text-sm font-medium text-gray-600 mb-2">Generated Versions ({page.versions?.length || 0})</h5>
                          {page.versions && page.versions.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {page.versions.map((version, vIndex) => (
                                <div key={version.versionId} className={`border rounded-lg overflow-hidden ${version.versionId === page.selectedVersionId ? 'ring-2 ring-offset-1 ring-orange-500' : ''}`}>
                                  <div className="relative aspect-square bg-gray-100 flex items-center justify-center">
                                    {version.watermarkedPreviewUrl ? (
                                      <PathImg 
                                        src={version.watermarkedPreviewUrl} 
                                        alt={`Version ${vIndex + 1} - Page ${page.pageNumber}`}
                                        fill 
                                        className="object-contain" 
                                      />
                                    ) : (
                                      <div className="text-gray-400 p-2 text-center text-xs"><ImageIcon className="w-5 h-5 mx-auto mb-1"/>Preview unavailable</div>
                                    )}
                                  </div>
                                  <div className="p-1.5 text-center bg-gray-50">
                                      <p className="text-xs text-gray-600">
                                          Style: <span className="font-medium">{version.artStyle}</span>
                                          {version.versionId === page.selectedVersionId && <span className="text-green-600 font-bold"> (Selected)</span>}
                                      </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                             <div className="text-gray-400 p-4 text-center text-sm italic border rounded-lg">No versions generated for this page.</div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No pages found in this project.</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
} 