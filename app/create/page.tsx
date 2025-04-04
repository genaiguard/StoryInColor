"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Upload, ImagePlus, Check, Trash2, X } from "lucide-react"
import { UploadProvider, useUpload } from "@/app/context/upload-context"
import { v4 as uuidv4 } from "uuid"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"
import { getFunctions, httpsCallable } from "firebase/functions"
import { toast } from "sonner"
import { PathImg } from "@/components/ui/pathed-image"

// Insert the ProjectData interface
interface ProjectData {
  [key: string]: any;
  title: string;
  productType: string;
  status: string;
  updatedAt: any;
  createdAt?: any;
  pages?: any[];
  thumbnailPath?: string;
  artStyle: string;
}

const steps = [
  { id: "options", label: "Product Options" },
  { id: "style", label: "Art Style" },
  { id: "upload", label: "Upload Photos" },
  { id: "arrange", label: "Arrange Pages" },
]

export default function CreatePage() {
  return (
    <UploadProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <CreatePageContent />
      </Suspense>
    </UploadProvider>
  )
}

function CreatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("id")
  const [currentStep, setCurrentStep] = useState("options")
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const fileInputRef = useRef(null)
  const [bookTitle, setBookTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  
  const { user, initialized } = useFirebase()
  const { pages, setPages, productType, setProductType, artStyle, setArtStyle, loadState, convertFileToPreview, debugState } = useUpload()

  // Clear pages when creating a new book (no projectId)
  useEffect(() => {
    if (!projectId) {
      // Clear any existing pages when starting a fresh project
      setPages([])
      setUploadedFiles([])
      // Also clear sessionStorage to prevent loading old data
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("uploadPages")
        sessionStorage.removeItem("minimalPages")
      }
      console.log("Cleared previous pages")
    }
  }, [projectId, setPages])

  // Memoize this function to prevent unnecessary renders
  const goToNextStep = useCallback(() => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id)
      window.scrollTo(0, 0)
    }
  }, [currentStep])

  const goToPreviousStep = useCallback(() => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id)
      window.scrollTo(0, 0)
    }
  }, [currentStep])

  // Load existing project if ID is provided
  useEffect(() => {
    if (!projectId || !user || !initialized) return

    const loadProject = async () => {
      setIsLoading(true)
      setError("")
      
      try {
        const db = getFirestore()
        
        // Load project info
        
        // ... rest of the code
      } catch (error) {
        // Error handling
      }
    }
    
    loadProject()
  }, [projectId, user, initialized, setPages, setProductType])

  // New project creation (no projectId)
  useEffect(() => {
    if (projectId || !user || !initialized) return
    
    // Reset upload state for new project
    setPages([])
    setProductType("standard")
    setIsLoading(false)
  }, [user, initialized, projectId, setPages, setProductType])

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to save a project")
      return
    }
    
    try {
      setSubmitting(true)
      
      // Initialize Firebase services
      const db = getFirestore()
      const storage = getConfiguredStorage()
      
      // Create a new project ID if we don't have one
      const actualProjectId = projectId || uuidv4()
      
      // Reference to the project document
      const projectRef = doc(db, "users", user.uid, "projects", actualProjectId)
      
      // Start with basic project data
      const projectData: ProjectData = {
        title: bookTitle,
        productType,
        artStyle,
        status: "preview",
        updatedAt: serverTimestamp(),
      }
      
      // If this is a new project, add createdAt timestamp
      if (!projectId) {
        projectData.createdAt = serverTimestamp()
      }
      
      // Array to store page data with storage references
      const pagesData = []
      
      // Only use the maximum allowed pages for this product type
      const filteredPages = getFilteredPages();
      
      // Upload each page's photo to Storage
      for (const page of filteredPages) {
        if (page.photo) {
          try {
            // Get the image data from the preview
            const response = await fetch(page.photo.preview)
            const blob = await response.blob()
            
            // Create a storage reference
            const photoPath = `users/${user.uid}/projects/${actualProjectId}/photos/${page.photo.id}.jpg`
            const storageRef = ref(storage, photoPath)
            
            // Set content type explicitly
            const metadata = {
              contentType: 'image/jpeg',
            };
            
            // Upload the file with metadata
            await uploadBytes(storageRef, blob, metadata)
            
            // Get the download URL
            const downloadURL = await getDownloadURL(storageRef)
            
            // Add to pages data with storage references
            pagesData.push({
              id: page.id,
              pageNumber: page.pageNumber,
              photoId: page.photo.id,
              photoPath,
              photoUrl: downloadURL,
              photoName: page.photo.name,
            })
          } catch (uploadError) {
            console.error("Error uploading image:", uploadError)
            // Still add the page, but without the photo URL
            pagesData.push({
              id: page.id,
              pageNumber: page.pageNumber,
              photoId: page.photo.id,
              photoName: page.photo.name,
              uploadError: true,
            })
          }
        } else {
          // Handle blank pages
          pagesData.push({
            id: page.id,
            pageNumber: page.pageNumber,
            isBlank: true,
          })
        }
      }
      
      // Update project data with pages info
      projectData.pages = pagesData
      
      // Use the first image as thumbnail if available
      if (pagesData.length > 0 && pagesData[0].photoPath) {
        projectData.thumbnailPath = pagesData[0].photoPath
      }
      
      // Save project data to Firestore
      if (projectId) {
        // Update existing project
        await updateDoc(projectRef, projectData)
      } else {
        // Create new project
        await setDoc(projectRef, projectData)
      }
      
      toast.success("Project submitted for preview!")
      
      // Send project submission email notification
      try {
        const functions = getFunctions();
        const sendProjectSubmissionNotification = httpsCallable(
          functions, 
          'sendProjectSubmissionNotification'
        );
        
        await sendProjectSubmissionNotification({
          projectId: actualProjectId,
          title: bookTitle,
          productType,
          artStyle,
          pages: filteredPages
        });
      } catch (emailError) {
        // Don't fail the overall submission if email fails
      }
      
      // Redirect to dashboard
      router.push("/dashboard")
    } catch (error) {
      setError("Failed to save project. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Upload Photos functionality
  const handleFileChange = async (e) => {
    const files = e.target.files
    if (files.length > 0) {
      await processFiles(files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await processFiles(files)
    }
  }

  const processFiles = async (files) => {
    const newFiles = [...uploadedFiles]
    const newPages = [...pages]

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Only process image files
      if (!file.type.startsWith("image/")) {
        continue
      }

      try {
        // Convert file to preview
        const preview = await convertFileToPreview(file)

        // Create a photo object
        const photo = {
          id: uuidv4(),
          name: file.name,
          preview: preview,
        }

        // Add to uploaded files
        newFiles.push(photo)

        // Create a page for this photo
        const page = {
          id: uuidv4(),
          pageNumber: newPages.length + 1,
          photo: photo,
        }

        // Add to pages
        newPages.push(page)
      } catch (error) {
        // Error processing file
      }
    }

    setUploadedFiles(newFiles)
    setPages(newPages)
  }

  const removeFile = (index) => {
    const newFiles = [...uploadedFiles]
    const removedFile = newFiles.splice(index, 1)[0]
    setUploadedFiles(newFiles)

    // Also remove from pages
    const newPages = pages.filter((page) => page.photo?.id !== removedFile.id)

    // Update page numbers
    const updatedPages = newPages.map((page, index) => ({
      ...page,
      pageNumber: index + 1,
    }))

    setPages(updatedPages)
  }

  const handleBrowseClick = () => {
    fileInputRef.current.click()
  }

  // Arrange Pages functionality
  const addBlankPage = () => {
    const newPage = {
      id: uuidv4(),
      pageNumber: pages.length + 1,
      photo: null,
    }

    setPages([...pages, newPage])
  }

  const removePage = (pageId) => {
    const newPages = pages.filter((page) => page.id !== pageId)

    // Update page numbers
    const updatedPages = newPages.map((page, index) => ({
      ...page,
      pageNumber: index + 1,
    }))

    setPages(updatedPages)
  }

  const movePage = (pageId, direction) => {
    const pageIndex = pages.findIndex((page) => page.id === pageId)
    if (pageIndex === -1) return

    const newPages = [...pages]

    if (direction === "left" && pageIndex > 0) {
      // Swap with the previous page
      ;[newPages[pageIndex], newPages[pageIndex - 1]] = [newPages[pageIndex - 1], newPages[pageIndex]]
    } else if (direction === "right" && pageIndex < newPages.length - 1) {
      // Swap with the next page
      ;[newPages[pageIndex], newPages[pageIndex + 1]] = [newPages[pageIndex + 1], newPages[pageIndex]]
    }

    // Update page numbers
    const updatedPages = newPages.map((page, index) => ({
      ...page,
      pageNumber: index + 1,
    }))

    setPages(updatedPages)
  }

  // Product Options functionality
  const productOptions = [
    {
      id: "standard",
      title: "Standard",
      description: "10-page coloring booklet with softcover binding",
      image: "/images/product-standard.png",
      maxPages: 10,
    },
    {
      id: "premium",
      title: "Premium",
      description: "30-page coloring book with hardcover binding",
      image: "/images/product-premium.png",
      maxPages: 30,
    },
    {
      id: "pdf",
      title: "Digital",
      description: "Digital coloring book to print at home",
      image: "/images/product-pdf.png",
      maxPages: 10,
    },
  ]

  // Get maximum photo count based on product type
  const getMaxPhotoCount = () => {
    const selectedProduct = productOptions.find((option) => option.id === productType)
    return selectedProduct ? selectedProduct.maxPages : 10
  }

  // Get required photo count based on product type
  const getRequiredPhotoCount = () => {
    switch (productType) {
      case "standard":
        return 10
      case "premium":
        return 30
      case "pdf":
        return 10
      default:
        return 10
    }
  }

  // Add this function before the render return statement
  // This will filter pages to only show the maximum allowed for the product type

  const getFilteredPages = () => {
    const maxPages = getMaxPhotoCount();
    // Only show the first maxPages pages
    return pages.slice(0, maxPages);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your project...</p>
        </div>
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
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push("/dashboard")}
            >
              Exit
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              {projectId ? "Edit Your Coloring Book" : "Create Your Coloring Book"}
            </h1>

            {/* Step indicator */}
            <div className="hidden md:block mb-8">
              <div className="flex items-center">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        currentStep === step.id
                          ? "bg-orange-500 text-white"
                          : index < steps.findIndex((s) => s.id === currentStep)
                            ? "bg-green-500 text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {index < steps.findIndex((s) => s.id === currentStep) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div
                      className={`ml-2 text-sm font-medium ${
                        currentStep === step.id ? "text-orange-500" : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="mx-4 h-0.5 w-8 bg-gray-200">
                        {index < steps.findIndex((s) => s.id === currentStep) && (
                          <div className="h-full bg-green-500" style={{ width: "100%" }}></div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile step indicator */}
            <div className="md:hidden mb-6">
              <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full ${
                      currentStep === steps[0].id ? "bg-orange-500 text-white" : "bg-green-500 text-white"
                    }`}
                  >
                    {currentStep === steps[0].id ? "1" : <Check className="h-3 w-3" />}
                  </div>
                  <div className="ml-2 text-xs font-medium">
                    Step {steps.findIndex((step) => step.id === currentStep) + 1} of {steps.length}
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-500">
                  {steps.find((step) => step.id === currentStep)?.label}
                </div>
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="mb-8">
            {currentStep === "options" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">Choose Your Product</h2>
                  <p className="text-gray-500">
                    First, select the type of coloring book you want to create and give it a title.
                  </p>
                </div>

                <div className="mb-6">
                  <Label htmlFor="book-title" className="text-base font-medium mb-2 block">
                    Book Title
                  </Label>
                  <input
                    id="book-title"
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Enter a title for your coloring book"
                    className="w-full rounded-md border border-gray-300 p-3 text-base focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    required
                  />
                </div>

                <div className="mb-8">
                  <RadioGroup value={productType} onValueChange={setProductType} className="grid gap-6 md:grid-cols-3">
                    {productOptions.map((option) => (
                      <div key={option.id} className="relative">
                        <RadioGroupItem value={option.id} id={option.id} className="peer sr-only" />
                        <Label
                          htmlFor={option.id}
                          className="flex flex-col rounded-lg border-2 bg-white p-6 hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50"
                        >
                          <div className="flex justify-center mb-4">
                            <PathImg
                              src={option.image || "/placeholder.svg"}
                              alt={option.title}
                              width={120}
                              height={120}
                              className="h-auto"
                            />
                          </div>
                          <div className="mb-4 text-center">
                            <h3 className="text-lg font-bold">{option.title}</h3>
                            <p className="text-sm text-gray-500">{option.description}</p>
                          </div>
                          <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white opacity-0 peer-data-[state=checked]:opacity-100">
                            <Check className="h-4 w-4" />
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 text-base font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                    onClick={goToNextStep}
                    disabled={!bookTitle.trim()}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {currentStep === "style" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">Choose Your Art Style for "{bookTitle}"</h2>
                  <p className="text-gray-500">
                    Select the artistic style you want for your coloring pages.
                  </p>
                </div>

                <div className="mb-8">
                  <RadioGroup value={artStyle} onValueChange={setArtStyle} className="grid gap-6 md:grid-cols-2">
                    <div className="relative">
                      <RadioGroupItem value="classic" id="classic" className="peer sr-only" />
                      <Label
                        htmlFor="classic"
                        className="flex flex-col rounded-lg border-2 bg-white p-6 hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 h-full"
                      >
                        <div className="flex justify-center mb-4 h-40 items-center">
                          <PathImg
                            src="/images/Classic.png"
                            alt="Classic coloring page example"
                            width={150}
                            height={150}
                            className="h-auto max-h-40 object-contain"
                          />
                        </div>
                        <div className="mb-4 text-center flex-grow">
                          <h3 className="text-lg font-bold">Classic Coloring Page</h3>
                          <p className="text-sm text-gray-500">Convert your image into a traditional coloring book illustration with clean, bold outlines and simple details.</p>
                        </div>
                        <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white opacity-0 peer-data-[state=checked]:opacity-100">
                          <Check className="h-4 w-4" />
                        </div>
                      </Label>
                    </div>
                    
                    <div className="relative">
                      <RadioGroupItem value="ghibli" id="ghibli" className="peer sr-only" />
                      <Label
                        htmlFor="ghibli"
                        className="flex flex-col rounded-lg border-2 bg-white p-6 hover:border-orange-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50 h-full"
                      >
                        <div className="flex justify-center mb-4 h-40 items-center">
                          <PathImg
                            src="/images/Ghibli-Inspired.PNG"
                            alt="Ghibli-inspired coloring page example"
                            width={150}
                            height={150}
                            className="h-auto max-h-40 object-contain"
                          />
                        </div>
                        <div className="mb-4 text-center flex-grow">
                          <h3 className="text-lg font-bold">Ghibli-Inspired Coloring Page</h3>
                          <p className="text-sm text-gray-500">Transform your image into a whimsical coloring page featuring gentle lines and charming Studio Ghibli-style details.</p>
                        </div>
                        <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white opacity-0 peer-data-[state=checked]:opacity-100">
                          <Check className="h-4 w-4" />
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" className="px-6" onClick={goToPreviousStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 text-base font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                    onClick={goToNextStep}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {currentStep === "upload" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">Upload Photos for "{bookTitle}"</h2>
                  <p className="text-gray-500">
                    Select the photos you want to include in your coloring book. Your {productType} book requires at
                    least {getRequiredPhotoCount()} photos. We recommend high-quality images with clear subjects.
                  </p>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center mb-8 transition-colors ${
                    isDragging ? "border-orange-500 bg-orange-50" : "border-gray-300 hover:border-orange-500"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleBrowseClick}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />

                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="rounded-full bg-orange-100 p-4 mb-4">
                      <Upload className="h-8 w-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Drag & Drop Your Photos Here</h3>
                    <p className="text-gray-500 mb-4">Or click to browse your files</p>
                    <Button
                      variant="outline"
                      className="border-orange-500 text-orange-500 hover:bg-orange-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBrowseClick()
                      }}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Browse Files
                    </Button>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">
                      Uploaded Photos ({uploadedFiles.length} of {getRequiredPhotoCount()} required, maximum{" "}
                      {getMaxPhotoCount()})
                      {uploadedFiles.length > getMaxPhotoCount() && (
                        <span className="text-red-500 ml-2 text-sm">
                          You've exceeded the maximum number of photos for this product type. Please remove{" "}
                          {uploadedFiles.length - getMaxPhotoCount()} photo(s).
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {uploadedFiles.map((file, index) => (
                        <div key={file.id} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border bg-white">
                            <PathImg
                              src={file.preview || "/placeholder.svg"}
                              alt={file.name}
                              width={200}
                              height={200}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(index)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <p className="text-xs text-gray-500 truncate mt-1">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" className="px-6" onClick={goToPreviousStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 text-base font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                    disabled={
                      uploadedFiles.length < getRequiredPhotoCount() || uploadedFiles.length > getMaxPhotoCount()
                    }
                    onClick={goToNextStep}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {currentStep === "arrange" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">Arrange Pages for "{bookTitle}"</h2>
                  <p className="text-gray-500">
                    Reorder your pages by using the left and right arrows. You can also add blank pages or remove
                    existing ones.
                  </p>
                </div>

                <div className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredPages().map((page, index) => (
                      <div
                        key={page.id}
                        className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="p-2 bg-gray-50 border-b flex justify-between items-center">
                          <span className="font-medium text-sm">Page {page.pageNumber}</span>
                          <div className="flex items-center gap-1">
                            <button
                              className="text-gray-500 hover:text-gray-700 p-1"
                              onClick={() => movePage(page.id, "left")}
                              disabled={index === 0}
                            >
                              <ArrowLeft className={`h-4 w-4 ${index === 0 ? "opacity-30" : ""}`} />
                            </button>
                            <button
                              className="text-gray-500 hover:text-gray-700 p-1"
                              onClick={() => movePage(page.id, "right")}
                              disabled={index === pages.length - 1}
                            >
                              <ArrowRight className={`h-4 w-4 ${index === pages.length - 1 ? "opacity-30" : ""}`} />
                            </button>
                            <button className="text-red-500 hover:text-red-700 p-1" onClick={() => removePage(page.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="aspect-[3/4] relative bg-gray-100">
                          {page.photo ? (
                            <PathImg
                              src={page.photo.preview || "/placeholder.svg"}
                              alt={`Page ${page.pageNumber}`}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-gray-400">Blank Page</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Remove the Add Blank Page button */}
                  {/* <div className="mt-6">
                    <Button
                      variant="outline"
                      className="border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50"
                      onClick={addBlankPage}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Blank Page
                    </Button>
                  </div> */}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" className="px-6" onClick={goToPreviousStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 text-base font-medium rounded-lg shadow-sm transition-all hover:shadow-md"
                    disabled={pages.length === 0 || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      "Submit for Preview"
                    )}
                  </Button>
                </div>
              </div>
            )}
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

