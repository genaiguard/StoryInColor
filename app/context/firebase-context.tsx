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
  type User,
} from "firebase/auth"

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Types
type FirebaseContextType = {
  app: FirebaseApp | null
  user: User | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  googleSignIn: () => Promise<void>
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

  // Only initialize Firebase once
  useEffect(() => {
    if (initialized) return;

    try {
      // Validate Firebase config before initializing
      const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = firebaseConfig;
      if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
        console.warn("Authentication features unavailable");
        return;
      }

      // Initialize Firebase if it hasn't been already
      const app = initializeApp(firebaseConfig);
      
      setApp(app);
      
      // Initialize Firebase services
      const auth = getAuth(app);
      
      // Add auth state listener
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
      
      setInitialized(true);
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Initialization error");
      setLoading(false);
    }
  }, [initialized]);

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
    await signInWithPopup(auth, provider)
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

