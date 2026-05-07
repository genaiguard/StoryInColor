// Server-side mirror of lib/hair-analysis/types.ts.
// Keep in sync by hand — the two npm trees don't share modules.

export type HairTransformationLevel = "conservative" | "moderate" | "bold";
export type FaceShape = "oval" | "round" | "square" | "heart" | "oblong";

export interface HairStyleCell {
  label: string;
  storagePath: string;
}

export interface PendingHairAnalysisDoc {
  type: "hair-analysis";
  token: string;
  status: "processing" | "ready" | "failed" | "claimed" | "expired";
  ipHash: string;
  ownerSecret?: string;

  // Questionnaire answers (analytics + prompt personalization)
  goal?: string;
  avoid?: string;
  social?: string;
  selfDirection?: string;
  blocker?: string;
  feeling?: string;
  impact?: string;
  transformationLevel?: HairTransformationLevel;

  // Photo
  photoStoragePath: string;

  // Generated outputs — set once analysis completes
  faceShape?: FaceShape;
  styleLabels?: string[];         // all 8 style names in order
  previewCellPath?: string;       // cell-0 storage path (always free)
  cellPaths?: string[];           // all 8 cell storage paths (paid)
  stylistBrief?: string;

  // Payment
  email?: string;
  emailCapturedAt?: FirebaseFirestore.Timestamp;
  marketingOptIn?: boolean;
  stripeCheckoutSessionId?: string;
  claimedByUid?: string;
  claimedAt?: FirebaseFirestore.Timestamp;
  paidViaCredit?: boolean;

  // Attribution
  attribution?: {
    fbp?: string;
    fbc?: string;
    gaClientId?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referrer?: string;
  };
  fbEventId?: string;
  errorMessage?: string;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
}
