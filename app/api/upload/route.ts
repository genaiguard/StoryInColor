import { NextRequest, NextResponse } from 'next/server';
import { getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if it hasn't been initialized
const initializeFirebaseAdmin = () => {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString()
    );
    
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  }
};

export async function POST(request: NextRequest) {
  try {
    // Get the file and metadata from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const contentType = formData.get('contentType') as string || file.type;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!path) {
      return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }
    
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Try using Firebase Admin SDK first (server-side)
    try {
      initializeFirebaseAdmin();
      const adminStorage = getAdminStorage();
      const bucket = adminStorage.bucket();
      
      // Upload the file to Firebase Storage
      const uploadResponse = await bucket.file(path).save(buffer, {
        metadata: {
          contentType: contentType,
          metadata: {
            uploadedVia: 'next-api',
            timestamp: Date.now().toString()
          }
        }
      });
      
      // Get the download URL
      const [url] = await bucket.file(path).getSignedUrl({
        action: 'read',
        expires: '03-01-2500' // Far future expiration
      });
      
      return NextResponse.json({ 
        success: true, 
        url, 
        path 
      });
    } catch (adminError) {
      console.error('Admin upload failed, falling back to client SDK:', adminError);
      
      // Fall back to using client SDK
      const app = getApp();
      const storage = getStorage(app);
      const storageRef = ref(storage, path);
      
      // Upload the file
      await uploadBytesResumable(storageRef, buffer, {
        contentType: contentType
      });
      
      // Get the download URL
      const url = await getDownloadURL(storageRef);
      
      return NextResponse.json({ 
        success: true, 
        url, 
        path 
      });
    }
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' }, 
      { status: 500 }
    );
  }
} 