export type ToolCategory = "creative" | "mystical" | "analysis";
export type OutputType = "image" | "image+guide";

export interface ToolFAQ {
  q: string;
  a: string;
}

export interface ToolSEO {
  metaTitle: string;
  metaDescription: string;
  whatYouGet: string[]; // 3-5 bullets
  faq: ToolFAQ[]; // 4-6 entries per tool
  sampleImage?: string; // path to sample output preview (placeholder for now)
}

export interface Tool {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  heroCopy: string;
  coverImage: string;
  creditCost: number; // advisory; server is canonical
  category: ToolCategory;
  inputHint: string;
  outputType: OutputType;
  seo: ToolSEO;
}

export type JobStatus = "processing" | "complete" | "failed";

export interface Job {
  jobId: string;
  userId: string;
  toolId: string;
  status: JobStatus;
  photoStoragePath: string;
  outputStoragePath?: string;
  outputDownloadUrl?: string;
  creditCost: number;
  createdAt: unknown; // Firestore Timestamp
  completedAt?: unknown;
  error?: string;
  refunded?: boolean;
}

export interface Generation {
  generationId: string;
  jobId: string;
  toolId: string;
  outputStoragePath: string;
  outputDownloadUrl: string;
  createdAt: unknown;
}
