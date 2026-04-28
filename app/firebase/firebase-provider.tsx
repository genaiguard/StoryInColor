"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

// Use any types to avoid static imports during build
type FirebaseApp = any
type User = any
type UserCredential = any

// Dynamic imports for Firebase modules
let firebaseModules: any = null

const loadFirebaseModules = async () => {
  if (firebaseModules) return firebaseModules

  // Only load Firebase in browser environment
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be loaded in browser environment')
  }

  const [
    { initializeApp, getApps },
    {
      getAuth,
      onAuthStateChanged,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      GoogleAuthProvider,
      signInWithPopup,
      signOut,
      sendPasswordResetEmail,
      connectAuthEmulator,
    },
    { getAnalytics, isSupported },
    { getFirestore, connectFirestoreEmulator },
    { getStorage, connectStorageEmulator },
  ] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/analytics"),
    import("firebase/firestore"),
    import("firebase/storage"),
  ])

  firebaseModules = {
    initializeApp,
    getApps,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    connectAuthEmulator,
    getAnalytics,
    isSupported,
    getFirestore,
    connectFirestoreEmulator,
    getStorage,
    connectStorageEmulator,
  }

  return firebaseModules
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
    // Only initialize Firebase on the client side
    if (typeof window === 'undefined') {
      setLoading(false)
      setInitialized(false)
      return
    }

    const initializeFirebase = async () => {
      try {
        // Load Firebase modules dynamically
        const modules = await loadFirebaseModules()
      } catch (error) {
        console.warn("Failed to load Firebase modules:", error.message)
        setLoading(false)
        setInitialized(false)
        return
      }

      try {
        // Continue with Firebase initialization
        const modules = firebaseModules

        // Define config object inside useEffect to ensure it uses build-time values
        const effectiveFirebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        };

        // Check if all required config values are present
        if (!effectiveFirebaseConfig.apiKey || !effectiveFirebaseConfig.authDomain || !effectiveFirebaseConfig.projectId) {
          // Log only WHICH keys are missing, never the values. The apiKey is
          // technically public, but dumping the whole config makes auth-domain
          // and storage-bucket trivially discoverable in the browser console.
          const missing = (Object.keys(effectiveFirebaseConfig) as Array<
            keyof typeof effectiveFirebaseConfig
          >).filter((k) => !effectiveFirebaseConfig[k]);
          console.warn(
            "Firebase config is incomplete. Auth disabled. Missing keys:",
            missing,
          );
          setLoading(false);
          setInitialized(false);
          return;
        }

        // Check if Firebase app has already been initialized
        const apps = modules.getApps();
        let firebaseApp;

        if (apps.length === 0) {
          // Initialize using the config derived from build-time env vars
          firebaseApp = modules.initializeApp(effectiveFirebaseConfig);
        } else {
          firebaseApp = apps[0];
        }

        setApp(firebaseApp)

        // Initialize Firebase services
        const auth = modules.getAuth(firebaseApp);
        const db = modules.getFirestore(firebaseApp);
        const storage = modules.getStorage(firebaseApp);

        // Connect to emulators in development environment
        if (isDevelopment) {
          try {
            // Auth needs special handling for different local development URLs
            if (window.location.hostname === 'localhost') {
              // Emulators are commented out for troubleshooting
              // modules.connectAuthEmulator(auth, 'http://localhost:9099');
              // modules.connectFirestoreEmulator(db, 'localhost', 8080);
              // modules.connectStorageEmulator(storage, 'localhost', 9199);

              console.log("Emulator connections disabled for troubleshooting");
            } else {
              // For local IP address development (like 192.168.x.x)
              console.log("Using production Firebase instance for development");
            }
          } catch (emulatorError) {
            console.warn("Connection error", emulatorError);
          }
        }

        setInitialized(true)

        // Initialize Analytics if running in browser and measurement ID is available
        if (typeof window !== 'undefined' && effectiveFirebaseConfig.measurementId) {
          modules.isSupported().then((supported: boolean) => {
            if (supported) {
              modules.getAnalytics(firebaseApp)
              // Don't log Analytics initialization
            }
          })
        }

        // Set up auth state listener
        const unsubscribe = modules.onAuthStateChanged(auth, (currentUser: User | null) => {
          setUser(currentUser)
          setLoading(false)
        })

        return () => unsubscribe()
      } catch (error) {
        console.error("Firebase initialization error:", error);
        setLoading(false)
        setInitialized(false)
      }
    }

    const cleanup = initializeFirebase()

    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn()
      })
    }
  }, [])

    // Auth functions
  const signIn = async (email: string, password: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    try {
      const modules = await loadFirebaseModules()
      const auth = modules.getAuth()
      await modules.signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error("Sign In Error:", error.code, error.message);

      // Handle network errors with more information
      if (error.code === 'auth/network-request-failed') {
        throw new Error("Network connection failed. Please check your internet connection and try again.");
      }

      // Re-throw the original error for other handlers
      throw error;
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    try {
      const modules = await loadFirebaseModules()
      const auth = modules.getAuth()
      await modules.createUserWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error("Sign Up Error:", error.code, error.message);

      // Handle network errors with more information
      if (error.code === 'auth/network-request-failed') {
        throw new Error("Network connection failed. Please check your internet connection and try again.");
      }

      // Re-throw the original error for other handlers
      throw error;
    }
  }

  const googleSignIn = async () => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const modules = await loadFirebaseModules()
    const auth = modules.getAuth()
    const provider = new modules.GoogleAuthProvider()
    // Explicitly request email and profile scopes
    provider.addScope('email');
    provider.addScope('profile');
    const result = await modules.signInWithPopup(auth, provider)
    return result // Return the auth result
  }

  const resetPassword = async (email: string) => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const modules = await loadFirebaseModules()
    const auth = modules.getAuth()
    await modules.sendPasswordResetEmail(auth, email)
  }

  const logout = async () => {
    if (!initialized) throw new Error("Firebase is not initialized")
    const modules = await loadFirebaseModules()
    const auth = modules.getAuth()
    await modules.signOut(auth)
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

