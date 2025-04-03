import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { v4 as uuidv4 } from "uuid"
import { getApp } from "firebase/app"

// Helper function to get Firebase Storage with proper configuration
export const getConfiguredStorage = () => {
  const app = getApp();
  // By default, when accessing Firebase Storage from GitHub Pages,
  // CORS is already handled by Firebase if your domain is authorized
  return getStorage(app);
}

// Enhanced download URL function with retry capability for CORS issues
export const getDownloadURLWithRetry = async (imagePath: string, maxRetries = 3): Promise<string> => {
  if (!imagePath) {
    throw new Error('No image path provided');
  }
  
  const storage = getConfiguredStorage();
  const imageRef = ref(storage, imagePath);
  
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // If not the first attempt, add a small delay to allow for network issues to resolve
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
      
      const url = await getDownloadURL(imageRef);
      console.log(`Successfully got download URL on attempt ${attempt + 1}`);
      return url;
    } catch (error: any) {
      lastError = error;
      console.warn(`Failed to get download URL on attempt ${attempt + 1}: ${error.message}`);
      
      // If the error is not CORS or permission-related, don't retry
      if (error.code === 'storage/object-not-found') {
        break;
      }
    }
  }
  
  console.error(`Failed to get download URL after ${maxRetries} attempts:`, lastError);
  throw lastError || new Error('Failed to get download URL');
}

// Upload a file to Firebase Storage
export const uploadFile = async (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; storagePath: string }> => {
  return new Promise((resolve, reject) => {
    try {
      const storage = getConfiguredStorage()
      
      // Generate a unique filename
      const extension = file.name.split(".").pop()
      const filename = `${uuidv4()}.${extension}`
      const fullPath = `${path}/${filename}`
      
      // Create storage reference
      const storageRef = ref(storage, fullPath)
      
      // Start upload
      const uploadTask = uploadBytesResumable(storageRef, file)
      
      // Listen for state changes, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate and report progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          if (onProgress) {
            onProgress(progress)
          }
        },
        (error) => {
          // Handle errors
          console.error("Upload error:", error)
          reject(error)
        },
        async () => {
          // Upload completed successfully
          // Get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          
          resolve({
            url: downloadURL,
            storagePath: fullPath,
          })
        }
      )
    } catch (error) {
      console.error("Upload preparation error:", error)
      reject(error)
    }
  })
}

// Delete a file from Firebase Storage
export const deleteFile = async (storagePath: string): Promise<void> => {
  try {
    const storage = getConfiguredStorage()
    const fileRef = ref(storage, storagePath)
    
    await deleteObject(fileRef)
  } catch (error) {
    console.error("Delete file error:", error)
    throw error
  }
}

// Generate a thumbnail from an image file
export const generateThumbnail = async (
  file: File,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.7
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width))
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height))
            height = maxHeight
          }
        }
        
        // Create a canvas and draw the resized image
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }
        
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create thumbnail blob"))
              return
            }
            resolve(blob)
          },
          "image/jpeg",
          quality
        )
      }
      
      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }
      
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }
    
    reader.readAsDataURL(file)
  })
}

// Upload a thumbnail for a project
export const uploadThumbnail = async (
  userId: string,
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; storagePath: string }> => {
  try {
    // First generate the thumbnail
    const thumbnailBlob = await generateThumbnail(file)
    
    // Convert Blob to File for upload
    const thumbnailFile = new File([thumbnailBlob], `thumbnail-${file.name}`, {
      type: "image/jpeg",
    })
    
    // Upload to the thumbnails folder
    return await uploadFile(
      thumbnailFile,
      `users/${userId}/projects/${projectId}/thumbnails`,
      onProgress
    )
  } catch (error) {
    console.error("Thumbnail upload error:", error)
    throw error
  }
} 