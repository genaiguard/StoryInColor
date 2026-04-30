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

// Compress a processed image to ensure it meets storage requirements
export const compressProcessedImage = async (
  file: File,
  maxSize = 1.5 * 1024 * 1024, // 1.5MB max to stay under the 2MB limit
  initialQuality = 0.8
): Promise<File> => {
  // If file is already small enough, return it as is
  if (file.size <= maxSize) {
    if (process.env.NODE_ENV !== "production") console.log("File already under size limit, no compression needed");
    return file;
  }

  // Function to compress with decreasing quality until under size limit
  const compressWithQuality = async (quality: number): Promise<File> => {
    // Don't go below minimum quality
    if (quality < 0.3) {
      console.warn("Reached minimum quality (30%), returning best effort");
      quality = 0.3;
    }

    try {
      if (process.env.NODE_ENV !== "production") console.log(`Compressing image with quality: ${quality}`);
      
      // Create a maximum width/height to resize large images
      // Keep enough detail for the generated output while avoiding oversized uploads.
      const maxWidth = 1800;
      const maxHeight = 1800;
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const img = new Image();
          
          img.onload = () => {
            // Calculate dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
              }
            }
            
            // Create a canvas and draw the resized image
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob
            canvas.toBlob(
              async (blob) => {
                if (!blob) {
                  reject(new Error("Failed to create compressed image blob"));
                  return;
                }
                
                // Create a new file from the blob
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                
                if (process.env.NODE_ENV !== "production") console.log(`Compressed size: ${compressedFile.size} bytes (${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB)`);
                
                // If still too large, try with lower quality
                if (compressedFile.size > maxSize && quality > 0.3) {
                  const nextQuality = quality - 0.1;
                  if (process.env.NODE_ENV !== "production") console.log(`File still too large, trying lower quality: ${nextQuality}`);
                  resolve(await compressWithQuality(nextQuality));
                } else {
                  resolve(compressedFile);
                }
              },
              "image/jpeg",
              quality
            );
          };
          
          img.onerror = () => {
            reject(new Error("Failed to load image for compression"));
          };
          
          img.src = e.target?.result as string;
        };
        
        reader.onerror = () => {
          reject(new Error("Failed to read file for compression"));
        };
        
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("Error during compression:", error);
      // If compression fails, return original as fallback
      return file;
    }
  };
  
  // Start compression with initial quality
  return compressWithQuality(initialQuality);
};

