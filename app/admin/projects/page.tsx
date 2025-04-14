"use client"

import { useState, useEffect } from "react"
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
  CheckCircle
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
  serverTimestamp 
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage, compressProcessedImage, getSignedDownloadURL } from "@/app/firebase/storage-helpers"
import { PathImg } from "@/components/ui/pathed-image"
import { toast } from "sonner"
import { getFunctions, httpsCallable } from "firebase/functions"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getApp } from "firebase/app"
import { useAuth } from "@/app/firebase/auth-provider"
import { useIsAdmin } from "@/app/firebase/admin-provider"

// Define types
interface ProjectInfo {
  id: string;
  userId: string;
  title: string;
  productType: string;
  status: string;
  createdAt: string;
  firstPageId?: string;
  firstPagePath?: string;
  firstPageUrl?: string;
  processedImagePath?: string;
  processedImageUrl?: string;
  userEmail?: string;
  hasProcessedImage: boolean;
  artStyle?: string;
}

// Admin emails allowed to access this interface
const ADMIN_EMAILS = ['ipekcioglu@me.com']; // Add any additional admin emails here

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [notifiedProjects, setNotifiedProjects] = useState<Record<string, boolean>>({});
  const [isNotifying, setIsNotifying] = useState(false);
  
  // Get search params for direct project loading
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const userId = searchParams.get("userId");
  
  // Get current user
  const { user, firebaseInitialized } = useAuth();
  
  // Check if user is admin
  const { isAdmin } = useIsAdmin(user);
  
  // Debug Firebase initialization
  useEffect(() => {
    if (firebaseInitialized) {
      console.log("Firebase is initialized");
      try {
        const app = getApp();
        console.log("Firebase app config:", app.options);
        
        // Test Functions initialization
        try {
          const functions = getFunctions();
          console.log("Firebase Functions initialized successfully");
          
          // Test if we can create callables
          try {
            const testCallable = httpsCallable(functions, 'sendProcessingCompleteNotification');
            console.log("Function reference created successfully:", testCallable);
          } catch (callableError) {
            console.error("Error creating function reference:", callableError);
          }
        } catch (functionsError) {
          console.error("Error initializing Firebase Functions:", functionsError);
        }
      } catch (appError) {
        console.error("Error getting Firebase app:", appError);
      }
    } else {
      console.log("Firebase is NOT initialized yet");
    }
  }, [firebaseInitialized]);
  
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
            setActiveTab(singleProject.hasProcessedImage ? "processed" : "pending");
          } else {
            setError("Project not found");
          }
          setLoading(false);
          return;
        }
        
        // Otherwise load all projects
        const projectsRef = collectionGroup(db, "projects");
        const q = query(projectsRef);
        const querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.docs.length} projects in collection group`);
        
        const projectsData: ProjectInfo[] = [];
        
        // Process each project document
        for (const docSnapshot of querySnapshot.docs) {
          const data = docSnapshot.data();
          const projectId = docSnapshot.id;
          const userId = docSnapshot.ref.path.split('/')[1];
          
          let firstPageId = "";
          let firstPagePath = "";
          let firstPageUrl = "";
          let processedImagePath = "";
          let processedImageUrl = "";
          let hasProcessedImage = data.hasProcessedImage || false;
          let artStyle = data.artStyle || 'Classic';
          
          // First try to get pages from subcollection
          const pagesRef = collection(db, `users/${userId}/projects/${projectId}/pages`);
          const pagesQuery = query(pagesRef);
          const pagesSnapshot = await getDocs(pagesQuery);
          
          if (!pagesSnapshot.empty) {
            const firstPage = pagesSnapshot.docs.find(doc => doc.data().pageNumber === 1) || pagesSnapshot.docs[0];
            firstPageId = firstPage.id;
            
            const pageData = firstPage.data();
            firstPagePath = pageData.imagePath || pageData.photoPath || "";
            processedImagePath = pageData.processedImagePath || "";
          } 
          else if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
            const firstPage = data.pages.find(page => page.pageNumber === 1) || data.pages[0];
            firstPageId = firstPage.id || "";
            firstPagePath = firstPage.photoPath || firstPage.imagePath || "";
            processedImagePath = firstPage.processedImagePath || "";
            
            if (firstPage.photoUrl) {
              firstPageUrl = firstPage.photoUrl;
            }
          }
          
          // Get URLs using direct download
          if (!firstPageUrl && firstPagePath) {
            try {
              firstPageUrl = await getSignedDownloadURL(firstPagePath);
            } catch (error) {
              console.error("Error getting first page image URL:", error);
            }
          }
          
          if (processedImagePath) {
            try {
              processedImageUrl = await getSignedDownloadURL(processedImagePath);
              hasProcessedImage = true;
            } catch (error) {
              console.error(`Project ${projectId}: Error getting processed image URL:`, error);
              hasProcessedImage = false;
            }
          }
          
          // Get user email
          let userEmail = '';
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              userEmail = userDoc.data().email || '';
            }
          } catch (err) {
            console.error("Error fetching user email:", err);
          }
          
          projectsData.push({
            id: projectId,
            userId,
            title: data.title || "Untitled Project",
            productType: data.productType || "standard",
            status: data.status || "pending",
            createdAt: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "Unknown date",
            firstPageId,
            firstPagePath,
            firstPageUrl,
            processedImagePath,
            processedImageUrl,
            userEmail,
            artStyle,
            hasProcessedImage
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
  
  // Modified function to load a single project with direct URLs
  const loadSingleProject = async (db: any, userId: string, projectId: string) => {
    try {
      const projectRef = doc(db, `users/${userId}/projects/${projectId}`);
      const docSnap = await getDoc(projectRef);
      
      if (!docSnap.exists()) {
        console.error("Project not found");
        return null;
      }
      
      const data = docSnap.data();
      
      // Handle images with direct URLs
      const loadImageWithDirectURL = async (path: string) => {
        if (!path) return null;
        try {
          return await getSignedDownloadURL(path);
        } catch (error) {
          console.warn(`Error loading image from path: ${path}`, error);
          return null;
        }
      };
      
      let firstPageId = "";
      let firstPagePath = "";
      let firstPageUrl = "";
      let processedImagePath = "";
      let processedImageUrl = "";
      let hasProcessedImage = data.hasProcessedImage || false;
      
      if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
        const firstPage = data.pages.find((page: any) => page.pageNumber === 1) || data.pages[0];
        firstPageId = firstPage.id || "";
        firstPagePath = firstPage.photoPath || firstPage.imagePath || "";
        processedImagePath = firstPage.processedImagePath || "";
        
        if (firstPage.photoUrl) {
          firstPageUrl = firstPage.photoUrl;
        } else if (firstPagePath) {
          firstPageUrl = await loadImageWithDirectURL(firstPagePath) || '/placeholder-image.jpg';
        }
        
        if (firstPage.processedImageUrl) {
          processedImageUrl = firstPage.processedImageUrl;
          hasProcessedImage = true;
        } else if (processedImagePath) {
          processedImageUrl = await loadImageWithDirectURL(processedImagePath) || '/placeholder-image.jpg';
          hasProcessedImage = processedImagePath ? true : false;
        }
      }
      
      let userEmail = '';
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          userEmail = userDoc.data().email || '';
        }
      } catch (err) {
        console.error("Error fetching user email:", err);
      }
      
      return {
        id: projectId,
        userId,
        title: data.title || 'Untitled',
        productType: data.productType || 'standard',
        status: data.status || 'preview',
        createdAt: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "Unknown date",
        firstPageId,
        firstPagePath,
        firstPageUrl,
        processedImagePath,
        processedImageUrl,
        userEmail,
        artStyle: data.artStyle || 'Classic',
        hasProcessedImage
      };
    } catch (error) {
      console.error("Error loading single project:", error);
      return null;
    }
  };
  
  // Handle upload processed image with CORS handling
  const handleUploadProcessed = async (event: React.ChangeEvent<HTMLInputElement>, project: ProjectInfo) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    const originalFile = event.target.files[0];
    setSelectedProject(project);
    setUploading(true);
    setUploadProgress(0);
    
    try {
      console.log(`Starting upload process for ${originalFile.name} (${(originalFile.size / (1024 * 1024)).toFixed(2)}MB)`);
      
      // First compress the image to ensure it's under the Firebase Storage limit
      const compressedFile = await compressProcessedImage(originalFile);
      console.log(`Compression complete. Original: ${(originalFile.size / (1024 * 1024)).toFixed(2)}MB, Compressed: ${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB`);
      
      const storage = getConfiguredStorage();
      
      // Use consistent path for processed images
      const photoId = project.firstPagePath?.split('/').pop()?.split('.')[0] || project.firstPageId;
      const processedImagePath = `users/${project.userId}/projects/${project.id}/processed/${photoId}.jpg`;
      console.log("Upload path:", processedImagePath);
      
      // Create a metadata object with proper content type
      const metadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          'originalName': originalFile.name,
          'originalSize': originalFile.size.toString(),
          'compressedSize': compressedFile.size.toString(),
          'processed': 'true'
        }
      };
      
      // Add custom headers for CORS
      const storageRef = ref(storage, processedImagePath);
      
      // Try upload with retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      
      const attemptUpload = async () => {
        try {
          // Add cache busting and CORS-friendly headers to metadata
          const corsMetadata = {
            ...metadata,
            customMetadata: {
              ...metadata.customMetadata,
              'cache-control': 'no-cache',
              'timestamp': Date.now().toString()
            }
          };
          
          // Check if we're in development mode
          const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
          
          let uploadTask;
          let downloadURL;
          
          // If in development, use our API endpoint to bypass CORS
          if (isDev) {
            console.log("Using server-side upload to bypass CORS in development");
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('path', processedImagePath);
            formData.append('contentType', 'image/jpeg');
            
            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Upload failed');
            }
            
            const result = await response.json();
            downloadURL = result.url;
            
            // Simulate progress for better UX
            for (let i = 0; i <= 100; i += 10) {
              setUploadProgress(i);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Return a mock uploadTask with all we need
            return {
              downloadURL,
              snapshot: {
                ref: storageRef
              }
            };
          } else {
            // In production, use regular Firebase Storage upload
            uploadTask = uploadBytesResumable(storageRef, compressedFile, corsMetadata);

            return new Promise((resolve, reject) => {
              uploadTask.on(
                "state_changed",
                (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  console.log(`Upload progress: ${progress.toFixed(2)}%`);
                  setUploadProgress(progress);
                },
                (error) => reject(error),
                () => resolve(uploadTask)
              );
            });
          }
        } catch (error) {
          throw error;
        }
      };

      let uploadTask;
      while (attempts < maxAttempts) {
        try {
          console.log(`Upload attempt ${attempts + 1} of ${maxAttempts}`);
          uploadTask = await attemptUpload();
          break;
        } catch (error) {
          attempts++;
          console.error(`Upload attempt ${attempts} failed:`, error);
          
          if (attempts === maxAttempts) {
            throw error;
          }
          
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
      }

      if (!uploadTask) {
        throw new Error("Failed to upload after multiple attempts");
      }

      // Upload completed successfully
      console.log("Upload completed, getting download URL");
      try {
        // Get download URL - either from the API response or from Firebase
        const downloadURL = uploadTask.downloadURL || await getSignedDownloadURL(processedImagePath);
        console.log("Successfully got download URL:", downloadURL);
        
        // Update Firestore to mark as processed and store the processed image path
        const db = getFirestore();
        const projectRef = doc(db, `users/${project.userId}/projects/${project.id}`);
        
        try {
          // Get the current project data first
          console.log("Fetching current project data");
          const projectSnap = await getDoc(projectRef);
          if (!projectSnap.exists()) {
            throw new Error("Project not found");
          }
          
          const projectData = projectSnap.data();
          
          // Check if the project has a pages array
          if (!projectData.pages || !Array.isArray(projectData.pages)) {
            console.error("Project doesn't have a valid pages array");
            toast.error("Project structure is invalid. Please contact support.");
            setUploading(false);
            return;
          }
          
          // Find the matching page in the pages array
          const pageIndex = projectData.pages.findIndex(page => 
            page.id === project.firstPageId || 
            (page.photoPath && project.firstPagePath?.includes(page.photoPath)) ||
            (page.imagePath && project.firstPagePath?.includes(page.imagePath)) ||
            (page.photoId && project.firstPagePath?.includes(page.photoId))
          );
          
          console.log("Page index found:", pageIndex);
          console.log("First page ID:", project.firstPageId);
          console.log("First page path:", project.firstPagePath);
          
          if (pageIndex === -1) {
            console.error("Couldn't find matching page in project", {
              firstPageId: project.firstPageId,
              firstPagePath: project.firstPagePath,
              pages: projectData.pages
            });
            toast.error("Couldn't find the page to update. Please contact support.");
            setUploading(false);
            return;
          }
          
          // Create updated pages array
          const updatedPages = [...projectData.pages];
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            processed: true,
            processedImagePath: processedImagePath,
            processedImageUrl: downloadURL,
            processedAt: new Date()
          };
          
          console.log("Updating Firestore document");
          
          // Update the project document
          await updateDoc(projectRef, {
            pages: updatedPages,
            hasProcessedImage: true,
            processedImagePath: processedImagePath,
            processedImageUrl: downloadURL,
            updatedAt: serverTimestamp()
          });
          
          console.log("Successfully updated project with processed image");
          
          // Update the local state
          setProjects(prevProjects => 
            prevProjects.map(p => 
              p.id === project.id && p.userId === project.userId
                ? {
                    ...p, 
                    processedImagePath,
                    processedImageUrl: downloadURL,
                    hasProcessedImage: true
                  }
                : p
            )
          );
          
          toast.success("Processed image uploaded successfully!");
          
          // Switch to the processed tab
          setActiveTab("processed");
        } catch (dbError) {
          console.error("Error updating Firestore:", dbError);
          toast.error("Failed to update project data.");
        } finally {
          setUploading(false);
          setUploadProgress(0);
          setSelectedProject(null);
        }
      } catch (urlError) {
        console.error("Error getting download URL:", urlError);
        toast.error("Upload completed but couldn't retrieve download URL.");
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error("Error initializing upload:", error);
      toast.error("Failed to start upload process.");
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  // Download original image
  const handleDownloadOriginal = async (project: ProjectInfo) => {
    if (!project.firstPagePath && !project.firstPageUrl) {
      toast.error("No original image available for this project.");
      return;
    }
    
    try {
      // If we already have the URL, use it
      if (project.firstPageUrl) {
        window.open(project.firstPageUrl, '_blank');
        return;
      }
      
      // Otherwise try to fetch it from the path
      if (project.firstPagePath) {
        const storage = getConfiguredStorage();
        const imageRef = ref(storage, project.firstPagePath);
        const url = await getDownloadURL(imageRef);
        
        // Open the image in a new tab
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error("Error downloading original image:", error);
      toast.error("Failed to download original image.");
    }
  };
  
  // Filter projects based on active tab
  const filteredProjects = projects.filter(project => {
    if (activeTab === "pending") {
      return !project.hasProcessedImage;
    } else if (activeTab === "processed") {
      return project.hasProcessedImage;
    }
    return true;
  });
  
  // Filter by search term
  const searchedProjects = filteredProjects.filter(project => 
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

  // Send notification email to customer about processed image
  const handleNotifyCustomer = async (project: ProjectInfo) => {
    console.log("Starting notification process for project:", project.id);
    
    if (!user || !project.userEmail) {
      const errorMsg = "Cannot send notification: Missing user email";
      console.error(errorMsg, { user, projectEmail: project.userEmail });
      toast.error(errorMsg);
      return;
    }
    
    // Ask for confirmation before sending
    if (!window.confirm(`Send email notification to ${project.userEmail}?`)) {
      console.log("Notification cancelled by user");
      return;
    }
    
    setIsNotifying(true);
    
    try {
      // Get the functions instance
      const functions = getFunctions();
      console.log("Firebase functions initialized");
      
      // Prepare notification data
      const notificationData = {
        projectId: project.id,
        userId: project.userId,
        userEmail: project.userEmail,
        projectTitle: project.title || "Your Coloring Book",
        productType: project.productType || "standard",
        artStyle: project.artStyle || "classic"
      };
      
      console.log("Notification data prepared:", notificationData);
      
      let result;
      let success = false;
      
      // Try the first function name
      try {
        console.log("Trying primary function: sendProcessingCompleteNotification");
        const sendPrimaryNotification = httpsCallable(functions, 'sendProcessingCompleteNotification');
        result = await sendPrimaryNotification(notificationData);
        success = true;
        console.log("Primary function succeeded:", result.data);
      } catch (primaryError) {
        console.error("Primary function failed:", primaryError);
        
        // Try the fallback function name
        try {
          console.log("Trying fallback function: sendProcessedNotification");
          const sendFallbackNotification = httpsCallable(functions, 'sendProcessedNotification');
          result = await sendFallbackNotification(notificationData);
          success = true;
          console.log("Fallback function succeeded:", result.data);
        } catch (fallbackError) {
          console.error("Fallback function also failed:", fallbackError);
          throw fallbackError; // Re-throw to be caught by outer catch
        }
      }
      
      if (success && result) {
        // Mark as notified in our local state
        setNotifiedProjects(prev => ({
          ...prev,
          [project.id]: true
        }));
        
        // Update the project database with notification status
        const db = getFirestore();
        const projectRef = doc(db, `users/${project.userId}/projects/${project.id}`);
        
        await updateDoc(projectRef, {
          notificationSent: true,
          notificationSentAt: new Date() // Using JS Date instead of serverTimestamp
        });
        
        console.log("Project updated in database. Notification complete!");
        toast.success(`Notification email sent to ${project.userEmail}`);
      } else {
        console.error("Both functions failed or returned invalid results");
        toast.error("Failed to send notification - both attempts failed");
      }
    } catch (error: any) {
      console.error("Error sending notification:", error);
      
      // Try to extract useful error information
      const errorMessage = error.message || "Unknown error";
      const errorCode = error.code || "unknown";
      const errorDetails = error.details ? JSON.stringify(error.details) : "No details";
      
      console.error("Error details:", { errorCode, errorMessage, errorDetails });
      toast.error(`Failed to send notification: ${errorMessage}`);
    } finally {
      setIsNotifying(false);
    }
  };

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
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Project Details</h1>
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
              handleDownloadOriginal={handleDownloadOriginal}
              handleUploadProcessed={handleUploadProcessed}
              uploading={uploading}
              selectedProject={selectedProject}
              uploadProgress={uploadProgress}
              handleNotifyCustomer={handleNotifyCustomer}
              isNotifying={isNotifying}
              notifiedProjects={notifiedProjects}
              user={user}
            />
          ) : (
            /* Show tabs view for all projects */
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8">
                <TabsTrigger
                  value="pending"
                  className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700"
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Pending Processing
                </TabsTrigger>
                <TabsTrigger 
                  value="processed" 
                  className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Processed
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
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
                        handleDownloadOriginal={handleDownloadOriginal}
                        handleUploadProcessed={handleUploadProcessed}
                        uploading={uploading}
                        selectedProject={selectedProject}
                        uploadProgress={uploadProgress}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="rounded-full bg-amber-100 p-6 mb-4">
                        <FileUp className="h-10 w-10 text-amber-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No Pending Projects</h3>
                      <p className="text-gray-500 text-center max-w-md mb-6">
                        {searchTerm 
                          ? "No projects match your search criteria." 
                          : "All projects have been processed or no projects exist."}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="processed">
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
                        handleDownloadOriginal={handleDownloadOriginal}
                        handleUploadProcessed={handleUploadProcessed}
                        uploading={uploading}
                        selectedProject={selectedProject}
                        uploadProgress={uploadProgress}
                        isProcessed={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="rounded-full bg-green-100 p-6 mb-4">
                        <Eye className="h-10 w-10 text-green-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">No Processed Projects</h3>
                      <p className="text-gray-500 text-center max-w-md mb-6">
                        {searchTerm 
                          ? "No processed projects match your search criteria." 
                          : "When projects are processed, they will appear here."}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
              <p className="text-xs text-gray-500">© 2023 StoryInColor. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ProjectCard component for displaying projects in the list view
function ProjectCard({ 
  project, 
  handleDownloadOriginal, 
  handleUploadProcessed, 
  uploading, 
  selectedProject, 
  uploadProgress, 
  isProcessed = false 
}: { 
  project: ProjectInfo; 
  handleDownloadOriginal: (project: ProjectInfo) => Promise<void>; 
  handleUploadProcessed: (event: React.ChangeEvent<HTMLInputElement>, project: ProjectInfo) => Promise<void>; 
  uploading: boolean; 
  selectedProject: ProjectInfo | null; 
  uploadProgress: number; 
  isProcessed?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Card className="overflow-hidden">
      <div className="relative h-40">
        {project.firstPageUrl && !imageError ? (
          <PathImg 
            src={project.firstPageUrl} 
            alt={project.title}
            fill
            className="object-cover"
            onError={() => {
              console.log(`Image loading error for project ${project.id}`);
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
          Created: {project.createdAt}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="bg-blue-100 px-2 py-1 rounded-full">
            <span className="text-xs text-blue-700 font-medium">{project.productType}</span>
          </div>
          <div className="bg-purple-100 px-2 py-1 rounded-full">
            <span className="text-xs text-purple-700 font-medium">{project.artStyle || 'Classic'}</span>
          </div>
          <div className={isProcessed ? "bg-green-100 px-2 py-1 rounded-full" : "bg-amber-100 px-2 py-1 rounded-full"}>
            <span className={isProcessed ? "text-xs text-green-700 font-medium" : "text-xs text-amber-700 font-medium"}>
              {isProcessed ? "Processed" : "Needs Processing"}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleDownloadOriginal(project)}
            disabled={!project.firstPageUrl || imageError}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          
          {!isProcessed && (
            <div className="relative flex-1">
              <Button 
                size="sm"
                variant="default"
                className={uploading && selectedProject?.id === project.id ? "w-full bg-green-600 hover:bg-green-700" : "w-full"}
                disabled={uploading || !project.firstPageUrl || imageError}
              >
                <UploadCloud className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <Input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleUploadProcessed(e, project)}
                disabled={uploading || !project.firstPageUrl || imageError}
              />
            </div>
          )}
        </div>
      </CardContent>
      
      {uploading && selectedProject?.id === project.id && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div 
              className="bg-green-600 h-2.5 rounded-full" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-center mt-1">
            Uploading: {Math.round(uploadProgress)}%
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// SingleProjectView component for displaying a single project in detail view
function SingleProjectView({ 
  project, 
  handleDownloadOriginal, 
  handleUploadProcessed, 
  uploading, 
  selectedProject, 
  uploadProgress,
  handleNotifyCustomer,
  isNotifying,
  notifiedProjects,
  user
}: { 
  project: ProjectInfo; 
  handleDownloadOriginal: (project: ProjectInfo) => Promise<void>; 
  handleUploadProcessed: (event: React.ChangeEvent<HTMLInputElement>, project: ProjectInfo) => Promise<void>;
  uploading: boolean; 
  selectedProject: ProjectInfo | null; 
  uploadProgress: number;
  handleNotifyCustomer: (project: ProjectInfo) => Promise<void>;
  isNotifying: boolean;
  notifiedProjects: Record<string, boolean>;
  user: any;
}) {
  const isProcessed = project.hasProcessedImage;
  const [originalImageError, setOriginalImageError] = useState(false);
  const [processedImageError, setProcessedImageError] = useState(false);
  
  return (
    <div className="grid grid-cols-1 gap-8">
      {/* Project Information */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Details about this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Title</h3>
                <p className="text-base font-medium">{project.title}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Created Date</h3>
                <p className="text-base">{project.createdAt}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">User Email</h3>
                <p className="text-base">{project.userEmail || 'Unknown'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Product Type</h3>
                <p className="text-base">{project.productType}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Art Style</h3>
                <p className="text-base">{project.artStyle || 'Classic'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                <p>
                  <span className={isProcessed 
                    ? "bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm"
                    : "bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-sm"
                  }>
                    {isProcessed ? "Processed" : "Needs Processing"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Original Image */}
      <Card>
        <CardHeader>
          <CardTitle>Original Image</CardTitle>
          <CardDescription>The first image uploaded by the user</CardDescription>
        </CardHeader>
        <CardContent>
          {project.firstPageUrl && !originalImageError ? (
            <div className="relative aspect-video mb-4 border rounded-lg overflow-hidden">
              <PathImg
                src={project.firstPageUrl}
                alt={`Original photo for ${project.title}`}
                fill
                className="object-contain"
                onError={() => {
                  console.log(`Original image loading error for project ${project.id}`);
                  setOriginalImageError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 bg-gray-100 rounded-lg">
              <p className="text-gray-500">No original image available</p>
            </div>
          )}
          
          <div className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => handleDownloadOriginal(project)}
              disabled={!project.firstPageUrl || originalImageError}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Original Image
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Processed Image or Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>{isProcessed ? "Processed Image" : "Upload Processed Image"}</CardTitle>
          <CardDescription>
            {isProcessed 
              ? "The processed version ready for preview" 
              : "Upload the processed version of this image"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isProcessed && project.processedImageUrl && !processedImageError ? (
            <>
              <div className="relative aspect-video mb-4 border rounded-lg overflow-hidden">
                <PathImg
                  src={project.processedImageUrl}
                  alt={`Processed image for ${project.title}`}
                  fill
                  className="object-contain"
                  onError={() => {
                    console.log(`Processed image loading error for project ${project.id}`);
                    setProcessedImageError(true);
                  }}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  asChild
                >
                  <Link href={`/preview?id=${project.id}`} target="_blank">
                    <Eye className="mr-2 h-4 w-4" />
                    View Preview Page
                  </Link>
                </Button>
                
                {/* Notify Customer Button */}
                <Button
                  variant={notifiedProjects[project.id] ? "outline" : "default"}
                  className={notifiedProjects[project.id] ? 
                    "border-blue-500 text-blue-500 hover:bg-blue-50" : 
                    "bg-blue-600 hover:bg-blue-700 text-white"}
                  onClick={() => {
                    console.log("Notify button clicked for project:", project.id);
                    handleNotifyCustomer(project);
                  }}
                  disabled={isNotifying}
                >
                  {isNotifying ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-b-2 border-current rounded-full mr-2"></div>
                      Sending...
                    </>
                  ) : notifiedProjects[project.id] ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Customer Notified
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Notify Customer
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : isProcessed && (processedImageError || !project.processedImageUrl) ? (
            <>
              <div className="flex items-center justify-center h-40 bg-gray-100 rounded-lg">
                <p className="text-gray-500">Processed image not available</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  asChild
                >
                  <Link href={`/preview?id=${project.id}`} target="_blank">
                    <Eye className="mr-2 h-4 w-4" />
                    View Preview Page
                  </Link>
                </Button>
                
                <div className="relative">
                  <Button 
                    variant="outline" 
                    className="border-orange-500 text-orange-500 hover:bg-orange-50 w-full"
                    disabled={uploading}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload New Processed Image
                  </Button>
                  <Input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleUploadProcessed(e, project)}
                    disabled={uploading}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 hover:border-green-500 transition-colors mb-4">
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="rounded-full bg-green-100 p-4 mb-4">
                    <UploadCloud className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Upload Processed Image</h3>
                  <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                  
                  <div className="relative w-full max-w-xs">
                    <Button 
                      variant="default" 
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={uploading || !project.firstPageUrl || originalImageError}
                    >
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Upload Processed Image
                    </Button>
                    <Input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleUploadProcessed(e, project)}
                      disabled={uploading || !project.firstPageUrl || originalImageError}
                    />
                  </div>
                </div>
              </div>
              
              {uploading && selectedProject?.id === project.id && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-center mt-1">
                    Uploading: {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 