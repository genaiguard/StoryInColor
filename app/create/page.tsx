"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight, Upload, ImagePlus, Check, Trash2, X, Loader2, Wand2, RotateCcw, PlusCircle, CheckCircle, AlertTriangle, Crop, Image, Info, Sparkles, ShoppingCart, FileDown, Pencil, ChevronLeft, ChevronRight } from "lucide-react"
import { UploadProvider, useUpload } from "@/app/context/upload-context"
import { v4 as uuidv4 } from "uuid"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"
import { getFunctions, httpsCallable } from "firebase/functions"
import { toast } from "sonner"
import { PathImg } from "@/components/ui/pathed-image"
import { debounce } from 'lodash'
import { getUserCredits, useCredit, formatCreditBalance } from "@/app/firebase/credits-helpers"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Insert the ProjectData interface
interface OriginalImage {
  id: string;
  name: string;
  previewUrl: string; // Blob URL for local preview
  storagePath?: string; // Path in Firebase Storage
  uploaded: boolean;
}

interface ImageVersion {
  versionId: string;
  createdAt: any; // Firestore Timestamp or Date
  originalStoragePath: string; // Path to the raw OpenAI output (b64?)
  watermarkedStoragePath: string; // Path to the watermarked PNG/WEBP
  watermarkedPreviewUrl?: string; // Optional: Signed URL for direct display
  artStyle: string; // Added artStyle to version
}

interface Page {
  id: string; // UUID for the page itself
  pageNumber: number;
  originalImage: OriginalImage | null;
  isProcessing: boolean; // Flag for OpenAI API call in progress
  processingError: string | null;
  versions: ImageVersion[];
  selectedVersionId: string | null;
  isPreparingToRegenerate?: boolean; // Add optional flag
}

interface ProjectData {
  pages: Page[];
  userId: string;
  updatedAt: any; // ServerTimestamp
  createdAt?: any; // ServerTimestamp (on create)
  pdfPath?: string; // Path to final PDF in storage
  title?: string; // Optional title field
  pdfUrl?: string; // URL to download the generated PDF
  pdfGeneratedAt?: any; // Timestamp when PDF was last generated
}

const MAX_PAGES = 40;

const steps = [
  { id: "options", label: "Product Options" },
  { id: "style", label: "Art Style" },
  { id: "upload", label: "Upload Photos" },
  { id: "arrange", label: "Arrange Pages" },
]

export default function CreatePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading Creator..." />}>
      <CreatePageContent />
    </Suspense>
  )
}

function CreatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [projectId, setProjectId] = useState<string | null>(null)
  const initRef = useRef(false)

  const { user, initialized: firebaseInitialized } = useFirebase()

  const [pages, setPages] = useState<Page[]>([])
  const [bookTitle, setBookTitle] = useState<string>("My Coloring Pages")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true)
  const [projectExists, setProjectExists] = useState<boolean>(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  const [credits, setCredits] = useState<number>(0)
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true)
  const [showCreditUI, setShowCreditUI] = useState<boolean>(false)
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false)
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false)
  const [showWatermarkNoticeAlert, setShowWatermarkNoticeAlert] = useState<boolean>(false)
  const [pdfGenerationProceedAnyway, setPdfGenerationProceedAnyway] = useState<boolean>(false)
  const [printButtonDisabledReason, setPrintButtonDisabledReason] = useState<string | null>(null)

  // Add state for notice visibility
  const [showNotices, setShowNotices] = useState({
    trimming: true,
    portrait: true,
    copyright: true
  });
  
  const dismissNotice = (noticeKey: 'trimming' | 'portrait' | 'copyright') => {
    setShowNotices(prev => ({
      ...prev,
      [noticeKey]: false
    }));
  };

  // Add credits loading useEffect
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user || !firebaseInitialized) return;
      
      try {
        setIsLoadingCredits(true);
        const userCredits = await getUserCredits(user.uid);
        setCredits(userCredits.balance);
      } catch (error) {
        console.error("Error loading credits:", error);
        toast.error("Failed to load your credits");
      } finally {
        setIsLoadingCredits(false);
      }
    };
    
    loadUserCredits();
  }, [user, firebaseInitialized]);

  // --- Project ID Initialization --- (Run once on mount, respecting StrictMode)
  useEffect(() => {
    // Prevent running twice in StrictMode
    if (initRef.current) {
      return;
    }
    initRef.current = true; // Mark as initialized for this mount cycle

    const urlId = searchParams.get("id")
    if (urlId) {
      console.log("Using projectId from URL:", urlId)
      setProjectId(urlId)
    } else {
      const newId = uuidv4()
      console.log("Generating new projectId (once):", newId)
      setProjectId(newId)
      setIsLoadingProject(false)
      setProjectExists(false)
    }
  }, [searchParams])

  // --- Project Loading --- (Depends on projectId being set)
  useEffect(() => {
    // Wait for projectId, firebase, and user
    if (!projectId || !firebaseInitialized || !user) {
      // If projectId is null (initial state) or firebase/user not ready, don't load yet
      // We set isLoadingProject=false for new projects in the previous effect
      // For existing projects (URL id), keep isLoadingProject true until loaded
      if (searchParams.get("id")) {
        setIsLoadingProject(true)
      }
      return
    }

    // If it's a new project ID (determined in the first effect), don't try loading
    if (!searchParams.get("id")) {
      console.log("New project, skipping Firestore load.")
      setIsLoadingProject(false)
      return
    }

    // Only load if it's an existing project ID from URL
    const loadProject = async () => {
      setIsLoadingProject(true)
      console.log("Attempting to load existing project:", projectId)
        const db = getFirestore()
      const projectRef = doc(db, "users", user.uid, "projects", projectId)
      try {
        const docSnap = await getDoc(projectRef)
        if (docSnap.exists()) {
          console.log("Existing project found, loading data...")
          const data = docSnap.data() as ProjectData
          setBookTitle(data.title || "My Coloring Pages")
          const sortedPages = (data.pages || []).sort((a, b) => a.pageNumber - b.pageNumber)
          
          // Fetch preview URLs for existing versions
          const storage = getConfiguredStorage();
          const pagesWithPreviewUrls = await Promise.all(
            sortedPages.map(async (page) => {
              // Fetch URL for original image if it exists
              let updatedOriginalImage = page.originalImage;
              if (updatedOriginalImage?.storagePath) {
                try {
                  const originalUrl = await getDownloadURL(ref(storage, updatedOriginalImage.storagePath));
                  updatedOriginalImage = {
                    ...updatedOriginalImage,
                    previewUrl: originalUrl
                  };
                } catch (error) {
                  console.error(`Failed to get preview URL for original image in page ${page.id}:`, error);
                }
              }
              
              const versionsWithPreviewUrls = await Promise.all(
                page.versions.map(async (version) => {
                  if (version.watermarkedStoragePath) {
                    try {
                      const url = await getDownloadURL(ref(storage, version.watermarkedStoragePath));
                      return { ...version, watermarkedPreviewUrl: url };
                    } catch (error) {
                      console.error(`Failed to get preview URL for version ${version.versionId} in page ${page.id}:`, error);
                      // Return version without preview URL on error
                      return version; 
                    }
                  } else {
                    return version; // No path, return as is
                  }
                })
              );
              return { ...page, originalImage: updatedOriginalImage, versions: versionsWithPreviewUrls };
            })
          );
          
          setPages(pagesWithPreviewUrls) // Set state with pages including fetched URLs
          setProjectExists(true)
          setLastSaved(data.updatedAt?.toDate() || null)
        } else {
          console.error("Error: Project ID from URL not found:", projectId)
          toast.error("Could not find the specified project.")
          // Optional: redirect to dashboard or show error state
          router.push("/dashboard") // Example redirect
        }
      } catch (error) {
        console.error("Error loading project:", error)
        toast.error("Failed to load project data.")
      } finally {
        setIsLoadingProject(false)
      }
    }
    
    loadProject()
  }, [projectId, user, firebaseInitialized, router, searchParams]) // Add router/searchParams as needed

  // --- Incremental Saving Logic --- (Depends on projectId being stable)
  const debouncedSave = useCallback(
    debounce(async (currentProjectId: string, currentPages: Page[], currentBookTitle: string, currentProjectExists: boolean) => {
      // Ensure we have a projectId before trying to save
      if (!user || isLoadingProject || !currentProjectId) return

      setIsSaving(true)
      console.log("Debounced save triggered for project:", currentProjectId)

      const db = getFirestore()
      const projectRef = doc(db, "users", user.uid, "projects", currentProjectId)

      // Ensure page numbers are sequential before saving
      const pagesWithUpdatedNumbers = currentPages.map((p, index) => ({ 
        ...p, 
        pageNumber: index + 1 
      }));
      
      console.log("Saving pages with updated page numbers:", 
        pagesWithUpdatedNumbers.map(p => ({ id: p.id, pageNumber: p.pageNumber }))
      );

      // Check if we need to update the timestamp - only do this for real changes, not just on load
      let shouldUpdateTimestamp = true;
      
      // If the project exists, compare with existing data
      if (currentProjectExists) {
        try {
          const existingDoc = await getDoc(projectRef);
          if (existingDoc.exists()) {
            const existingData = existingDoc.data() as ProjectData;
            
            // Check if title changed
            const titleChanged = existingData.title !== currentBookTitle;
            
            // Check if pages changed (count, order, versions)
            let pagesChanged = existingData.pages?.length !== pagesWithUpdatedNumbers.length;
            
            // If page count is the same, do a deeper check
            if (!pagesChanged && existingData.pages) {
              // Check each page for changes
              for (let i = 0; i < pagesWithUpdatedNumbers.length; i++) {
                const currentPage = pagesWithUpdatedNumbers[i];
                const existingPage = existingData.pages.find(p => p.id === currentPage.id);
                
                if (!existingPage || 
                    existingPage.pageNumber !== currentPage.pageNumber ||
                    existingPage.selectedVersionId !== currentPage.selectedVersionId ||
                    existingPage.versions.length !== currentPage.versions.length) {
                  pagesChanged = true;
                  break;
                }
              }
            }
            
            // Only update timestamp if something actually changed
            shouldUpdateTimestamp = titleChanged || pagesChanged;
            console.log("Content changed?", shouldUpdateTimestamp, "Title changed?", titleChanged, "Pages changed?", pagesChanged);
          }
        } catch (error) {
          console.error("Error checking for changes:", error);
          // On error, default to updating timestamp to be safe
          shouldUpdateTimestamp = true;
        }
      }

      const dataToSave: Partial<ProjectData> = {
        pages: pagesWithUpdatedNumbers, // Use pages with updated numbers
        userId: user.uid,
        title: currentBookTitle,
      }
      
      // Only include updatedAt if something actually changed
      if (shouldUpdateTimestamp) {
        dataToSave.updatedAt = serverTimestamp();
      }

      try {
        if (currentProjectExists) {
          console.log("Updating existing project:", currentProjectId, shouldUpdateTimestamp ? "with timestamp update" : "without timestamp update");
          await updateDoc(projectRef, dataToSave)
        } else {
          console.log("Creating new project:", currentProjectId)
          dataToSave.createdAt = serverTimestamp()
          dataToSave.updatedAt = serverTimestamp() // Always include timestamp for new projects
          await setDoc(projectRef, dataToSave)
          // Important: Update projectExists state AFTER successful creation
          setProjectExists(true)
        }
        setLastSaved(new Date())
        console.log("Project saved successfully.")
      } catch (error) {
        console.error("Error saving project:", error)
        toast.error("Failed to save progress.")
      } finally {
        setIsSaving(false)
      }
    }, 2000),
    [user, isLoadingProject] // Keep minimal dependencies for the callback itself
  )

  // Trigger save whenever pages, artStyle, or bookTitle changes (and projectId is set)
  useEffect(() => {
    // Don't save initial state immediately after loading or if projectId isn't set
    if (!isLoadingProject && projectId) {
      // Pass the stable projectId and current projectExists state to the debounced function
      console.log("Pages, or title changed, scheduling save for project:", projectId)
      debouncedSave(projectId, pages, bookTitle, projectExists)
    }
  }, [pages, bookTitle, debouncedSave, isLoadingProject, projectId, projectExists])

  // --- Page Management Functions ---
  const addPage = () => {
    if (pages.length >= MAX_PAGES) {
      toast.warning(`Maximum limit of ${MAX_PAGES} pages reached. Cannot add more pages.`)
      return
    }
    const newPage: Page = {
      id: uuidv4(),
      pageNumber: pages.length + 1,
      originalImage: null,
      isProcessing: false,
      processingError: null,
      versions: [],
      selectedVersionId: null,
      isPreparingToRegenerate: false, // Initialize flag
    }
    setPages(prevPages => [...prevPages, newPage])
    console.log("Added new page:", newPage.id)
  }

  const removePage = async (pageId: string) => {
    const pageToRemove = pages.find(p => p.id === pageId)
    if (!pageToRemove) return

    // Confirmation
    if (!window.confirm(`Are you sure you want to remove page ${pageToRemove.pageNumber}? Any generated versions will be lost.`)) {
      return
    }

    console.log("Removing page:", pageId)

    // Optimistic UI update
    const updatedPages = pages
      .filter(p => p.id !== pageId)
      .map((p, index) => ({ ...p, pageNumber: index + 1 })) // Re-number pages
    setPages(updatedPages)

    // --- Cleanup Storage (Original + All Versions) ---
    // Needs error handling, maybe move to a cloud function?
    const storage = getConfiguredStorage()
    const deletePromises: Promise<void>[] = []

    // Delete original image if it exists
    if (pageToRemove.originalImage?.storagePath) {
      console.log("Scheduling delete for original image:", pageToRemove.originalImage.storagePath)
      deletePromises.push(deleteObject(ref(storage, pageToRemove.originalImage.storagePath)).catch(err => console.error("Failed to delete original image:", err)))
    }

    // Delete all version files (original OpenAI output + watermarked)
    pageToRemove.versions.forEach(version => {
      if (version.originalStoragePath) {
        console.log("Scheduling delete for original version:", version.originalStoragePath)
        deletePromises.push(deleteObject(ref(storage, version.originalStoragePath)).catch(err => console.error("Failed to delete original version:", err)))
      }
      if (version.watermarkedStoragePath) {
        console.log("Scheduling delete for watermarked version:", version.watermarkedStoragePath)
        deletePromises.push(deleteObject(ref(storage, version.watermarkedStoragePath)).catch(err => console.error("Failed to delete watermarked version:", err)))
      }
    })

    try {
      await Promise.all(deletePromises)
      console.log("Storage cleanup for page", pageId, "completed.")
    } catch (error) {
      console.error("Error during storage cleanup for page", pageId, ":", error)
      // Note: Page is already removed from UI state and will be saved without the removed page data.
      // Consider how to handle potential orphaned files if cleanup fails.
    }
    // Debounced save will handle updating Firestore state without the removed page.
  }

  const movePage = useCallback((dragIndex: number, hoverIndex: number) => {
    setPages((prevPages: Page[]) => {
      const updatedPages = [...prevPages];
      // Remove the dragged item
      const [movedPage] = updatedPages.splice(dragIndex, 1);
      // Insert it at the new position
      updatedPages.splice(hoverIndex, 0, movedPage);
      
      // Re-assign page numbers based on new order
      const pagesWithUpdatedNumbers = updatedPages.map((page, index) => ({
        ...page,
        pageNumber: index + 1,
      }));
      
      console.log(`Moved page from index ${dragIndex} to ${hoverIndex}, updated page numbers`);
      console.log("New page order:", pagesWithUpdatedNumbers.map(p => ({ id: p.id, pageNumber: p.pageNumber })));
      
      return pagesWithUpdatedNumbers;
    });
    
    // The pages state update will trigger the useEffect and schedule the debounced save
    // But the caller can also manually flush it for immediate save
  }, [])

  const handleImageUpload = async (pageId: string, file: File) => {
    if (!user) return
    console.log(`Uploading image for page ${pageId}:`, file.name)

    const pageIndex = pages.findIndex(p => p.id === pageId)
    if (pageIndex === -1) return

    const imageId = uuidv4()
    const previewUrl = URL.createObjectURL(file)

    // Optimistic UI update with local preview
    const newOriginalImage: OriginalImage = {
      id: imageId,
      name: file.name,
      previewUrl: previewUrl,
      uploaded: false, // Mark as not yet uploaded to storage
    }
    setPages(prevPages => prevPages.map(p => p.id === pageId ? { ...p, originalImage: newOriginalImage, versions: [], selectedVersionId: null, processingError: null } : p)) // Clear versions when new image is uploaded

    // --- Upload to Firebase Storage ---
    const storagePath = `users/${user.uid}/projects/${projectId}/pages/${pageId}/original_${imageId}.${file.name.split('.').pop()}`
    const storageRef = ref(getConfiguredStorage(), storagePath)
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on('state_changed',
      (snapshot) => {
        // Optional: Handle progress
        // const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      },
      (error) => {
        console.error("Upload failed:", error)
        toast.error(`Upload failed for ${file.name}`)
        // Revert optimistic update or mark as failed
        setPages(prevPages => prevPages.map(p => p.id === pageId ? { ...p, originalImage: null } : p)) // Example: Remove image on failure
      },
      async () => {
        // Upload complete
        console.log("Upload successful, path:", storagePath)
        // Update page state with storage path and mark as uploaded
        setPages(prevPages => prevPages.map(p => p.id === pageId && p.originalImage?.id === imageId ? { ...p, originalImage: { ...p.originalImage, storagePath: storagePath, uploaded: true } } : p))
        // Debounced save will eventually persist this storagePath
      }
    )
  }

  // --- Add functions to handle regeneration state ---
  const prepareForRegeneration = (pageId: string) => {
    setPages(prevPages => 
      prevPages.map(p => 
        p.id === pageId ? { ...p, isPreparingToRegenerate: true } : p
      )
    );
    console.log(`Preparing page ${pageId} for regeneration.`);
  };

  const cancelRegeneration = (pageId: string) => {
    setPages(prevPages => 
      prevPages.map(p => 
        p.id === pageId ? { ...p, isPreparingToRegenerate: false } : p
      )
    );
    console.log(`Cancelled regeneration for page ${pageId}.`);
  };

  // --- Image Conversion --- (Calls the Cloud Function)
  const handleConvertImage = async (pageId: string, artStyle: string) => {
    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) {
      toast.error("Page not found.");
      return;
    }

    const page = pages[pageIndex];
    if (!page.originalImage?.storagePath) {
      toast.error("Original image not uploaded yet.");
      return;
    }
    if (!projectId) {
      toast.error("Project ID not found.");
      return;
    }

    // Prevent multiple simultaneous requests for the same page
    if (page.isProcessing) {
        toast.info("Image processing is already in progress for this page.");
        return;
    }
    
    // Check if user has enough credits
    if (credits <= 0) {
      setShowCreditUI(true);
      toast.error("You need to purchase credits to generate more coloring pages");
      return;
    }

    // Update page state to indicate processing
    setPages(prevPages => 
      prevPages.map(p => p.id === pageId ? { ...p, isProcessing: true, processingError: null, isPreparingToRegenerate: false } : p)
    );

    try {
      console.log(`Calling processImageWithOpenAI for page ${pageId} with style ${artStyle}`)
      const functions = getFunctions();
      const processImage = httpsCallable(functions, 'processImageWithOpenAI');
      
      // Use a credit
      const creditUsed = await useCredit(user.uid, projectId, pageId);
      if (!creditUsed) {
        throw new Error("Failed to use credit. Please check your balance.");
      }
      
      // Update local credit balance
      setCredits(prevCredits => prevCredits - 1);
      
      const result = await processImage({ 
        projectId: projectId,
        pageId: pageId,
        originalImageStoragePath: page.originalImage.storagePath,
        artStyle: artStyle // Pass the selected artStyle
      });

      console.log("Cloud function result:", result.data);

      // Update page state with the new version from the result
      const resultData = result.data as { success: boolean; newVersion?: ImageVersion; message?: string, watermarkedUrl?: string };
      if (resultData.success && resultData.newVersion) {
        
        let versionWithPreviewUrl = resultData.newVersion;
        
        // Fetch download URL for the preview
        if (versionWithPreviewUrl.watermarkedStoragePath) {
          try {
            const storage = getConfiguredStorage();
            const previewUrl = await getDownloadURL(ref(storage, versionWithPreviewUrl.watermarkedStoragePath));
            versionWithPreviewUrl = { ...versionWithPreviewUrl, watermarkedPreviewUrl: previewUrl };
            console.log("Fetched preview URL:", previewUrl)
          } catch (urlError) {
            console.error("Failed to get preview URL for new version:", urlError);
            // Proceed without preview URL, maybe show a placeholder or error in UI
          }
        }
        
        // Capture the updated pages state here for immediate save
        let finalPagesState: Page[] | undefined = undefined;
        setPages(prevPages => {
          const updated = prevPages.map(p => 
            p.id === pageId ? 
            { 
              ...p, 
              versions: [...p.versions, versionWithPreviewUrl], // Use version with preview URL
              selectedVersionId: versionWithPreviewUrl.versionId, // Auto-select the new version
              isProcessing: false 
            } : 
            p
        );
          finalPagesState = updated; // Capture the state
          return updated;
        });

        toast.success("Coloring page version created!");

        // After state is updated, flush the debounced save to persist this exact state
        if (finalPagesState && projectId) {
          console.log("Flushing debouncedSave after successful image conversion with final pages state.");
          // Ensure debouncedSave uses the very latest state by passing it directly if its implementation allows,
          // or rely on its next scheduled run if it correctly captures from the useEffect.
          // Forcing an immediate save with the correct state is safer here.
          // We need to ensure projectId, bookTitle, and projectExists are current.
          // Let's assume debouncedSave will pick up the latest bookTitle and projectExists from state when it runs.
          // A direct call to a non-debounced save function would be cleaner if available.
          // Flushing will execute the debounced function immediately with its currently scheduled arguments.
          // To ensure it uses THIS finalPagesState, it's tricky if debouncedSave relies on arguments from its last *call*.
          // The most reliable way is to have a separate save function or ensure debouncedSave can take explicit state.

          // Simplest approach for now: cancel pending and re-schedule with latest known pages.
          // This depends on debouncedSave correctly using the arguments passed to it.
          debouncedSave.cancel(); // Cancel any pending stale save
          console.log("Calling debouncedSave directly with latest pages after conversion.");
          debouncedSave(projectId, finalPagesState, bookTitle, projectExists); 
        }

      } else {
        throw new Error(resultData.message || "Failed to process image in cloud function.");
      }

    } catch (error) {
      console.error("Error calling processImageWithOpenAI:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error processing image.";
      toast.error(`Image processing failed: ${errorMessage}`);
      // Update page state to show error
      setPages(prevPages => 
        prevPages.map(p => p.id === pageId ? { ...p, isProcessing: false, processingError: errorMessage } : p)
      );
    }
  };

  const selectVersion = (pageId: string, versionId: string) => {
    setPages(prevPages => prevPages.map(p => p.id === pageId ? { ...p, selectedVersionId: versionId } : p))
    console.log(`Selected version ${versionId} for page ${pageId}`)
  }

  // --- PDF Generation ---

  // Add state for storing PDF URL and visibility of the download link
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [showPdfLink, setShowPdfLink] = useState<boolean>(false);

  // PDF Generation Function (wrapped in useCallback)
  const handleGeneratePDF = useCallback(async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top

    if (!projectId || !user) {
      toast.error("Project ID or user not available. Cannot proceed.");
      return;
    }

    // Ensure all pages have images and selected versions
    const pagesReady = pages.every(p => p.originalImage && p.selectedVersionId);
    if (!pagesReady || pages.length === 0) {
      toast.error("Please ensure all pages have an uploaded image and a selected coloring version before generating PDF.");
      return;
    }

    // Check for non-purchaser status
    if (!pdfGenerationProceedAnyway) {
      try {
        const userCreditsData = await getUserCredits(user.uid);
        const hasMadePurchase = userCreditsData.purchaseHistory?.some(item => !item.isInitialCredits);

        if (!hasMadePurchase) {
          setShowWatermarkNoticeAlert(true);
          return; // Stop PDF generation until user makes a choice
        }
      } catch (error) {
        console.error("Error fetching user credits for PDF generation:", error);
        toast.error("Could not verify your purchase status. Please try again.");
        return;
      }
    }
    
    // Ensure latest state is saved
    debouncedSave.flush();
    
    if (isSaving) {
      toast.info("Saving progress before generating PDF...");
      // Check again after delay, in case the save was quick
      setTimeout(() => {
        if (isSaving) { // If still saving after delay
          toast.info("Still saving... please wait a moment before trying again.");
          return;
        }
        handleGeneratePDF(); // Retry PDF generation
      }, 1500); // Increased delay slightly
      return;
    }
    
    setGeneratingPDF(true);
    if (pdfGenerationProceedAnyway) {
      setPdfGenerationProceedAnyway(false); // Reset the flag
    }
    
    try {
      // First check if an existing PDF is available and still valid
      const db = getFirestore();
      const projectRef = doc(db, "users", user.uid, "projects", projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as ProjectData;
        
        // If there's an existing PDF and the project hasn't been updated since last PDF generation
        if (projectData.pdfUrl && projectData.pdfGeneratedAt && projectData.updatedAt) {
          const pdfGeneratedAt = projectData.pdfGeneratedAt.toDate ? projectData.pdfGeneratedAt.toDate() : new Date(projectData.pdfGeneratedAt);
          const lastUpdatedAt = projectData.updatedAt.toDate ? projectData.updatedAt.toDate() : new Date(projectData.updatedAt);
          
          // Compare timestamps - if PDF was generated after the last update, use the existing PDF
          if (pdfGeneratedAt >= lastUpdatedAt) {
            toast.success("Using existing PDF - no changes detected since last generation.");
            setCurrentPdfUrl(projectData.pdfUrl);
            setShowPdfLink(true);
            setGeneratingPDF(false);
            return;
          }
        }
      }
      
      // If we reached here, we need to generate a new PDF
      const functions = getFunctions();
      const generatePDFCallable = httpsCallable(functions, 'generateProjectPDF'); // Renamed for clarity
      
      const result = await generatePDFCallable({ projectId });
      const data = result.data as { success: boolean; pdfUrl?: string; message?: string };
      
      if (data.success && data.pdfUrl) {
        // Store the PDF URL and generation timestamp in the project document
        await updateDoc(projectRef, {
          pdfUrl: data.pdfUrl,
          pdfGeneratedAt: serverTimestamp()
        });
        
        toast.success("PDF generated successfully!");
        // Set the PDF URL in state and show the download link
        setCurrentPdfUrl(data.pdfUrl);
        setShowPdfLink(true);
      } else {
        throw new Error(data.message || "Failed to generate PDF.");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error generating PDF.";
      toast.error(`PDF generation failed: ${errorMessage}`);
    } finally {
      setGeneratingPDF(false);
    }
  }, [projectId, user, pages, pdfGenerationProceedAnyway, isSaving, debouncedSave, setGeneratingPDF, setShowWatermarkNoticeAlert, setCurrentPdfUrl, setShowPdfLink, setPdfGenerationProceedAnyway, router]); // Added router to dependencies

  // useEffect to trigger PDF generation when pdfGenerationProceedAnyway is true
  useEffect(() => {
    if (pdfGenerationProceedAnyway && !showWatermarkNoticeAlert && user && projectId) {
      handleGeneratePDF();
      // Reset the flag immediately to prevent re-triggering on other dependency changes
      // This was previously inside handleGeneratePDF, but it's better here for this effect's logic
      // setPdfGenerationProceedAnyway(false); // This will be set inside handleGeneratePDF now.
    }
  }, [pdfGenerationProceedAnyway, showWatermarkNoticeAlert, user, projectId, handleGeneratePDF, setPdfGenerationProceedAnyway]);

  // Function to close the PDF download link panel
  const closePdfLink = () => {
    setShowPdfLink(false);
  };

  // --- Effect to determine print button disabled reason ---
  useEffect(() => {
    if (generatingPDF) {
      setPrintButtonDisabledReason("Generating PDF, please wait...");
    } else if (isSaving) {
      setPrintButtonDisabledReason("Saving project, please wait...");
    } else if (pages.length === 0) {
      setPrintButtonDisabledReason("Please add pages to your project to enable PDF download.");
    } else if (pages.some(p => !p.originalImage)) {
      setPrintButtonDisabledReason("Please upload an image for each page to enable PDF download.");
    } else if (pages.some(p => p.isProcessing)) {
      setPrintButtonDisabledReason("Some pages are still processing. Please wait to download PDF.");
    } else if (pages.some(p => p.isPreparingToRegenerate)) {
      setPrintButtonDisabledReason("Some pages are being prepared. Please wait to download PDF.");
    } else if (pages.some(p => !p.selectedVersionId)) {
      setPrintButtonDisabledReason("Please convert your images to coloring pages to enable PDF download.");
    } else {
      setPrintButtonDisabledReason(null);
    }
  }, [generatingPDF, isSaving, pages]);

  // --- Render Logic ---
  if (!projectId) {
    // Show loading or placeholder while projectId is being initialized
    return <LoadingState message="Initializing Editor..." />
  }
  if (isLoadingProject && searchParams.get("id")) {
    // Only show full loading state if we expect to load an existing project
    return <LoadingState message="Loading project..." />
  }
  if (!firebaseInitialized) {
    return <LoadingState message="Initializing..." />
  }
  if (!user) {
    return <AuthRedirect /> // Component to redirect to login
  }

  const totalPages = pages.length

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 md:px-6">
          {/* Top row with all interactive elements */}
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {!isLoadingCredits && (
                <div 
                  className="flex items-center gap-1 mr-2 bg-blue-50 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => router.push('/credits')}
                >
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span>{formatCreditBalance(credits)}</span>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                Exit
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-6 md:py-8 px-4 pb-24">
        <div className="container mx-auto max-w-7xl">
          {/* PDF Download Link Panel */}
          {showPdfLink && currentPdfUrl && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>{generatingPDF ? "Generating PDF..." : "Your PDF is ready!"}</AlertTitle>
              <AlertDescription className="flex flex-col space-y-2">
                {generatingPDF ? (
                  <p>Please wait while we prepare your coloring pages...</p>
                ) : (
                  <p>Your coloring pages have been successfully generated.</p>
                )}
                <div className="mt-1 flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => window.open(currentPdfUrl, '_blank')}
                    disabled={generatingPDF}
                  >
                    {generatingPDF ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download PDF
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={closePdfLink}
                    disabled={generatingPDF}
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Watermark Notice Alert - NEW */}
          {showWatermarkNoticeAlert && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Generate PDF Preview</AlertTitle>
              <AlertDescription className="flex flex-col space-y-2">
                <p>You are using the free version. Your PDF will include watermarked images. Purchase any credit package (starting at $3.50 for 5 credits) to generate PDFs with high-quality, unwatermarked images.</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPdfGenerationProceedAnyway(true);
                      setShowWatermarkNoticeAlert(false);
                      // handleGeneratePDF(); // Removed direct call
                    }}
                  >
                    Generate Watermarked PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowWatermarkNoticeAlert(false);
                      router.push('/credits');
                    }}
                  >
                     <ShoppingCart className="mr-2 h-4 w-4" />
                    Purchase Credits
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowWatermarkNoticeAlert(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Credit UI */}
          {showCreditUI && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Out of credits</AlertTitle>
              <AlertDescription className="flex flex-col space-y-2">
                <p>You need credits to generate coloring pages from your photos.</p>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" onClick={() => router.push("/credits")}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Purchase Credits
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowCreditUI(false)}
                  >
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Project Title Input */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow">
            {isEditingTitle ? (
              <div className="flex flex-col space-y-3">
                <Label htmlFor="bookTitle" className="text-xl font-semibold block">Project Title</Label>
                <div className="flex gap-2">
                  <Input
                    id="bookTitle"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Enter a title for your coloring pages"
                    className="text-lg flex-1"
                    autoFocus
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditingTitle(false)}
                  >
                    <Check className="h-4 w-4 mr-1" /> Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">
                  {bookTitle || "Untitled Coloring Book"}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>

          {/* Notice Banners - NEW SECTION */}
          <div className="space-y-3 mb-8">
            {/* Trimming Notice */}
            {showNotices.trimming && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Crop className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Tip:</span> For best results, trim and crop your images before uploading.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => dismissNotice('trimming')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Portrait Orientation Notice */}
            {showNotices.portrait && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Image className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Recommendation:</span> Portrait-oriented photos (taller than wide) typically make better coloring pages.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => dismissNotice('portrait')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Page Management Area */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Coloring Pages</h2>
              <Button 
                onClick={addPage} 
                disabled={totalPages >= MAX_PAGES} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Page
              </Button>
            </div>
            {pages.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">Your project is empty. Click "Add Page" to start!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pages.map((page, index) => (
                    <PageCard
                      key={page.id}
                      page={page}
                      index={index}
                      onMovePage={movePage}
                      onRemovePage={() => removePage(page.id)}
                      onImageUpload={(file) => handleImageUpload(page.id, file)}
                      onConvertImage={(artStyle) => handleConvertImage(page.id, artStyle)}
                      onSelectVersion={(versionId) => selectVersion(page.id, versionId)}
                      onPrepareToRegenerate={() => prepareForRegeneration(page.id)}
                      onCancelRegeneration={() => cancelRegeneration(page.id)}
                      debouncedSave={debouncedSave}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Saving Indicator (Moved out of footer) */}
      <div className="py-3 text-center">
        <div className="text-xs text-gray-500 inline-flex items-center gap-1">
          {isSaving ? (
            <> <Loader2 className="h-4 w-4 animate-spin" /> Saving... </>
          ) : lastSaved ? (
            <> <Check className="h-4 w-4 text-green-500" /> Last saved: {lastSaved.toLocaleTimeString()} </>
          ) : (
            "Unsaved changes"
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="sticky bottom-0 z-50 bg-white border-t shadow-md py-3">
        <div className="container mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex justify-between items-center">
            {/* Left side: Add Page Button */}
            <Button
              onClick={addPage}
              disabled={totalPages >= MAX_PAGES}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Page
            </Button>

            {/* Right side: Download Button (Formerly Print) */}
            <Button
              size="sm"
              variant="outline"
              className="whitespace-nowrap"
              disabled={printButtonDisabledReason !== null}
              onClick={handleGeneratePDF}
            >
              {generatingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download
                </>
              )}
            </Button>
          </div>
          {/* ADDED Print button disabled reason message to footer */}
          {printButtonDisabledReason && (
            <div className="flex justify-end pt-1">
              <p className="text-xs text-gray-500">
                {printButtonDisabledReason}
              </p>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}

// --- Helper Components ---

// Loading State Component
const LoadingState = ({ message }: { message: string }) => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  </div>
)

// Auth Redirect Placeholder
const AuthRedirect = () => {
  const router = useRouter()
  useEffect(() => {
    toast.error("Please log in to create a project.")
    // Use replace to avoid adding the create page to history when not logged in
    router.replace(`/login?redirect=${encodeURIComponent('/create')}`);
  }, [router])
  return <LoadingState message="Redirecting to login..." />
}

// Style Option Component
const StyleOption = ({ id, label, description, imageUrl }: { id: string; label: string; description: string; imageUrl: string }) => (
  <div className="relative">
    <RadioGroupItem value={id} id={id} className="peer sr-only" />
    <Label
      htmlFor={id}
      className="flex flex-col rounded-lg border-2 bg-white p-6 hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 h-full cursor-pointer transition-colors"
    >
      <div className="flex justify-center mb-4 h-40 items-center">
        <PathImg // Use PathImg for potential base path handling
          src={imageUrl}
          alt={`${label} example`}
          width={150}
          height={150}
          className="h-auto max-h-40 object-contain"
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} // Fallback
        />
      </div>
      <div className="mb-4 text-center flex-grow">
        <h3 className="text-lg font-bold">{label}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity">
        <Check className="h-4 w-4" />
      </div>
    </Label>
  </div>
)

// Page Card Component
interface PageCardProps {
  page: Page;
  index: number;
  onMovePage: (dragIndex: number, hoverIndex: number) => void;
  onRemovePage: () => void;
  onImageUpload: (file: File) => void;
  onConvertImage: (artStyle: string) => void;
  onSelectVersion: (versionId: string) => void;
  onPrepareToRegenerate: () => void;
  onCancelRegeneration: () => void;
  debouncedSave: any; // Add debounced save
}

function PageCard({ 
  page, 
  index, 
  onMovePage, 
  onRemovePage, 
  onImageUpload, 
  onConvertImage, 
  onSelectVersion, 
  onPrepareToRegenerate, 
  onCancelRegeneration,
  debouncedSave
}: PageCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local state for selecting art style within the card
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>('classic'); 
  // State for showing the style selection overlay
  const [showStyleOverlay, setShowStyleOverlay] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleMovePrev = () => {
    if (index > 0) {
      onMovePage(index, index - 1);
      // Manually flush the debounced save to ensure changes are persisted immediately
      debouncedSave.flush();
    }
  };

  const handleMoveNext = () => {
    onMovePage(index, index + 1);
    // Manually flush the debounced save to ensure changes are persisted immediately
    debouncedSave.flush();
  };

  const selectedVersion = page.versions.find(v => v.versionId === page.selectedVersionId);

  return (
    <div
      ref={ref}
      className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
        <div className="flex items-center">
          <span className="font-medium text-sm">Page {page.pageNumber}</span>
          <div className="ml-2 flex gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 text-gray-400 hover:text-gray-700" 
              onClick={handleMovePrev}
              disabled={index === 0}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 text-gray-400 hover:text-gray-700" 
              onClick={handleMoveNext}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-100 h-7 w-7" onClick={onRemovePage}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Card Body - Conditional Rendering */}
      <div className="aspect-[3/4] relative bg-gray-100 flex flex-col items-center justify-center p-4">
        {!page.originalImage ? (
          // State: No Image Uploaded
          <div className="text-center">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={handleBrowseClick}>
              <Upload className="mr-2 h-4 w-4" /> Upload Photo
            </Button>
            <p className="text-xs text-gray-400 mt-2">PNG, JPG, WEBP</p>
          </div>
        ) : page.isProcessing ? (
          // State: Processing with OpenAI
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Converting image...</p>
          </div>
        ) : page.processingError ? (
          // State: Processing Error
          <div className="text-center text-red-600">
            <X className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Conversion Failed</p>
            <p className="text-xs mt-1">{page.processingError}</p>
            {/* Retry button now opens the overlay */}
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowStyleOverlay(true)}>
              <RotateCcw className="mr-1 h-3 w-3" /> Retry Conversion
            </Button>
          </div>
        ) : page.versions.length === 0 ? (
          // State: Image Uploaded, Not Converted
          <>
            {/* Display Original Uploaded Image */}
            <div className="relative w-full h-full mb-4">
              <PathImg
                src={page.originalImage.previewUrl}
                alt={`Original Upload - Page ${page.pageNumber}`}
                fill
                priority={page.pageNumber === 1}
                className="object-contain rounded-md"
              />
              {!page.originalImage.uploaded && (
                <div className="absolute bottom-1 left-1 right-1 bg-white p-1 text-xs text-center rounded shadow-sm">Uploading...</div>
              )}
            </div>
            
            {/* Convert Button - Normal flow, centered */}
            <div className="mt-4 text-center">
              <Button 
                onClick={() => setShowStyleOverlay(true)} 
                disabled={!page.originalImage?.uploaded || page.isProcessing}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6"
              >
                <Wand2 className="mr-2 h-4 w-4" /> Convert to Coloring Page
              </Button>
            </div>
          </>
        ) : (
          // State: Versions Exist
          <>
            {/* Display Selected Version */}
            {selectedVersion?.watermarkedPreviewUrl ? (
              <PathImg
                src={selectedVersion.watermarkedPreviewUrl}
                alt={`Coloring Page Version - Page ${page.pageNumber}`}
                fill
                priority={page.pageNumber === 1}
                className="object-contain"
              />
            ) : (
              <div className="text-center text-gray-500">Preview loading...</div>
            )}
            
            {/* Version Selector & Regenerate Button */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center bg-white bg-opacity-90 p-2 rounded shadow">
              {/* Version buttons */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium mr-1">Version:</span>
                {page.versions.map((v, i) => (
                  <Button
                    key={v.versionId}
                    variant={v.versionId === page.selectedVersionId ? "default" : "outline"}
                    className={`h-6 w-6 p-0 rounded-full text-xs ${v.versionId === page.selectedVersionId ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-300'}`}
                    onClick={() => onSelectVersion(v.versionId)}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
              {/* Regenerate Button - Now just opens overlay */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStyleOverlay(true)} 
                disabled={!page.originalImage.uploaded || page.isProcessing}
                className="text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Regenerate
              </Button>
            </div>
          </>
        )}
        
        {/* --- Style Selection Overlay --- */}
        {showStyleOverlay && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 z-10">
            <h3 className="text-lg font-semibold text-white mb-4">Choose Conversion Style</h3>
            <RadioGroup 
              value={selectedArtStyle} 
              onValueChange={setSelectedArtStyle} 
              className="grid grid-cols-2 gap-4 w-full max-w-xs mb-3"
            >
              {/* Classic Style Option */}
              <Label htmlFor={`overlay-classic-${page.id}`} className="flex flex-col items-center justify-start rounded-lg border-2 border-gray-400 bg-white p-3 cursor-pointer hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-orange-500 peer-data-[state=checked]:ring-offset-1 transition-all relative">
                <RadioGroupItem value="classic" id={`overlay-classic-${page.id}`} className="peer sr-only" />
                <PathImg src="/images/Classic.webp" alt="Classic Style" width={80} height={80} className="rounded-md mb-2"/> {/* Larger size */}
                <span className="text-sm font-medium">Classic</span>
                <Check className="absolute top-2 right-2 h-5 w-5 text-orange-600 opacity-0 peer-data-[state=checked]:opacity-100" />
              </Label>
              
              {/* Ghibli Style Option */}
              <Label htmlFor={`overlay-ghibli-${page.id}`} className="flex flex-col items-center justify-start rounded-lg border-2 border-gray-400 bg-white p-3 cursor-pointer hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-orange-500 peer-data-[state=checked]:ring-offset-1 transition-all relative">
                <RadioGroupItem value="ghibli" id={`overlay-ghibli-${page.id}`} className="peer sr-only" />
                <PathImg src="/images/Ghibli-Inspired.webp" alt="Ghibli Style" width={80} height={80} className="rounded-md mb-2"/> {/* Larger size */}
                <span className="text-sm font-medium">Ghibli</span>
                <Check className="absolute top-2 right-2 h-5 w-5 text-orange-600 opacity-0 peer-data-[state=checked]:opacity-100" />
              </Label>
            </RadioGroup>
            
            {/* Add note about previous versions */}
            <p className="text-xs text-gray-300 mb-4 text-center max-w-xs">
              Previous versions will be saved and included as alternatives in your PDF.
            </p>
            
            {/* Overlay Actions */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setShowStyleOverlay(false)} className="bg-white/80 hover:bg-white">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  onConvertImage(selectedArtStyle);
                  setShowStyleOverlay(false);
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Wand2 className="mr-2 h-4 w-4" /> Confirm & Convert
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

