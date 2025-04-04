"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from "react"

// Define the types for our context
type PhotoData = {
  id: string
  name: string
  preview: string // Small preview thumbnail only
  uploadId?: string // This would be the Firebase Storage reference in production
}

type PageData = {
  id: string
  pageNumber: number
  photo: PhotoData | null
}

type UploadContextType = {
  pages: PageData[]
  setPages: React.Dispatch<React.SetStateAction<PageData[]>>
  productType: string
  setProductType: (type: string) => void
  artStyle: string
  setArtStyle: (style: string) => void
  uploadProgress: number
  setUploadProgress: (progress: number) => void
  convertFileToPreview: (file: File) => Promise<string>
  persistState: () => void
  loadState: () => void
  debugState: () => void
}

// Create the context
const UploadContext = createContext<UploadContextType | undefined>(undefined)

// Helper function to create a preview thumbnail
const createPreviewThumbnail = async (file: File, maxWidth = 1024, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.floor(height * (maxWidth / width))
          width = maxWidth
        }

        // Create canvas and draw resized image
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to data URL with quality setting
        resolve(canvas.toDataURL("image/jpeg", quality))
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      if (e.target && e.target.result) {
        img.src = e.target.result as string
      } else {
        reject(new Error("Failed to read file data"))
      }
    }

    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }

    reader.readAsDataURL(file)
  })
}

// Provider component
export function UploadProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<PageData[]>([])
  const [productType, setProductType] = useState<string>("standard")
  const [artStyle, setArtStyle] = useState<string>("classic")
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const initializedRef = useRef(false)
  const productTypeRef = useRef(productType)
  const artStyleRef = useRef(artStyle)

  // Update refs when states change
  useEffect(() => {
    productTypeRef.current = productType
  }, [productType])
  
  useEffect(() => {
    artStyleRef.current = artStyle
  }, [artStyle])

  // Use useCallback for functions to prevent unnecessary re-renders

  // Safe setter for product type that prevents unnecessary re-renders
  const setProductTypeSafe = useCallback((type: string) => {
    if (type !== productTypeRef.current) {
      // Minimal logging
      setProductType(type)
    }
  }, [])

  // Safe setter for art style that prevents unnecessary re-renders
  const setArtStyleSafe = useCallback((style: string) => {
    if (style !== artStyleRef.current) {
      setArtStyle(style)
    }
  }, [])

  // Convert a File to a preview thumbnail
  const convertFileToPreview = useCallback(async (file: File): Promise<string> => {
    try {
      // In production, we would upload the full file to Firebase here
      // and get back a reference URL

      // For now, just create a small preview thumbnail
      const previewUrl = await createPreviewThumbnail(file)
      return previewUrl
    } catch (error) {
      console.error("Error creating preview");
      // Fallback to a simple data URL if thumbnail creation fails
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }
  }, [])

  // Persist state to sessionStorage with error handling
  const persistState = useCallback(() => {
    try {
      // Store basic info in sessionStorage
      sessionStorage.setItem("productType", productType);
      sessionStorage.setItem("artStyle", artStyle);
      sessionStorage.setItem("uploadProgress", String(uploadProgress));
      
      // Create a version of pages without the full image previews
      const storablePages = pages.map(page => ({
        id: page.id,
        pageNumber: page.pageNumber,
        photo: page.photo ? {
          id: page.photo.id,
          name: page.photo.name,
          // Don't store the full preview in sessionStorage, just note that it exists
          preview: page.photo.preview ? "has-preview" : "",
          uploadId: page.photo.uploadId,
        } : null
      }));
      
      // Store the minimal structure
      sessionStorage.setItem("uploadPages", JSON.stringify(storablePages));
      // Simple confirmation log without data details
      console.log(`State persisted. Total pages: ${pages.length}`);
    } catch (error) {
      console.error("Error persisting state");
      
      // Create an even more minimal version if we still hit quota limits
      try {
        // Create a very minimal version with just IDs and page numbers
        const minimalPages = pages.map((page) => ({
          id: page.id,
          pageNumber: page.pageNumber,
          hasPhoto: !!page.photo
        }));
        
        // Store the minimal structure
        sessionStorage.setItem("minimalPages", JSON.stringify(minimalPages));
        console.log("Minimal state persisted as fallback");
      } catch (fallbackError) {
        console.error("Even minimal state persistence failed");
      }
    }
  }, [pages, productType, artStyle, uploadProgress]);

  // Load state from storage
  const loadState = useCallback(() => {
    if (!initializedRef.current) {
      try {
        // Load basic info
        const savedProductType = sessionStorage.getItem("productType")
        const savedArtStyle = sessionStorage.getItem("artStyle")
        const savedProgress = sessionStorage.getItem("uploadProgress")
        const savedPagesJson = sessionStorage.getItem("uploadPages")

        if (savedProductType) {
          setProductTypeSafe(savedProductType)
        }
        
        if (savedArtStyle) {
          setArtStyleSafe(savedArtStyle)
        }

        if (savedProgress) {
          setUploadProgress(Number(savedProgress))
        }

        if (savedPagesJson) {
          const parsedPages = JSON.parse(savedPagesJson)
          console.log(`Loading ${parsedPages.length} pages from storage`);
          setPages(parsedPages)
        } else {
          // Try to load minimal state as fallback
          const minimalPagesJson = sessionStorage.getItem("minimalPages")
          if (minimalPagesJson) {
            console.log("Loading minimal state as fallback");
            // In a real app, we would fetch the actual previews from Firebase here
            // based on the uploadId references
            setPages(JSON.parse(minimalPagesJson))
          }
        }
      } catch (error) {
        console.error("Error loading state");
      }
    }
  }, [setProductTypeSafe, setArtStyleSafe, setPages, setUploadProgress])

  // Debug function to log current state
  const debugState = useCallback(() => {
    // Simplified debug output without actual data content
    console.log({
      productType,
      artStyle,
      pagesCount: pages.length,
      uploadProgress,
      isInitialized
    });
  }, [productType, artStyle, pages.length, uploadProgress, isInitialized])

  // Load state on initial render only once
  useEffect(() => {
    const loadInitialState = () => {
      if (typeof window !== "undefined" && !initializedRef.current) {
        loadState()
        initializedRef.current = true
        setIsInitialized(true)
      }
    }
    
    loadInitialState()
    // Don't include loadState in dependencies to prevent loops
  }, [])

  // Save state whenever it changes, but only after initialization
  useEffect(() => {
    if (typeof window !== "undefined" && isInitialized) {
      // Add a debounce for saving state to prevent too frequent updates
      const saveTimeout = setTimeout(() => {
        persistState()
      }, 300);
      
      return () => clearTimeout(saveTimeout);
    }
  }, [pages, productType, artStyle, uploadProgress, isInitialized])  // Remove persistState dependency

  return (
    <UploadContext.Provider
      value={{
        pages,
        setPages,
        productType,
        setProductType: setProductTypeSafe,
        artStyle,
        setArtStyle: setArtStyleSafe,
        uploadProgress,
        setUploadProgress,
        convertFileToPreview,
        persistState,
        loadState,
        debugState,
      }}
    >
      {children}
    </UploadContext.Provider>
  )
}

// Custom hook to use the upload context
export function useUpload() {
  const context = useContext(UploadContext)
  if (context === undefined) {
    throw new Error("useUpload must be used within an UploadProvider")
  }
  return context
}

