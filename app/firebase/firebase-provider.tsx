"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  connectAuthEmulator,
  type User,
  type UserCredential,
} from "firebase/auth"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getStorage, connectStorageEmulator } from "firebase/storage"

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

// Types
type FirebaseContextType = {
  app: FirebaseApp | null
  user: User | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  googleSignIn: () => Promise<UserCredential>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

// Create context
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined)

// Provider component
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Initialize Firebase
  useEffect(() => {
    try {
      // Check if all required config values are present
      if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
        console.warn("Firebase config is incomplete. Authentication features will not work.")
        setLoading(false)
        return
      }

      // Check if Firebase app has already been initialized
      const apps = getApps()
      let firebaseApp

      if (apps.length === 0) {
        firebaseApp = initializeApp(firebaseConfig)
      } else {
        firebaseApp = apps[0]
      }

      setApp(firebaseApp)
      
      // Initialize Firebase services
      const auth = getAuth(firebaseApp);
      const db = getFirestore(firebaseApp);
      const storage = getStorage(firebaseApp);
      
      // Connect to emulators in development environment
      if (isDevelopment) {
        try {
          // Auth needs special handling for different local development URLs
          if (window.location.hostname === 'localhost') {
            // Connect to Auth emulator for localhost
            connectAuthEmulator(auth, 'http://localhost:9099');
            
            // Connect to Firestore emulator
            connectFirestoreEmulator(db, 'localhost', 8080);
            
            // Connect to Storage emulator
            connectStorageEmulator(storage, 'localhost', 9199);
            
            // Don't log specific emulator information
          } else {
            // For local IP address development (like 192.168.x.x)
            // No emulator connection needed, but we need to handle CORS in a different way
            // You'll need to add your local IP to Firebase Auth authorized domains
          }
        } catch (emulatorError) {
          console.warn("Connection error");
        }
      }
      
      setInitialized(true)

      // Initialize Analytics if running in browser and measurement ID is available
      if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
        isSupported().then(supported => {
          if (supported) {
            getAnalytics(firebaseApp)
            // Don't log Analytics initialization
          }
        })
      }

      // Set up auth state listener
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser)
        setLoading(false)
      })

      return () => unsubscribe()
    } catch (error) {
      console.error("Initialization error");
      setLoading(false)
      setInitialized(false)
    }
  }, [])

  // Auth functions
  const signIn = async (email: string, password: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const auth = getAuth()
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const auth = getAuth()
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const googleSignIn = async () => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const auth = getAuth()
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    return result // Return the auth result
  }

  const resetPassword = async (email: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const auth = getAuth()
    await sendPasswordResetEmail(auth, email)
  }

  const logout = async () => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const auth = getAuth()
    await signOut(auth)
  }

  const value = {
    app,
    user,
    loading,
    initialized,
    signIn,
    signUp,
    googleSignIn,
    resetPassword,
    logout,
  }

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>
}

// Custom hook to use the Firebase context
export function useFirebase() {
  const context = useContext(FirebaseContext)
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider")
  }
  return context
}

