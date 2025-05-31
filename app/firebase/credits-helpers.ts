import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, Timestamp, arrayUnion } from "firebase/firestore"

// Constants
export const FREE_CREDITS_PER_USER = 2;

// Interface for credit purchase packages
export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  discountPercentage: number;
}

// Credit packages configuration
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'small',
    credits: 5,
    price: 350, // in cents ($3.50)
    pricePerCredit: 70, // in cents ($0.70)
    discountPercentage: 0,
  },
  {
    id: 'medium',
    credits: 10,
    price: 600, // in cents ($6.00)
    pricePerCredit: 60, // in cents ($0.60)
    discountPercentage: 14, // ~14% discount from base price
  },
  {
    id: 'large',
    credits: 20,
    price: 1000, // in cents ($10.00)
    pricePerCredit: 50, // in cents ($0.50)
    discountPercentage: 29, // ~29% discount from base price
  },
  {
    id: 'xlarge',
    credits: 40,
    price: 1800, // in cents ($18.00)
    pricePerCredit: 45, // in cents ($0.45)
    discountPercentage: 36, // ~36% discount from base price
  }
];

// Interface for user credits
export interface UserCredits {
  balance: number;
  used: number;
  purchaseHistory: CreditPurchase[];
  usageHistory: CreditUsage[];
  lastUpdated: Timestamp | null;
}

// Interface for credit purchase history
export interface CreditPurchase {
  packageId: string;
  creditAmount: number;
  pricePaid: number; // in cents
  purchaseDate: Timestamp;
  isInitialCredits?: boolean;
}

// Interface for credit usage history
export interface CreditUsage {
  projectId: string;
  pageId: string;
  date: Timestamp;
}

// Initialize user credits in Firestore
export async function initializeUserCredits(userId: string): Promise<UserCredits> {
  const db = getFirestore();
  const userCreditsRef = doc(db, "userCredits", userId);
  
  // Check if user credits document already exists
  const userCreditsDoc = await getDoc(userCreditsRef);
  
  if (!userCreditsDoc.exists()) {
    // Create timestamp for consistent use
    const currentTimestamp = Timestamp.now();
    
    // Create new user credits document with initial free credits
    const initialCredits: UserCredits = {
      balance: FREE_CREDITS_PER_USER,
      used: 0,
      purchaseHistory: [{
        packageId: 'initial',
        creditAmount: FREE_CREDITS_PER_USER,
        pricePaid: 0, // Free
        purchaseDate: currentTimestamp,
        isInitialCredits: true
      }],
      usageHistory: [],
      lastUpdated: currentTimestamp,
    };
    
    await setDoc(userCreditsRef, initialCredits);
    return initialCredits;
  }
  
  // Return existing credits
  return userCreditsDoc.data() as UserCredits;
}

// Get user's current credits
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const db = getFirestore();
  const userCreditsRef = doc(db, "userCredits", userId);
  
  // Get user credits document
  const userCreditsDoc = await getDoc(userCreditsRef);
  
  // If credits don't exist, initialize them
  if (!userCreditsDoc.exists()) {
    return initializeUserCredits(userId);
  }
  
  // Return existing credits
  return userCreditsDoc.data() as UserCredits;
}

// Use a credit for image generation
export async function useCredit(userId: string, projectId: string, pageId: string): Promise<boolean> {
  const db = getFirestore();
  const userCreditsRef = doc(db, "userCredits", userId);

  // Get current credits to check balance.
  const userCreditsSnap = await getDoc(userCreditsRef);

  if (!userCreditsSnap.exists()) {
    console.error(`User credits document for ${userId} does not exist in useCredit. Attempting to initialize.`);
    // Attempt to initialize credits if they don't exist, then re-check
    await initializeUserCredits(userId);
    const recheckCreditsSnap = await getDoc(userCreditsRef);
    if (!recheckCreditsSnap.exists() || recheckCreditsSnap.data()?.balance <= 0) {
      console.error(`Failed to initialize or insufficient credits after init for ${userId}`);
      return false; 
    }
    // If initialization was successful and balance is positive, proceed with this new snap
    const currentBalance = recheckCreditsSnap.data()?.balance;
    if (currentBalance <= 0) return false;

  } else {
    // If document exists, check balance
    const currentBalance = userCreditsSnap.data().balance;
    if (currentBalance <= 0) {
      return false;
    }
  }

  // Update credit balance and add to usage history atomically
  await updateDoc(userCreditsRef, {
    balance: increment(-1),
    used: increment(1),
    usageHistory: arrayUnion({ // Use arrayUnion for atomic addition
      projectId,
      pageId,
      date: Timestamp.now()
    }),
    lastUpdated: Timestamp.now()
  });

  return true;
}

// Add purchased credits to user's balance
export async function addCredits(userId: string, packageId: string, creditAmount: number, pricePaid: number): Promise<void> {
  const db = getFirestore();
  const userCreditsRef = doc(db, "userCredits", userId);

  // Ensure user credits document exists, otherwise initialize it.
  const userCreditsSnap = await getDoc(userCreditsRef);
  if (!userCreditsSnap.exists()) {
    // Initialize credits. Note: initializeUserCredits itself adds an initial purchase history entry.
    // We are adding another one here for the actual purchase.
    await initializeUserCredits(userId);
  }
  
  await updateDoc(userCreditsRef, {
    balance: increment(creditAmount),
    purchaseHistory: arrayUnion({ // Using arrayUnion for atomic and non-duplicative addition
      packageId,
      creditAmount,
      pricePaid,
      purchaseDate: Timestamp.now()
    }),
    lastUpdated: Timestamp.now()
  });
}

// Get formatted credit balance for display
export function formatCreditBalance(credits: number): string {
  return credits === 1 ? "1 credit" : `${credits} credits`;
} 